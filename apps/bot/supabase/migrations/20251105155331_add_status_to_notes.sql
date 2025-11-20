-- Migration: add_status_to_notes
-- Description: Add status column to z_notes table for archive functionality
-- Status values: 'active' (default), 'archived'
-- Rollback: ALTER TABLE z_notes DROP COLUMN status; DROP INDEX idx_notes_status;

-- Add status column with default 'active'
ALTER TABLE z_notes ADD COLUMN status TEXT DEFAULT 'active';

-- Create composite index for efficient filtering by status and user
CREATE INDEX idx_notes_status ON z_notes(status, telegram_user_id);

-- Backfill existing notes to 'active' status
UPDATE z_notes SET status = 'active' WHERE status IS NULL;
