/**
 * Brush reminder feature types
 * Types for managing tooth brushing reminders and streaks
 */

export type BrushEventType = 'morning' | 'night';
export type BrushEventStatus = 'pending' | 'snoozed' | 'completed' | 'missed';

export interface BrushEvent {
  id: string;
  telegram_user_id: number;
  telegram_message_id: number | null;
  chat_id: number;
  event_type: BrushEventType;
  status: BrushEventStatus;
  scheduled_at: string;
  expires_at: string;
  snooze_until: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CreateBrushEventInput {
  telegram_user_id: number;
  chat_id: number;
  event_type: BrushEventType;
  scheduled_at: Date;
  expires_at: Date;
}

export interface BrushStreak {
  current_streak: number;
  best_streak: number;
  total_completions: number;
  completion_rate_7d: number;
}

export interface WeeklyBrushStats {
  completions: number;
  total_expected: number;
  completion_rate: number;
}

export interface BrushReminderConfig {
  morningTime: string;
  nightTime: string;
  timezone: string;
  expireAfterMinutes: number;
  snoozeMinutes: number;
}
