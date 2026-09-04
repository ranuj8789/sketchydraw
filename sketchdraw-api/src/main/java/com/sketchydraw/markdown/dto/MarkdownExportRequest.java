package com.sketchydraw.markdown.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MarkdownExportRequest {
    private String title;
    private String markdown;
}
