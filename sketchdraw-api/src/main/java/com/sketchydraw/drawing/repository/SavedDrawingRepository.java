package com.sketchydraw.drawing.repository;

import com.sketchydraw.drawing.entity.SavedDrawing;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedDrawingRepository extends JpaRepository<SavedDrawing, Long> {

    List<SavedDrawing> findByUserIdOrderByUpdatedAtDesc(Long userId);

    Optional<SavedDrawing> findByIdAndUserId(Long id, Long userId);
}