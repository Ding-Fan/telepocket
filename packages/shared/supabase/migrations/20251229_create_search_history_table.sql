-- Create search history table for tracking user searches
CREATE TABLE z_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  query TEXT NOT NULL CHECK (char_length(query) >= 2 AND char_length(query) <= 500),
  searched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(telegram_user_id, query)
);

-- Indexes for performance
CREATE INDEX idx_search_history_user_time
  ON z_search_history(telegram_user_id, searched_at DESC);

CREATE INDEX idx_search_history_query
  ON z_search_history(query);

-- Auto-cleanup function to maintain max 10 searches per user
CREATE OR REPLACE FUNCTION cleanup_old_search_history()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM z_search_history
  WHERE telegram_user_id = NEW.telegram_user_id
    AND id NOT IN (
      SELECT id
      FROM z_search_history
      WHERE telegram_user_id = NEW.telegram_user_id
      ORDER BY searched_at DESC
      LIMIT 10
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run cleanup after each insert
CREATE TRIGGER trigger_cleanup_search_history
  AFTER INSERT ON z_search_history
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_search_history();

-- Upsert function to handle duplicate searches
CREATE OR REPLACE FUNCTION save_search_query(
  user_id BIGINT,
  search_query TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO z_search_history (telegram_user_id, query, searched_at)
  VALUES (user_id, search_query, NOW())
  ON CONFLICT (telegram_user_id, query)
  DO UPDATE SET searched_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE z_search_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy for service role (used by Next.js server actions and MCP server)
CREATE POLICY "Service role has full access to search_history"
  ON z_search_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
