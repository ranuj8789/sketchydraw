package com.sketchydraw.drawing.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "saved_drawing")
@Getter
@Setter
public class SavedDrawing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String drawingJson;

    @Column(length = 50)
    private String drawingType = "EXCALIDRAW";

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}