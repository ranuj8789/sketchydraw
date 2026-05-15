-- =========================================================
-- SketchyDraw Drawing Groups Link
-- V4: Add group/description fields to saved_drawing
-- =========================================================

-- -------------------------
-- Add group + description to saved drawings
-- -------------------------
ALTER TABLE saved_drawing
    ADD COLUMN IF NOT EXISTS group_name VARCHAR(150) NOT NULL DEFAULT 'My Workspace';

ALTER TABLE saved_drawing
    ADD COLUMN IF NOT EXISTS description VARCHAR(1000);

-- -------------------------
-- Backfill old drawings
-- -------------------------
UPDATE saved_drawing
SET group_name = 'My Workspace'
WHERE group_name IS NULL OR TRIM(group_name) = '';

-- -------------------------
-- Helpful indexes
-- -------------------------
CREATE INDEX IF NOT EXISTS idx_saved_drawing_user_group_updated
    ON saved_drawing(user_id, group_name, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_drawing_user_updated
    ON saved_drawing(user_id, updated_at DESC);

-- -------------------------
-- Optional: create default group for existing users
-- This keeps drawing_group table useful even for old users.
-- -------------------------
INSERT INTO drawing_group (
    user_email,
    name,
    created_at,
    updated_at
)
SELECT
    u.email,
    'My Workspace',
    NOW(),
    NOW()
FROM app_user u
WHERE NOT EXISTS (
    SELECT 1
    FROM drawing_group dg
    WHERE dg.user_email = u.email
      AND LOWER(dg.name) = LOWER('My Workspace')
);