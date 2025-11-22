-- Migration: add_japanese_category
-- Description: Adds 'japanese' to the note_categories table allowed values
-- Related: Japanese language study materials category feature
--
-- Rollback instructions:
-- 1. Remove 'japanese' from CHECK constraint:
--    ALTER TABLE z_note_categories DROP CONSTRAINT IF EXISTS z_note_categories_category_check;
--    ALTER TABLE z_note_categories ADD CONSTRAINT z_note_categories_category_check
--      CHECK (category IN ('todo', 'idea', 'blog', 'youtube', 'reference'));

-- Add 'japanese' to the category CHECK constraint
ALTER TABLE z_note_categories DROP CONSTRAINT IF EXISTS z_note_categories_category_check;

ALTER TABLE z_note_categories ADD CONSTRAINT z_note_categories_category_check
  CHECK (category IN ('todo', 'idea', 'blog', 'youtube', 'reference', 'japanese'));
