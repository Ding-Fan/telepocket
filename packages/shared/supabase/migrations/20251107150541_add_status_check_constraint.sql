-- Migration: add_status_check_constraint
-- Description: Add CHECK constraint to z_notes.status column to prevent invalid values
-- Valid values: 'active', 'archived'
-- Prevents typos like 'archieved', 'activ', etc. that could corrupt data
--
-- Rollback: ALTER TABLE z_notes DROP CONSTRAINT IF EXISTS chk_notes_status;

-- Add CHECK constraint to ensure only valid status values
ALTER TABLE z_notes ADD CONSTRAINT chk_notes_status
  CHECK (status IN ('active', 'archived'));
