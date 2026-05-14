package com.sketchydraw.drawing.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SaveDrawingRequest {
    private Long id;
    private String title;
    private String drawingJson;
}