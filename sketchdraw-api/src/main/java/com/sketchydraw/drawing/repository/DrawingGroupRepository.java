package com.sketchydraw.drawing.repository;

import com.sketchydraw.drawing.entity.DrawingGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DrawingGroupRepository extends JpaRepository<DrawingGroup, Long> {

    List<DrawingGroup> findByUserEmailOrderByUpdatedAtDesc(String userEmail);

    Optional<DrawingGroup> findByUserEmailAndNameIgnoreCase(String userEmail, String name);
}