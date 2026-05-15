package com.sketchydraw.drawing.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "drawing_group")
public class DrawingGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String userEmail;

    private String name;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}