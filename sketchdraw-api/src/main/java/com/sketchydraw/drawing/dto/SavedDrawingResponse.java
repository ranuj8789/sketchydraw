package com.sketchydraw.drawing.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class SavedDrawingResponse {
    private Long id;
    private String title;
    private String groupName;
    private String workspace;
    private String description;
    private String drawingJson;
    private String drawingType;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}