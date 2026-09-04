package com.sketchydraw.markdown.controller;

import com.sketchydraw.markdown.dto.MarkdownExportRequest;
import com.sketchydraw.markdown.dto.MarkdownImportResponse;
import com.sketchydraw.markdown.service.MarkdownDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/markdown-documents")
@RequiredArgsConstructor
public class MarkdownDocumentController {

    private final MarkdownDocumentService service;

    @PostMapping(value = "/export/pdf", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> exportPdf(@RequestBody MarkdownExportRequest request) throws Exception {
        String fileName = safeName(request.getTitle(), "markdown-document") + ".pdf";
        byte[] bytes = service.createPdf(request.getTitle(), request.getMarkdown());
        return download(bytes, MediaType.APPLICATION_PDF, fileName);
    }

    @PostMapping(value = "/export/xlsx", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> exportXlsx(@RequestBody MarkdownExportRequest request) throws Exception {
        String fileName = safeName(request.getTitle(), "markdown-document") + ".xlsx";
        byte[] bytes = service.createXlsx(request.getTitle(), request.getMarkdown());
        return download(bytes, MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), fileName);
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MarkdownImportResponse importDocument(@RequestPart("file") MultipartFile file) throws Exception {
        MarkdownDocumentService.ImportedMarkdown imported = service.importDocument(file);
        return new MarkdownImportResponse(imported.title(), imported.markdown(), imported.sourceType());
    }

    private ResponseEntity<byte[]> download(byte[] bytes, MediaType mediaType, String fileName) {
        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(bytes.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(fileName).build().toString())
                .body(bytes);
    }

    private String safeName(String value, String fallback) {
        String source = value == null || value.isBlank() ? fallback : value;
        String cleaned = source.replaceAll("[^a-zA-Z0-9._-]", "-").replaceAll("-+", "-");
        return cleaned.isBlank() ? fallback : cleaned;
    }
}
