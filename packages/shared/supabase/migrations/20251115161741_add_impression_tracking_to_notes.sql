-- Migration: Add impression tracking to z_notes table
-- Purpose: Track how many times notes are shown to users for weighted suggestion algorithm
-- Dependencies: z_notes table must exist
--
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, create a new migration with:
-- DROP INDEX IF EXISTS idx_notes_last_shown;
-- DROP INDEX IF EXISTS idx_notes_impression_count;
-- ALTER TABLE z_notes DROP COLUMN IF EXISTS last_shown_at;
-- ALTER TABLE z_notes DROP COLUMN IF EXISTS impression_count;

-- Add impression tracking columns to z_notes
ALTER TABLE z_notes
  ADD COLUMN IF NOT EXISTS impression_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_shown_at TIMESTAMPTZ;

-- Create index on impression_count for efficient weighted selection queries
-- Used by suggestion algorithm to find least-shown notes (MIN impression_count per category)
CREATE INDEX IF NOT EXISTS idx_notes_impression_count ON z_notes(impression_count);

-- Create index on last_shown_at for time-based queries and analytics
-- Enables efficient queries for "recently shown" or "never shown" notes
CREATE INDEX IF NOT EXISTS idx_notes_last_shown ON z_notes(last_shown_at);

-- Verify columns were added successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'z_notes' AND column_name = 'impression_count'
  ) THEN
    RAISE EXCEPTION 'Failed to add impression_count column to z_notes';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'z_notes' AND column_name = 'last_shown_at'
  ) THEN
    RAISE EXCEPTION 'Failed to add last_shown_at column to z_notes';
  END IF;

  RAISE NOTICE 'Impression tracking columns added successfully to z_notes';
END $$;
