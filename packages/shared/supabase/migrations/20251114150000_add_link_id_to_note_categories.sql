-- Migration: add_link_id_to_note_categories
-- Description: Extends z_note_categories to support independent link classification
-- Adds nullable link_id column and constraint to ensure exactly one of note_id or link_id is set
--
-- Rollback instructions:
-- 1. ALTER TABLE z_note_categories DROP CONSTRAINT IF EXISTS check_note_or_link;
-- 2. ALTER TABLE z_note_categories DROP COLUMN IF EXISTS link_id;
-- 3. ALTER TABLE z_note_categories ALTER COLUMN note_id SET NOT NULL;

-- Make note_id nullable (was NOT NULL before)
ALTER TABLE z_note_categories ALTER COLUMN note_id DROP NOT NULL;

-- Add link_id column (nullable, references z_note_links)
ALTER TABLE z_note_categories ADD COLUMN link_id UUID REFERENCES z_note_links(id) ON DELETE CASCADE;

-- Add CHECK constraint: exactly one of note_id or link_id must be set
ALTER TABLE z_note_categories
  ADD CONSTRAINT check_note_or_link
  CHECK (
    (note_id IS NOT NULL AND link_id IS NULL) OR
    (note_id IS NULL AND link_id IS NOT NULL)
  );

-- Add index for link_id lookups
CREATE INDEX IF NOT EXISTS idx_note_categories_link_id ON z_note_categories(link_id);
