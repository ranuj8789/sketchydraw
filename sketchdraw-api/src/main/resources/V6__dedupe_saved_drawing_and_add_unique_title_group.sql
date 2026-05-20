-- =========================================================
-- V6: Prevent duplicate saved drawings for same user + group + title
-- Rule: same user + same groupName + same title = update existing drawing
-- =========================================================

UPDATE saved_drawing
SET group_name = 'My Workspace'
WHERE group_name IS NULL OR TRIM(group_name) = '';

UPDATE saved_drawing
SET title = 'Untitled'
WHERE title IS NULL OR TRIM(title) = '';

-- Keep the latest row, remove older duplicates.
WITH ranked_drawings AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY
                user_id,
                LOWER(TRIM(group_name)),
                LOWER(TRIM(title))
            ORDER BY
                updated_at DESC NULLS LAST,
                created_at DESC NULLS LAST,
                id DESC
        ) AS row_number
    FROM saved_drawing
)
DELETE FROM saved_drawing sd
    USING ranked_drawings rd
WHERE sd.id = rd.id
  AND rd.row_number > 1;

-- Database-level safety: even if frontend sends id=null twice, DB will not allow duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uk_saved_drawing_user_group_title_ci
    ON saved_drawing (
    user_id,
    LOWER(TRIM(group_name)),
    LOWER(TRIM(title))
    );