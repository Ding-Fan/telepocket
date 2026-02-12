import { db } from './connection';
import {
  BrushEvent,
  BrushEventStatus,
  CreateBrushEventInput,
  BrushStreak,
  WeeklyBrushStats,
} from '../types/brushReminder';
import { handleDatabaseError } from '../utils/errorHandler';

/**
 * Database operations for brush reminder events
 * Handles CRUD operations for brush event tracking and statistics
 */

/**
 * Create a new brush reminder event
 */
export async function createBrushEvent(data: CreateBrushEventInput): Promise<BrushEvent> {
  try {
    const { data: result, error } = await db
      .getClient()
      .from('z_brush_events')
      .insert({
        telegram_user_id: data.telegram_user_id,
        chat_id: data.chat_id,
        event_type: data.event_type,
        scheduled_at: data.scheduled_at.toISOString(),
        expires_at: data.expires_at.toISOString(),
        status: 'pending',
        telegram_message_id: null,
        snooze_until: null,
        completed_at: null,
      })
      .select()
      .single();

    if (error) {
      const context = {
        userId: data.telegram_user_id,
        operation: 'createBrushEvent',
        timestamp: new Date().toISOString(),
        additionalInfo: { eventType: data.event_type },
      };
      const errorMessage = handleDatabaseError(error, context);
      throw new Error(errorMessage);
    }

    return result;
  } catch (error) {
    console.error('Failed to create brush event:', error);
    throw error;
  }
}

/**
 * Update brush event status and optional fields (snooze_until, completed_at)
 */
export async function updateBrushEventStatus(
  id: string,
  status: BrushEventStatus,
  additionalFields?: Partial<BrushEvent>
): Promise<BrushEvent> {
  try {
    const updatePayload: Record<string, unknown> = { status };

    if (additionalFields) {
      if (additionalFields.snooze_until !== undefined) {
        updatePayload.snooze_until = additionalFields.snooze_until;
      }
      if (additionalFields.completed_at !== undefined) {
        updatePayload.completed_at = additionalFields.completed_at;
      }
      if (additionalFields.telegram_message_id !== undefined) {
        updatePayload.telegram_message_id = additionalFields.telegram_message_id;
      }
    }

    const { data: result, error } = await db
      .getClient()
      .from('z_brush_events')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const context = {
        userId: undefined,
        operation: 'updateBrushEventStatus',
        timestamp: new Date().toISOString(),
        additionalInfo: { eventId: id, newStatus: status },
      };
      const errorMessage = handleDatabaseError(error, context);
      throw new Error(errorMessage);
    }

    return result;
  } catch (error) {
    console.error('Failed to update brush event status:', error);
    throw error;
  }
}

/**
 * Get all pending brush events that haven't expired yet
 */
export async function getPendingBrushEvents(): Promise<BrushEvent[]> {
  try {
    const { data: result, error } = await db
      .getClient()
      .from('z_brush_events')
      .select()
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (error) {
      const context = {
        userId: undefined,
        operation: 'getPendingBrushEvents',
        timestamp: new Date().toISOString(),
      };
      const errorMessage = handleDatabaseError(error, context);
      throw new Error(errorMessage);
    }

    return result || [];
  } catch (error) {
    console.error('Failed to get pending brush events:', error);
    throw error;
  }
}

/**
 * Get all expired brush events (pending status but past expiration)
 */
export async function getExpiredBrushEvents(): Promise<BrushEvent[]> {
  try {
    const { data: result, error } = await db
      .getClient()
      .from('z_brush_events')
      .select()
      .eq('status', 'pending')
      .lte('expires_at', new Date().toISOString());

    if (error) {
      const context = {
        userId: undefined,
        operation: 'getExpiredBrushEvents',
        timestamp: new Date().toISOString(),
      };
      const errorMessage = handleDatabaseError(error, context);
      throw new Error(errorMessage);
    }

    return result || [];
  } catch (error) {
    console.error('Failed to get expired brush events:', error);
    throw error;
  }
}

