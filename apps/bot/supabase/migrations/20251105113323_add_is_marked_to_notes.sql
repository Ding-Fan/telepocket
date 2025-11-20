-- Migration: add_is_marked_to_notes
-- Description: Add is_marked boolean column to z_notes table for marking important notes
-- Rollback: ALTER TABLE z_notes DROP COLUMN IF EXISTS is_marked; DROP INDEX IF EXISTS idx_notes_is_marked;

-- Add is_marked column to z_notes table
ALTER TABLE z_notes ADD COLUMN is_marked BOOLEAN DEFAULT FALSE;

-- Create partial index for filtering marked notes (future feature)
-- Only indexes rows where is_marked = TRUE for better performance
CREATE INDEX idx_notes_is_marked ON z_notes(is_marked) WHERE is_marked = TRUE;
