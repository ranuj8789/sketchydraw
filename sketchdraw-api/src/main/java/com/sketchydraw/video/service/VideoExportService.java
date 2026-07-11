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
                request.getWidth() + "," + request.getHeight() + "," + request.getFps() + "," + request.getFrameCount() + "," + Instant.now(),
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE_NEW);

        ExportState state = new ExportState(request.getFrameCount());
        state.phase = "UPLOADING";
        state.progress = 0;
        state.message = "Waiting for frame segments";
        states.put(id, state);

        log.info("[video-export:{}] Started: {}x{}, fps={}, expectedSegments={}",
                id, request.getWidth(), request.getHeight(), request.getFps(), request.getFrameCount());
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
                state.message,
                state.error
        );
    }

    public Path complete(String exportId) throws IOException, InterruptedException {
        Path dir = requireJob(exportId);
        ExportState state = requireState(exportId);
        Instant started = Instant.now();

        try {
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
                run(exportId, "convert-continuous", List.of(
                        ffmpegBinary, "-y", "-i", inputs.get(0).toString(),
                        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
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
                        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
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

    private void validateStart(StartVideoExportRequest request) {
        if (request == null) throw new IllegalArgumentException("Missing export settings.");
        if (request.getWidth() < 320 || request.getWidth() > 7680) throw new IllegalArgumentException("Invalid width.");
        if (request.getHeight() < 240 || request.getHeight() > 4320) throw new IllegalArgumentException("Invalid height.");
        if (request.getFps() < 1 || request.getFps() > 60) throw new IllegalArgumentException("Invalid FPS.");
        if (request.getFrameCount() < 1 || request.getFrameCount() > 1000) throw new IllegalArgumentException("Invalid frame count.");
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
        private volatile int uploadedSegments;
        private volatile String phase = "CREATED";
        private volatile int progress;
        private volatile String message = "Export created";
        private volatile String error;
        private volatile Instant updatedAt = Instant.now();

        private ExportState(int totalSegments) {
            this.totalSegments = totalSegments;
        }
    }
}
