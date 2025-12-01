-- Fix tag unique constraint to allow reusing tag names after archiving
--
-- Problem: Current constraint UNIQUE(created_by, tag_name) prevents creating
-- a new tag with the same name even after the old one is archived.
--
-- Solution: Use partial unique index that only applies to non-archived tags.
-- This allows users to reuse tag names after archiving (soft delete).
--
-- ROLLBACK INSTRUCTIONS:
-- DROP INDEX IF EXISTS z_tags_created_by_tag_name_active_key;
-- ALTER TABLE z_tags ADD CONSTRAINT z_tags_created_by_tag_name_key
--   UNIQUE (created_by, tag_name);

-- Step 1: Drop the old constraint
ALTER TABLE z_tags DROP CONSTRAINT IF EXISTS z_tags_created_by_tag_name_key;

-- Step 2: Create partial unique index (only for active/non-archived tags)
-- This allows the same tag name to exist multiple times if archived,
-- but only once if active (is_archived = false)
CREATE UNIQUE INDEX z_tags_created_by_tag_name_active_key
  ON z_tags(created_by, tag_name)
  WHERE is_archived = false;

-- Verification query (optional - comment out for production):
-- SELECT created_by, tag_name, is_archived, COUNT(*)
-- FROM z_tags
-- GROUP BY created_by, tag_name, is_archived
-- HAVING COUNT(*) > 1;
