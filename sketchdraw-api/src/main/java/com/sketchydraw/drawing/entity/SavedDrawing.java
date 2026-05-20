package com.sketchydraw.drawing.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "saved_drawing",
        indexes = {
                @Index(name = "idx_saved_drawing_user_id", columnList = "user_id"),
                @Index(name = "idx_saved_drawing_user_group_updated", columnList = "user_id, group_name, updated_at")
        }
)
@Getter
@Setter
public class SavedDrawing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(name = "group_name", nullable = false, length = 150)
    private String groupName = "My Workspace";

    @Column(length = 1000)
    private String description;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String drawingJson;

    @Column(length = 50)
    private String drawingType = "EXCALIDRAW";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}