-- Migration: Create function to atomically increment impression counts
-- Purpose: Safely increment impression_count and update last_shown_at for notes shown to users
-- Dependencies: impression_count and last_shown_at columns must exist on z_notes
--
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, create a new migration with:
-- DROP FUNCTION IF EXISTS increment_note_impressions(UUID[]);

-- Create function to increment impressions for multiple notes atomically
CREATE OR REPLACE FUNCTION increment_note_impressions(note_ids UUID[])
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INT;
BEGIN
  -- Atomically increment impression_count and update last_shown_at for all provided note IDs
  UPDATE z_notes
  SET
    impression_count = impression_count + 1,
    last_shown_at = NOW()
  WHERE id = ANY(note_ids);

  -- Get the number of rows updated
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN updated_count;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return 0
    RAISE WARNING 'Error in increment_note_impressions: %', SQLERRM;
    RETURN 0;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION increment_note_impressions(UUID[]) IS
  'Atomically increments impression_count and updates last_shown_at for notes shown to users. Used by suggestion algorithm to track note visibility.';
