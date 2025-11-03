-- Create z_note_images table for storing uploaded image metadata
CREATE TABLE z_note_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES z_notes(id) ON DELETE CASCADE,
  telegram_file_id TEXT NOT NULL,
  telegram_file_unique_id TEXT NOT NULL,
  cloudflare_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_note_images_note_id ON z_note_images(note_id);
CREATE INDEX idx_note_images_telegram_file_id ON z_note_images(telegram_file_id);
CREATE INDEX idx_note_images_created_at ON z_note_images(created_at DESC);

-- Enable Row Level Security
ALTER TABLE z_note_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on note_images for service role"
  ON z_note_images FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on note_images for public"
  ON z_note_images FOR ALL TO public USING (true) WITH CHECK (true);

-- ROLLBACK INSTRUCTIONS:
-- DROP TABLE IF EXISTS z_note_images CASCADE;
