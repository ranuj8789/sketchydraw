package com.sketchydraw.markdown.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class MarkdownImportResponse {
    private String title;
    private String markdown;
    private String sourceType;
}
