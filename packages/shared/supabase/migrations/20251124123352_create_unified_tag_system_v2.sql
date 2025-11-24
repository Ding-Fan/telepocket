-- Migration: create_unified_tag_system
-- Description: Creates unified tag system with user-owned tags
-- Replaces hardcoded categories with flexible tags that support AI auto-tagging
--
-- Key Features:
-- - All tags are user-owned (no system/custom distinction)
-- - Tags can be manual (tag_name only) or AI-powered (with score_prompt)
-- - Auto-copy starter tags (6 categories) to new users
-- - Soft delete with is_archived
-- - No tag limits (unlimited tags per user)
--
-- Rollback instructions:
-- 1. DROP TABLE IF EXISTS z_note_tags CASCADE;
-- 2. DROP TABLE IF EXISTS z_tags CASCADE;
-- 3. DROP FUNCTION IF EXISTS ensure_user_starter_tags(BIGINT);

-- ============================================================
-- PART 1: Create z_tags table (Tag Definitions)
-- ============================================================

CREATE TABLE IF NOT EXISTS z_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  tag_name TEXT NOT NULL CHECK (tag_name ~ '^[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]$'),
  emoji TEXT CHECK (char_length(emoji) <= 10),
  score_prompt TEXT,  -- NULL = manual tag, filled = AI tag

  -- Ownership (every tag has an owner)
  created_by BIGINT NOT NULL,  -- telegram_user_id

  -- Soft delete
  is_archived BOOLEAN DEFAULT FALSE NOT NULL,

  -- AI classification thresholds
  auto_confirm_threshold INT DEFAULT 95 CHECK (auto_confirm_threshold BETWEEN 60 AND 100),
  suggest_threshold INT DEFAULT 60 CHECK (suggest_threshold BETWEEN 0 AND 99),

  -- Usage analytics
  usage_count INT DEFAULT 0 NOT NULL,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CHECK (auto_confirm_threshold > suggest_threshold),
  UNIQUE(created_by, tag_name)  -- User can't have duplicate tag names
);

-- ============================================================
-- PART 2: Create z_note_tags table (Note-to-Tag Relationships)
-- ============================================================

CREATE TABLE IF NOT EXISTS z_note_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES z_notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES z_tags(id) ON DELETE CASCADE,

  -- Classification metadata
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  user_confirmed BOOLEAN DEFAULT FALSE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  confirmed_at TIMESTAMPTZ,  -- When user confirmed (if user_confirmed=true)

  UNIQUE(note_id, tag_id)
);

-- ============================================================
-- PART 3: Create Indexes
-- ============================================================

-- z_tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_created_by ON z_tags(created_by) WHERE is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_tags_name ON z_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_tags_usage ON z_tags(usage_count DESC) WHERE is_archived = FALSE;

-- z_note_tags indexes
CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON z_note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON z_note_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_confirmed ON z_note_tags(user_confirmed) WHERE user_confirmed = TRUE;
CREATE INDEX IF NOT EXISTS idx_note_tags_confidence ON z_note_tags(confidence DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_note_tags_note_confirmed
  ON z_note_tags(note_id, user_confirmed) WHERE user_confirmed = TRUE;
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_confirmed
  ON z_note_tags(tag_id, user_confirmed) WHERE user_confirmed = TRUE;

-- ============================================================
-- PART 4: Enable Row Level Security
-- ============================================================

ALTER TABLE z_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE z_note_tags ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 5: Create RLS Policies
-- ============================================================

-- z_tags policies: Users can only see and manage their own tags

-- Service role has full access
CREATE POLICY "Allow all operations on tags for service_role"
  ON z_tags FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public role has full access (for bot operations)
CREATE POLICY "Allow all operations on tags for public"
  ON z_tags FOR ALL TO public USING (true) WITH CHECK (true);

-- z_note_tags policies: Same as z_note_categories

-- Service role has full access
CREATE POLICY "Allow all operations on note_tags for service_role"
  ON z_note_tags FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public role has full access (for bot operations)
CREATE POLICY "Allow all operations on note_tags for public"
  ON z_note_tags FOR ALL TO public USING (true) WITH CHECK (true);

-- ============================================================
-- PART 6: Create Helper Function - Ensure User Starter Tags
-- ============================================================
-- Note: Emojis and prompts will be set via application code
-- This migration only creates the basic starter tags structure

CREATE OR REPLACE FUNCTION ensure_user_starter_tags(user_id_param BIGINT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  tags_created INT := 0;
  existing_count INT;
BEGIN
  -- Check if user already has tags
  SELECT COUNT(*) INTO existing_count
  FROM z_tags
  WHERE created_by = user_id_param;

  -- If user already has tags, don't create starters
  IF existing_count > 0 THEN
    RETURN 0;
  END IF;

  -- Insert 6 starter tag names (prompts and emojis set by application)
  INSERT INTO z_tags (created_by, tag_name, auto_confirm_threshold, suggest_threshold)
  VALUES
    (user_id_param, 'todo', 95, 60),
    (user_id_param, 'idea', 95, 60),
    (user_id_param, 'blog', 95, 60),
    (user_id_param, 'youtube', 95, 60),
    (user_id_param, 'reference', 95, 60),
    (user_id_param, 'japanese', 95, 60)
  ON CONFLICT (created_by, tag_name) DO NOTHING;

  -- Count how many tags were actually created
  GET DIAGNOSTICS tags_created = ROW_COUNT;

  RETURN tags_created;
END;
$$;

-- ============================================================
-- PART 7: Create Trigger for updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_z_tags_updated_at
  BEFORE UPDATE ON z_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migration Complete
-- ============================================================

-- This migration creates the foundation for the unified tag system:
--  z_tags table with user ownership
--  z_note_tags junction table
--  Indexes for performance
--  RLS policies for security
--  Helper function to create starter tags
--  Updated_at trigger for z_tags
--
-- Next steps (will be done in code, not migration):
-- 1. Call ensure_user_starter_tags() on first note save per user
-- 2. Update starter tags with emojis and score_prompts via application
-- 3. Implement TagClassifier service to use score_prompt field
-- 4. Implement AutoTagService to score and tag notes
-- 5. Build tags page UI for managing tags
-- 6. Dual-write to both z_note_categories (old) and z_note_tags (new) during transition