/**
 * Get all snoozed brush events where snooze period has elapsed
 */
export async function getSnoozedBrushEvents(): Promise<BrushEvent[]> {
  try {
    const { data: result, error } = await db
      .getClient()
      .from('z_brush_events')
      .select()
      .eq('status', 'snoozed')
      .lte('snooze_until', new Date().toISOString());

    if (error) {
      const context = {
        userId: undefined,
        operation: 'getSnoozedBrushEvents',
        timestamp: new Date().toISOString(),
      };
      const errorMessage = handleDatabaseError(error, context);
      throw new Error(errorMessage);
    }

    return result || [];
  } catch (error) {
    console.error('Failed to get snoozed brush events:', error);
    throw error;
  }
}

/**
 * Get a single brush event by ID
 */
export async function getBrushEventById(id: string): Promise<BrushEvent | null> {
  try {
    const { data: result, error } = await db
      .getClient()
      .from('z_brush_events')
      .select()
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found
        return null;
      }
      const context = {
        userId: undefined,
        operation: 'getBrushEventById',
        timestamp: new Date().toISOString(),
        additionalInfo: { eventId: id },
      };
      const errorMessage = handleDatabaseError(error, context);
      throw new Error(errorMessage);
    }

    return result || null;
  } catch (error) {
    console.error('Failed to get brush event by ID:', error);
    throw error;
  }
}

/**
 * Get brush streak statistics for a user via RPC function
 */
export async function getBrushStreak(userId: number): Promise<BrushStreak> {
  try {
    const { data: result, error } = await db
      .getClient()
      .rpc('calculate_brush_streak', {
        user_id: userId,
      });

    if (error) {
      const context = {
        userId,
        operation: 'getBrushStreak',
        timestamp: new Date().toISOString(),
      };
      const errorMessage = handleDatabaseError(error, context);
      throw new Error(errorMessage);
    }

    return (
      result || {
        current_streak: 0,
        best_streak: 0,
        total_completions: 0,
        completion_rate_7d: 0,
      }
    );
  } catch (error) {
    console.error('Failed to get brush streak:', error);
    throw error;
  }
}

/**
 * Get weekly brush statistics for a user
 * Calculates completions and rates for the last 7 days
 */
export async function getWeeklyStats(userId: number): Promise<WeeklyBrushStats> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get completed events in last 7 days
    const { data: completedData, error: completedError } = await db
      .getClient()
      .from('z_brush_events')
      .select('id')
      .eq('telegram_user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', sevenDaysAgo.toISOString());

    if (completedError) {
      const context = {
        userId,
        operation: 'getWeeklyStats',
        timestamp: new Date().toISOString(),
        additionalInfo: { phase: 'fetchCompletions' },
      };
      const errorMessage = handleDatabaseError(completedError, context);
      throw new Error(errorMessage);
    }

    const completions = completedData?.length || 0;

    // Get total expected events in last 7 days (morning + night = 2 per day)
    const { data: allEventsData, error: allEventsError } = await db
      .getClient()
      .from('z_brush_events')
      .select('id')
      .eq('telegram_user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (allEventsError) {
      const context = {
        userId,
        operation: 'getWeeklyStats',
        timestamp: new Date().toISOString(),
        additionalInfo: { phase: 'fetchAllEvents' },
      };
      const errorMessage = handleDatabaseError(allEventsError, context);
      throw new Error(errorMessage);
    }

    const totalExpected = allEventsData?.length || 14; // Default to 14 (2 per day)
    const completionRate = totalExpected > 0 ? (completions / totalExpected) * 100 : 0;

    return {
      completions,
      total_expected: totalExpected,
      completion_rate: Math.round(completionRate * 100) / 100, // Round to 2 decimals
    };
  } catch (error) {
    console.error('Failed to get weekly stats:', error);
    throw error;
  }
}
