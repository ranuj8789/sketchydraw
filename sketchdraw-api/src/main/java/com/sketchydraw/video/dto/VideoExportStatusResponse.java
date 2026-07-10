package com.sketchydraw.video.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class VideoExportStatusResponse {
    private String exportId;
    private String phase;
    private int progress;
    private int uploadedSegments;
    private int totalSegments;
    private String message;
    private String error;
}
