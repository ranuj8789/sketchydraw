package com.sketchydraw.drawing.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class DrawingListResponse {
    private Long id;
    private String title;
    private String groupName;
    private String workspace;
    private String description;
    private String drawingType;
    private LocalDateTime updatedAt;
}