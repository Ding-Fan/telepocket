-- Migration: remove_emoji_from_tags
-- Description: Removes emoji column from z_tags table
--
-- Rationale: Simplify tag system by removing emoji feature
--
-- Rollback instructions:
-- ALTER TABLE z_tags ADD COLUMN emoji TEXT CHECK (char_length(emoji) <= 10);

-- Drop emoji column
ALTER TABLE z_tags DROP COLUMN IF EXISTS emoji;

-- Migration complete
