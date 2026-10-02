package com.sketchydraw.video.service;

import com.sketchydraw.video.dto.StartVideoExportRequest;
import com.sketchydraw.video.dto.VideoExportStatusResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class VideoExportService {

    private static final Logger log = LoggerFactory.getLogger(VideoExportService.class);

    @Value("${video.export.blender-binary:blender}")
    private String blenderBinary;

    private final Path root;
    private final String ffmpegBinary;
    private final long timeoutSeconds;
    private final ConcurrentHashMap<String, ExportState> states = new ConcurrentHashMap<>();

    public VideoExportService(
            @Value("${video.export.temp-dir:${java.io.tmpdir}/sketchydraw-video-exports}") String tempDir,
            @Value("${video.export.ffmpeg-binary:ffmpeg}") String ffmpegBinary,
            @Value("${video.export.timeout-seconds:900}") long timeoutSeconds
    ) throws IOException {
        this.root = Paths.get(tempDir).toAbsolutePath().normalize();
        this.ffmpegBinary = ffmpegBinary;
        this.timeoutSeconds = timeoutSeconds;
        Files.createDirectories(root);
        log.info("Video export service initialized. tempDir={}, ffmpeg={}, timeoutSeconds={}", root, ffmpegBinary, timeoutSeconds);
    }

    public String start(StartVideoExportRequest request) throws IOException {
        validateStart(request);
        String id = UUID.randomUUID().toString();
        Path dir = jobDir(id);
        Files.createDirectories(dir.resolve("segments"));
        Files.writeString(dir.resolve("meta.txt"),
                request.getWidth() + "," + request.getHeight() + "," + request.getFps() + "," + request.getFrameCount() + "," + request.getFfmpegSpeed() + "," + Instant.now(),
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE_NEW);

        ExportState state = new ExportState(request.getFrameCount(), request.getFfmpegSpeed());
        state.phase = "UPLOADING";
        state.progress = 0;
        state.message = "Waiting for frame segments";
        states.put(id, state);

        log.info("[video-export:{}] Started: {}x{}, fps={}, expectedSegments={}, ffmpegSpeed={}",
                id, request.getWidth(), request.getHeight(), request.getFps(), request.getFrameCount(), request.getFfmpegSpeed());
        return id;
    }

    public void saveSegment(String exportId, int index, MultipartFile file) throws IOException {
        Path dir = requireJob(exportId);
        if (index < 0 || index > 10_000) throw new IllegalArgumentException("Invalid segment index.");
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Video segment is empty.");
        if (file.getSize() > 150L * 1024L * 1024L) throw new IllegalArgumentException("Video segment is too large.");

        Path target = dir.resolve("segments").resolve(String.format("segment-%05d.webm", index)).normalize();
        ensureInside(dir, target);
        try (var input = file.getInputStream()) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        }

        ExportState state = requireState(exportId);
        state.uploadedSegments = Math.max(state.uploadedSegments, index + 1);
        state.phase = "UPLOADING";
        state.progress = state.totalSegments == 0 ? 0 : Math.min(70, (int) Math.round(state.uploadedSegments * 70.0 / state.totalSegments));
        state.message = "Uploaded segment " + state.uploadedSegments + " of " + state.totalSegments;
        state.updatedAt = Instant.now();

        log.info("[video-export:{}] Uploaded segment {}/{} (index={}, bytes={}, file={})",
                exportId, state.uploadedSegments, state.totalSegments, index, file.getSize(), target.getFileName());
    }

    public VideoExportStatusResponse status(String exportId) {
        requireJob(exportId);
        ExportState state = requireState(exportId);
        return new VideoExportStatusResponse(
                exportId,
                state.phase,
                state.progress,
                state.uploadedSegments,
                state.totalSegments,
                state.ffmpegSpeed,
                state.message,
                state.error
        );
    }

    public Path complete(String exportId) throws IOException, InterruptedException {
        Path dir = requireJob(exportId);
        ExportState state = requireState(exportId);
        Instant started = Instant.now();

        try {
            if (Files.exists(dir.resolve("scene.json"))) return completeBlender(exportId, dir, state);
            List<Path> inputs;
            try (Stream<Path> stream = Files.list(dir.resolve("segments"))) {
                inputs = stream
                        .filter(path -> path.getFileName().toString().endsWith(".webm"))
                        .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                        .collect(Collectors.toList());
            }
            if (inputs.isEmpty()) throw new IllegalStateException("No video segments were uploaded.");

            state.phase = "CONVERTING";
            state.progress = 72;
            state.message = "Converting 0 of " + inputs.size() + " segments";
            state.updatedAt = Instant.now();
            log.info("[video-export:{}] FFmpeg conversion started. segments={}", exportId, inputs.size());

            // The frontend now uploads one continuous recording. Convert it directly to final.mp4
            // so there is no MP4 segment concatenation and therefore no boundary freeze.
            if (inputs.size() == 1) {
                state.message = "Converting continuous recording to MP4";
                state.progress = 85;
                state.updatedAt = Instant.now();
                Path finalFile = dir.resolve("final.mp4");
                String speedFilter = videoSpeedFilter(state.ffmpegSpeed);
                log.info("[video-export:{}] Applying FFmpeg speed={}x, filter={}", exportId, state.ffmpegSpeed, speedFilter);
                run(exportId, "convert-continuous", List.of(
                        ffmpegBinary, "-y", "-i", inputs.get(0).toString(),
                        "-map", "0:v:0", "-map", "0:a?", "-vf", speedFilter,
                        "-af", audioSpeedFilter(state.ffmpegSpeed), "-c:a", "aac", "-b:a", "192k",
                        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                        "-profile:v", "high", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", finalFile.toString()
                ), dir);

                state.phase = "READY";
                state.progress = 100;
                state.message = "MP4 is ready for download";
                state.updatedAt = Instant.now();
                long bytes = Files.size(finalFile);
                log.info("[video-export:{}] Continuous export completed successfully in {} ms. outputBytes={}, output={}",
                        exportId, Duration.between(started, Instant.now()).toMillis(), bytes, finalFile);
                return finalFile;
            }

            Path convertedDir = dir.resolve("converted");
            Files.createDirectories(convertedDir);
            for (int i = 0; i < inputs.size(); i++) {
                Path output = convertedDir.resolve(String.format("part-%05d.mp4", i));
                int number = i + 1;
                state.message = "Converting segment " + number + " of " + inputs.size();
                state.progress = 72 + (int) Math.round(number * 20.0 / inputs.size());
                state.updatedAt = Instant.now();

                log.info("[video-export:{}] Converting segment {}/{}: {} -> {}",
                        exportId, number, inputs.size(), inputs.get(i).getFileName(), output.getFileName());

                run(exportId, "convert-" + number, List.of(
                        ffmpegBinary, "-y", "-i", inputs.get(i).toString(),
                        "-map", "0:v:0", "-map", "0:a?", "-vf", videoSpeedFilter(state.ffmpegSpeed),
                        "-af", audioSpeedFilter(state.ffmpegSpeed), "-c:a", "aac", "-b:a", "192k",
                        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                        "-profile:v", "high", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", output.toString()
                ), dir);
            }

            state.phase = "CONCATENATING";
            state.progress = 94;
            state.message = "Joining all converted segments";
            state.updatedAt = Instant.now();
            log.info("[video-export:{}] Concatenating {} converted MP4 segments", exportId, inputs.size());

            Path concat = dir.resolve("concat.txt");
            StringBuilder concatText = new StringBuilder();
            for (int i = 0; i < inputs.size(); i++) {
                Path part = convertedDir.resolve(String.format("part-%05d.mp4", i));
                concatText.append("file '")
                        .append(part.toAbsolutePath().toString().replace("'", "'\\''"))
                        .append("'\n");
            }
            Files.writeString(concat, concatText.toString(), StandardCharsets.UTF_8);

            Path finalFile = dir.resolve("final.mp4");
            run(exportId, "concat", List.of(
                    ffmpegBinary, "-y", "-f", "concat", "-safe", "0", "-i", concat.toString(),
                    "-c", "copy", "-movflags", "+faststart", finalFile.toString()
            ), dir);

            state.phase = "READY";
            state.progress = 100;
            state.message = "MP4 is ready for download";
            state.updatedAt = Instant.now();
            long bytes = Files.size(finalFile);
            log.info("[video-export:{}] Completed successfully in {} ms. outputBytes={}, output={}",
                    exportId, Duration.between(started, Instant.now()).toMillis(), bytes, finalFile);
            return finalFile;
        } catch (Exception exception) {
            state.phase = "FAILED";
            state.error = exception.getMessage();
            state.message = "Video export failed";
            state.updatedAt = Instant.now();
            log.error("[video-export:{}] Failed after {} ms", exportId,
                    Duration.between(started, Instant.now()).toMillis(), exception);
            throw exception;
        }
    }

    public void saveBackground(String exportId, int index, MultipartFile frame) throws IOException {
        Path dir = requireJob(exportId);
        if (index < 0 || index >= 18000 || frame == null || frame.isEmpty() || frame.getSize() > 40L * 1024 * 1024)
            throw new IllegalArgumentException("Invalid Blender background frame.");
        Path backgrounds = dir.resolve("backgrounds");
        Files.createDirectories(backgrounds);
        try (var input = frame.getInputStream()) {
            Files.copy(input, backgrounds.resolve(String.format("frame-%06d.png", index)), StandardCopyOption.REPLACE_EXISTING);
        }
    }

    public void saveBlenderScene(String exportId, MultipartFile file, MultipartFile audio, double audioPlaybackRate) throws IOException {
        Path dir = requireJob(exportId);
        if (file == null || file.isEmpty() || file.getSize() > 100L * 1024 * 1024)
            throw new IllegalArgumentException("Blender scene must be below 100 MB.");
        if (!Double.isFinite(audioPlaybackRate) || audioPlaybackRate < .025 || audioPlaybackRate > 40)
            throw new IllegalArgumentException("Invalid narration playback rate.");
        JsonNode scene;
        try (var input = file.getInputStream()) { scene = new ObjectMapper().readTree(input); }
        int count = scene.path("count").asInt();
        int width = scene.path("width").asInt(), height = scene.path("height").asInt();
        int fps = scene.path("fps").asInt();
        if (count < 1 || count > 18000 || width < 320 || width > 7680 || height < 240 || height > 4320 || fps < 1 || fps > 60)
            throw new IllegalArgumentException("Invalid Blender scene dimensions or duration.");
        if (!scene.path("segments").isArray()) throw new IllegalArgumentException("Missing Blender scene segments.");
        int expectedStart = 0;
        for (JsonNode segment : scene.path("segments")) {
            if (segment.path("start").asInt(-1) != expectedStart || !segment.path("geometry").isArray() || !segment.path("samples").isArray())
                throw new IllegalArgumentException("Invalid Blender segment ordering.");
            for (JsonNode sample : segment.path("samples")) {
                if (sample.path("nodes").size() != segment.path("geometry").size()) throw new IllegalArgumentException("Invalid Blender node count.");
            }
            expectedStart += segment.path("samples").size();
        }
        if (expectedStart != count) throw new IllegalArgumentException("Invalid Blender frame count.");
        for (int i = 0; i < count; i++) {
            if (!Files.isRegularFile(dir.resolve("backgrounds").resolve(String.format("frame-%06d.png", i))))
                throw new IllegalArgumentException("Missing Blender background frame " + i);
        }
        Files.writeString(dir.resolve("scene.json"), scene.toString(), StandardCharsets.UTF_8);
        if (audio != null && !audio.isEmpty()) {
            if (audio.getSize() > 150L * 1024 * 1024) throw new IllegalArgumentException("Narration is too large.");
            try (var input = audio.getInputStream()) { Files.copy(input, dir.resolve("narration.audio"), StandardCopyOption.REPLACE_EXISTING); }
        }
        Files.writeString(dir.resolve("audio-rate.txt"), Double.toString(audioPlaybackRate), StandardCharsets.UTF_8);
    }

    private Path completeBlender(String exportId, Path dir, ExportState state) throws IOException, InterruptedException {
        JsonNode scene = new ObjectMapper().readTree(dir.resolve("scene.json").toFile());
        Path script = dir.resolve("render_scene.py");
        try (var input = new ClassPathResource("blender/render_scene.py").getInputStream()) {
            Files.copy(input, script, StandardCopyOption.REPLACE_EXISTING);
        }
        state.phase = "RENDERING"; state.progress = 70;
        state.message = "Blender Cycles is rendering 3D frames (CPU, denoised)";
        Path rendered = dir.resolve("rendered");
        Files.createDirectories(rendered);
        run(exportId, "blender", List.of(blenderBinary, "--background", "--factory-startup", "--python-exit-code", "1", "--python", script.toString(), "--", dir.resolve("scene.json").toString(), rendered.toString()), dir);
        int count = scene.path("count").asInt(), fps = scene.path("fps").asInt();
        for (int i = 0; i < count; i++) if (!Files.isRegularFile(rendered.resolve(String.format("frame-%06d.png", i))))
            throw new IOException("Blender did not render frame " + i);
        state.phase = "CONVERTING"; state.progress = 94; state.message = "Compositing Blender 3D, 2D backgrounds and narration";
        Path output = dir.resolve("final.mp4");
        List<String> command = new ArrayList<>(List.of(ffmpegBinary, "-y", "-framerate", Integer.toString(fps), "-i", dir.resolve("backgrounds/frame-%06d.png").toString(),
                "-framerate", Integer.toString(fps), "-i", rendered.resolve("frame-%06d.png").toString()));
        boolean audio = Files.exists(dir.resolve("narration.audio"));
        if (audio) command.addAll(List.of("-i", dir.resolve("narration.audio").toString()));
        command.addAll(List.of("-filter_complex", "[0:v][1:v]overlay=shortest=1," + videoSpeedFilter(state.ffmpegSpeed) + "[v]", "-map", "[v]"));
        if (audio) {
            double rate = Double.parseDouble(Files.readString(dir.resolve("audio-rate.txt"))) * state.ffmpegSpeed;
            command.addAll(List.of("-map", "2:a:0", "-af", audioSpeedFilter(rate) + ",apad", "-c:a", "aac", "-b:a", "192k"));
        }
        command.addAll(List.of("-t", String.format(java.util.Locale.ROOT, "%.9f", count / (double) fps / state.ffmpegSpeed),
                "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output.toString()));
        run(exportId, "blender-compose", command, dir);
        state.phase = "READY"; state.progress = 100; state.message = "Blender MP4 with narration is ready";
        return output;
    }

    private String audioSpeedFilter(double speed) {
        // atempo accepts 0.5–2 on older FFmpeg; chain factors for larger changes.
        double remaining = speed;
        List<String> filters = new ArrayList<>();
        while (remaining < .5) { filters.add("atempo=0.5"); remaining /= .5; }
        while (remaining > 2) { filters.add("atempo=2.0"); remaining /= 2; }
        filters.add(String.format(java.util.Locale.ROOT, "atempo=%.9f", remaining));
        return String.join(",", filters);
    }

    public void delete(String exportId) throws IOException {
        Path dir = jobDir(exportId);
        if (!Files.exists(dir)) {
            states.remove(exportId);
            return;
        }
        try (Stream<Path> stream = Files.walk(dir)) {
            for (Path path : stream.sorted(Comparator.reverseOrder()).collect(Collectors.toList())) {
                Files.deleteIfExists(path);
            }
        }
        states.remove(exportId);
        log.info("[video-export:{}] Deleted temporary export files", exportId);
    }

    private String videoSpeedFilter(double speed) {
        double safeSpeed = Double.isFinite(speed) ? Math.max(0.1, Math.min(4.0, speed)) : 1.0;
        // Use an explicit timestamp multiplier. Example: 0.1x => 10x timestamps, 0.125x => 8x.
        // This makes slow-down behavior unambiguous and keeps STARTPTS at zero.
        double ptsMultiplier = 1.0 / safeSpeed;
        return String.format(java.util.Locale.ROOT, "setpts=(PTS-STARTPTS)*%.9f", ptsMultiplier);
    }

    private void validateStart(StartVideoExportRequest request) {
        if (request == null) throw new IllegalArgumentException("Missing export settings.");
        if (request.getWidth() < 320 || request.getWidth() > 7680) throw new IllegalArgumentException("Invalid width.");
        if (request.getHeight() < 240 || request.getHeight() > 4320) throw new IllegalArgumentException("Invalid height.");
        if (request.getFps() < 1 || request.getFps() > 60) throw new IllegalArgumentException("Invalid FPS.");
        if (request.getFrameCount() < 1 || request.getFrameCount() > 1000) throw new IllegalArgumentException("Invalid frame count.");
        if (!Double.isFinite(request.getFfmpegSpeed()) || request.getFfmpegSpeed() < 0.1 || request.getFfmpegSpeed() > 4.0) throw new IllegalArgumentException("FFmpeg speed must be between 0.1 and 4.0.");
    }

    private ExportState requireState(String exportId) {
        ExportState state = states.get(exportId);
        if (state == null) throw new IllegalArgumentException("Video export status was not found or server restarted.");
        return state;
    }

    private Path requireJob(String exportId) {
        Path dir = jobDir(exportId);
        if (!Files.isDirectory(dir)) throw new IllegalArgumentException("Video export session was not found or expired.");
        return dir;
    }

    private Path jobDir(String exportId) {
        if (exportId == null || !exportId.matches("[0-9a-fA-F-]{36}")) {
            throw new IllegalArgumentException("Invalid video export id.");
        }
        Path dir = root.resolve(exportId).normalize();
        ensureInside(root, dir);
        return dir;
    }

    private void ensureInside(Path parent, Path child) {
        if (!child.toAbsolutePath().normalize().startsWith(parent.toAbsolutePath().normalize())) {
            throw new IllegalArgumentException("Invalid file path.");
        }
    }

    private void run(String exportId, String step, List<String> command, Path workingDir) throws IOException, InterruptedException {
        Path logFile = Files.createTempFile(workingDir, "ffmpeg-" + step + "-", ".log");
        log.info("[video-export:{}] Running FFmpeg step={}: {}", exportId, step, String.join(" ", command));
        Instant started = Instant.now();

        Process process = new ProcessBuilder(command)
                .directory(workingDir.toFile())
                .redirectErrorStream(true)
                .redirectOutput(logFile.toFile())
                .start();

        boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            process.waitFor(5, TimeUnit.SECONDS);
            log.error("[video-export:{}] FFmpeg step={} timed out after {} seconds. log={}", exportId, step, timeoutSeconds, logFile);
            throw new IllegalStateException("FFmpeg timed out during " + step + ".");
        }

        String output = Files.exists(logFile) ? Files.readString(logFile, StandardCharsets.UTF_8) : "";
        if (process.exitValue() != 0) {
            log.error("[video-export:{}] FFmpeg step={} failed with exitCode={}. Output:\n{}",
                    exportId, step, process.exitValue(), output.substring(0, Math.min(output.length(), 12000)));
            throw new IllegalStateException("FFmpeg failed during " + step + ": " + output.substring(0, Math.min(output.length(), 4000)));
        }

        log.info("[video-export:{}] FFmpeg step={} completed in {} ms",
                exportId, step, Duration.between(started, Instant.now()).toMillis());
        Files.deleteIfExists(logFile);
    }

    private static final class ExportState {
        private final int totalSegments;
        private final double ffmpegSpeed;
        private volatile int uploadedSegments;
        private volatile String phase = "CREATED";
        private volatile int progress;
        private volatile String message = "Export created";
        private volatile String error;
        private volatile Instant updatedAt = Instant.now();

        private ExportState(int totalSegments, double ffmpegSpeed) {
            this.totalSegments = totalSegments;
            this.ffmpegSpeed = ffmpegSpeed;
        }
    }
}
