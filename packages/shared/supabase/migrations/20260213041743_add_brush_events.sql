-- Migration: Create z_brush_events table and calculate_brush_streak function
-- Purpose: Track brush teeth reminder events and calculate streaks for user gamification
-- 
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, create a new migration with:
-- DROP FUNCTION IF EXISTS calculate_brush_streak(BIGINT);
-- DROP TABLE IF EXISTS z_brush_events;

-- Create brush events table
CREATE TABLE z_brush_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  telegram_message_id BIGINT,
  chat_id BIGINT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('morning', 'night')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'snoozed', 'completed', 'missed')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  snooze_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance on common query patterns
CREATE INDEX idx_brush_events_status
  ON z_brush_events(status);

CREATE INDEX idx_brush_events_expires_at
  ON z_brush_events(expires_at) WHERE status = 'pending';

CREATE INDEX idx_brush_events_snooze_until
  ON z_brush_events(snooze_until) WHERE status = 'snoozed';

-- Function to calculate brush streak statistics
CREATE OR REPLACE FUNCTION calculate_brush_streak(p_user_id BIGINT)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_streak INT := 0;
  v_best_streak INT := 0;
  v_total_completions INT;
  v_completion_rate_7d NUMERIC;
  v_days_checked INT;
  v_last_completion_date DATE;
  v_current_date DATE;
BEGIN
  -- Get total completions
  SELECT COUNT(*)
  INTO v_total_completions
  FROM z_brush_events
  WHERE telegram_user_id = p_user_id
    AND status = 'completed';

  -- Calculate 7-day completion rate (2 reminders per day = 14 possible)
  SELECT COUNT(*)
  INTO v_completion_rate_7d
  FROM z_brush_events
  WHERE telegram_user_id = p_user_id
    AND status = 'completed'
    AND completed_at >= now() - INTERVAL '7 days';
  
  v_completion_rate_7d := ROUND((v_completion_rate_7d / 14.0) * 100, 2);

  -- Calculate current streak (consecutive days from today backwards)
  v_current_date := CURRENT_DATE;
  v_current_streak := 0;
  
  WHILE TRUE LOOP
    -- Check if user completed at least one event on this day
    IF EXISTS (
      SELECT 1
      FROM z_brush_events
      WHERE telegram_user_id = p_user_id
        AND status = 'completed'
        AND DATE(completed_at) = v_current_date
    ) THEN
      v_current_streak := v_current_streak + 1;
      v_current_date := v_current_date - INTERVAL '1 day';
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Calculate best streak from historical data
  -- Find all completion date groups and their lengths
  WITH completion_dates AS (
    SELECT DISTINCT DATE(completed_at) AS completion_date
    FROM z_brush_events
    WHERE telegram_user_id = p_user_id
      AND status = 'completed'
    ORDER BY completion_date
  ),
  date_groups AS (
    SELECT
      completion_date,
      completion_date - ROW_NUMBER() OVER (ORDER BY completion_date) * INTERVAL '1 day' AS date_group
    FROM completion_dates
  ),
  streak_lengths AS (
    SELECT
      date_group,
      COUNT(*) AS streak_length
    FROM date_groups
    GROUP BY date_group
  )
  SELECT COALESCE(MAX(streak_length), 0)
  INTO v_best_streak
  FROM streak_lengths;

  -- Return JSON with all streak statistics
  RETURN json_build_object(
    'current_streak', v_current_streak,
    'best_streak', v_best_streak,
    'total_completions', v_total_completions,
    'completion_rate_7d', v_completion_rate_7d
  );
END;
$$;

-- Add function comment
COMMENT ON FUNCTION calculate_brush_streak(BIGINT) IS
  'Calculate brush teeth reminder streak statistics for a user. Returns JSON with current_streak, best_streak, total_completions, and completion_rate_7d (percentage of last 7 days completed).';
