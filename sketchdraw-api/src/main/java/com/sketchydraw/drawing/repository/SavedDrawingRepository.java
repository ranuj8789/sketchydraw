package com.sketchydraw.drawing.repository;

import com.sketchydraw.drawing.entity.SavedDrawing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SavedDrawingRepository extends JpaRepository<SavedDrawing, Long> {

    List<SavedDrawing> findByUserIdOrderByUpdatedAtDesc(Long userId);

    Optional<SavedDrawing> findByIdAndUserId(Long id, Long userId);

    @Query(value = """
            SELECT *
            FROM saved_drawing d
            WHERE d.user_id = :userId
              AND LOWER(TRIM(d.title)) = LOWER(TRIM(:title))
              AND LOWER(TRIM(COALESCE(d.group_name, 'My Workspace'))) = LOWER(TRIM(:groupName))
            ORDER BY d.updated_at DESC NULLS LAST, d.id DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<SavedDrawing> findLatestByUserIdAndTitleAndGroupNameIgnoreCase(
            @Param("userId") Long userId,
            @Param("title") String title,
            @Param("groupName") String groupName
    );
}