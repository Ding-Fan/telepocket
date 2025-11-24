-- Migration: add_is_ai_enabled_and_populate_starter_tags
-- Description: Adds is_ai_enabled field and populates starter tags with score_prompts
--
-- Changes:
-- 1. Add is_ai_enabled column to z_tags (separates "has prompt" from "AI active")
-- 2. Populate 6 starter tags with score_prompts (emojis can be added later via UI)
-- 3. Set is_ai_enabled = FALSE for all starter tags (user opt-in required)
--
-- Rollback instructions:
-- 1. ALTER TABLE z_tags DROP COLUMN is_ai_enabled;
-- 2. UPDATE z_tags SET score_prompt = NULL WHERE tag_name IN ('todo', 'idea', 'blog', 'youtube', 'reference', 'japanese');

-- ============================================================
-- PART 1: Add is_ai_enabled column
-- ============================================================

ALTER TABLE z_tags ADD COLUMN IF NOT EXISTS is_ai_enabled BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN z_tags.is_ai_enabled IS 'Controls whether AI classification runs for this tag. Separate from score_prompt to allow prompts to exist while AI is disabled.';

-- ============================================================
-- PART 2: Populate starter tags with score_prompts
-- ============================================================

-- Update 'todo' tag
UPDATE z_tags
SET
  score_prompt = 'You are a task detection AI. Analyze the content and score how likely it represents a TODO/task/action item.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- Task verbs (need, must, should, remind, fix, implement): +40
- Temporal indicators (tomorrow, deadline, by date): +30
- Urgency markers (important, urgent, ASAP): +20
- Checkbox format or action list: +10

Return ONLY an integer 0-100. No explanation.',
  is_ai_enabled = FALSE
WHERE tag_name = 'todo';

-- Update 'idea' tag
UPDATE z_tags
SET
  score_prompt = 'You are an idea detection AI. Analyze the content and score how likely it represents a creative IDEA/concept/brainstorm.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- Explicit idea markers (idea:, what if, concept): +40
- Creative/speculative language (could build, imagine, new approach): +30
- Innovation terms (novel, creative, unique): +20
- Hypothetical scenarios (if we, suppose, consider): +10

Return ONLY an integer 0-100. No explanation.',
  is_ai_enabled = FALSE
WHERE tag_name = 'idea';

-- Update 'blog' tag
UPDATE z_tags
SET
  score_prompt = 'You are a blog/article detection AI. Analyze the content and score how likely it contains blog posts or written articles.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- Known blog platforms (medium.com, dev.to, substack.com): +50
- URL path indicators (/blog/, /article/, /post/): +30
- Reading material mentions (article, blog post, wrote about): +15
- Content structure hints (long-form, tutorial): +5

Return ONLY an integer 0-100. No explanation.',
  is_ai_enabled = FALSE
WHERE tag_name = 'blog';

-- Update 'youtube' tag
UPDATE z_tags
SET
  score_prompt = 'You are a video content detection AI. Analyze the content and score how likely it contains video/YouTube content.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- YouTube URL (youtube.com, youtu.be): +60
- Other video platforms (vimeo, twitch, loom): +50
- Video keywords (video, watch, tutorial, talk): +30
- Streaming/recording mentions (webinar, conference, recorded): +10

Return ONLY an integer 0-100. No explanation.',
  is_ai_enabled = FALSE
WHERE tag_name = 'youtube';

-- Update 'reference' tag
UPDATE z_tags
SET
  score_prompt = 'You are a reference/documentation detection AI. Analyze the content and score how likely it contains reference material or documentation.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- Official docs URLs (docs.*, api.*, developer.*): +50
- Documentation mentions (docs, API reference, manual): +30
- Knowledge bases (stackoverflow, wiki, MDN): +15
- Learning resources (guide, tutorial, how-to): +5

Return ONLY an integer 0-100. No explanation.',
  is_ai_enabled = FALSE
WHERE tag_name = 'reference';

-- Update 'japanese' tag
UPDATE z_tags
SET
  score_prompt = 'You are a Japanese language study material detection AI. Analyze the content and score how likely it contains Japanese learning content.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- Contains hiragana or katakana characters: +50 (if 3+ chars: +60)
- Japanese learning site URLs (jisho.org, bunpro.jp, wanikani.com): +50
- Language keywords (Japanese, nihongo, JLPT, kanji, grammar): +30
- Romanized Japanese in educational context: +20
- Learning context (study, vocabulary, syntax): +10

Special rules:
- If hiragana or katakana present: minimum score 85
- If 3+ Japanese kana/kanji characters: minimum score 95
- Mixed Japanese + English explanation: score 90-95
- Pure Chinese text (only kanji/hanzi characters, no kana): score 0-30 (not Japanese)

IMPORTANT: Chinese and Japanese share many characters (kanji/hanzi). Only score high if:
1. Hiragana or katakana are present (definite Japanese), OR
2. Context clearly indicates Japanese learning (JLPT, Japanese grammar, etc.)

Return ONLY an integer 0-100. No explanation.',
  is_ai_enabled = FALSE
WHERE tag_name = 'japanese';

-- ============================================================
-- Migration Complete
-- ============================================================

-- Summary:
-- - Added is_ai_enabled column (default FALSE)
-- - Populated 6 starter tags with score_prompts (no emojis - add later via UI)
-- - AI remains disabled by default (user opt-in required)
--
-- Next steps (application code):
-- 1. Update Tag interface to include is_ai_enabled field
-- 2. Update CreateTagModal and EditTagModal to use is_ai_enabled toggle
-- 3. Update AutoTagService to only score tags where is_ai_enabled = TRUE
-- 4. Update tagInitializer to handle the new field
