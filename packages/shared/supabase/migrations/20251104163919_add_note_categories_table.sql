-- Migration: add_note_categories_table
-- Description: Creates z_note_categories junction table for LLM-based note classification
-- Supports: todo, idea, blog, youtube, reference categories with confidence scoring
--
-- Rollback instructions:
-- 1. DROP TABLE IF EXISTS z_note_categories CASCADE;

-- Create note categories table
CREATE TABLE IF NOT EXISTS z_note_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES z_notes(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('todo', 'idea', 'blog', 'youtube', 'reference')),
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  user_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_note_categories_note_id ON z_note_categories(note_id);
CREATE INDEX IF NOT EXISTS idx_note_categories_category ON z_note_categories(category);
CREATE INDEX IF NOT EXISTS idx_note_categories_user_confirmed ON z_note_categories(user_confirmed);

-- Composite index for efficient category filtering (only confirmed categories)
CREATE INDEX IF NOT EXISTS idx_note_categories_category_confirmed
  ON z_note_categories(category, user_confirmed)
  WHERE user_confirmed = TRUE;

-- Enable Row Level Security
ALTER TABLE z_note_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Service role has full access
CREATE POLICY "Allow all operations on note_categories for service_role"
  ON z_note_categories FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public role has full access (for bot operations)
CREATE POLICY "Allow all operations on note_categories for public"
  ON z_note_categories FOR ALL TO public USING (true) WITH CHECK (true);
