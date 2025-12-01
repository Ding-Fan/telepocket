-- Migration: enable_ai_for_starter_tags
-- Description: Enable AI classification for the 6 starter tags
--
-- Background:
-- - Starter tags were created with score_prompts but is_ai_enabled = FALSE
-- - This migration enables AI for all starter tags to activate auto-tagging
-- - Old category system will be deprecated (no migration needed - keep as read-only)
--
-- Changes:
-- 1. Enable AI for all 6 starter tags (todo, idea, blog, youtube, reference, japanese)
--
-- Rollback instructions:
-- UPDATE z_tags SET is_ai_enabled = FALSE WHERE tag_name IN ('todo', 'idea', 'blog', 'youtube', 'reference', 'japanese');

-- ============================================================
-- Enable AI for starter tags
-- ============================================================

UPDATE z_tags
SET is_ai_enabled = TRUE
WHERE tag_name IN ('todo', 'idea', 'blog', 'youtube', 'reference', 'japanese')
  AND score_prompt IS NOT NULL;

-- ============================================================
-- Migration Complete
-- ============================================================

-- Summary:
-- - Enabled AI classification for 6 starter tags
-- - AutoTagService will now score and apply these tags automatically
-- - Old category system (z_note_categories) remains for historical data
-- - New notes will use tag system (z_note_tags)
