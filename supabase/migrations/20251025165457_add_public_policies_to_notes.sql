-- ============================================================================
-- Add Public Role Policies to Notes Tables
-- ============================================================================
--
-- Purpose: Allow public role (anon key) to access z_notes and z_note_links
-- Reason: Application uses anon key, not service role key
-- Pattern: Matches existing policies on z_messages and z_links
--
-- ============================================================================

-- Policy: Allow public role to perform all operations on notes
CREATE POLICY "Allow all operations on notes" ON z_notes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Policy: Allow public role to perform all operations on note_links
CREATE POLICY "Allow all operations on note_links" ON z_note_links
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
