package com.sketchydraw.video.controller;

import com.sketchydraw.video.dto.CompleteVideoExportRequest;
import com.sketchydraw.video.dto.StartVideoExportRequest;
import com.sketchydraw.video.dto.VideoExportStatusResponse;
import com.sketchydraw.video.service.VideoExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/video-exports")
@RequiredArgsConstructor
public class VideoExportController {

    private final VideoExportService service;

    @PostMapping("/start")
    public Map<String, String> start(@RequestBody StartVideoExportRequest request) throws Exception {
        return Map.of("exportId", service.start(request));
    }

    @PostMapping(path = "/{exportId}/segments/{index}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> upload(
            @PathVariable String exportId,
            @PathVariable int index,
            @RequestPart("segment") MultipartFile segment
    ) throws Exception {
        service.saveSegment(exportId, index, segment);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/{exportId}/status")
    public VideoExportStatusResponse status(@PathVariable String exportId) {
        return service.status(exportId);
    }

    @PostMapping("/{exportId}/complete")
    public ResponseEntity<FileSystemResource> complete(
            @PathVariable String exportId,
            @RequestBody(required = false) CompleteVideoExportRequest request
    ) throws Exception {
        Path finalFile = service.complete(exportId);
        String requested = request == null ? null : request.getFileName();
        String safeName = sanitizeFileName(requested == null ? "sketchydraw-video.mp4" : requested);
        if (!safeName.toLowerCase().endsWith(".mp4")) safeName += ".mp4";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("video/mp4"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(safeName).build().toString())
                .contentLength(finalFile.toFile().length())
                .body(new FileSystemResource(finalFile));
    }

    @DeleteMapping("/{exportId}")
    public ResponseEntity<Void> delete(@PathVariable String exportId) throws Exception {
        service.delete(exportId);
        return ResponseEntity.noContent().build();
    }

    private String sanitizeFileName(String value) {
        String cleaned = value.replaceAll("[^a-zA-Z0-9._-]", "-");
        return cleaned.isBlank() ? "sketchydraw-video.mp4" : cleaned;
    }
}
