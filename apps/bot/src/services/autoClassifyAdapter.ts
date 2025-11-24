import { DatabaseAdapter, AutoClassifyService, AutoClassifyConfig, AutoClassifyNoteData } from '@telepocket/shared';
import { dbOps } from '../database/operations';
import { db } from '../database/connection';
import { config } from '../config/environment';
import { NoteCategory } from '@telepocket/shared';

/**
 * Database adapter for AutoClassifyService
 * Bridges the shared service with bot-specific database operations
 */
class BotDatabaseAdapter implements DatabaseAdapter {
  async addNoteCategory(
    noteId: string,
    category: NoteCategory,
    confidence: number,
    userConfirmed: boolean
  ): Promise<boolean> {
    return dbOps.addNoteCategory(noteId, category, confidence, userConfirmed);
  }

  async updateNoteEmbedding(noteId: string, embedding: number[]): Promise<boolean> {
    try {
      const { error } = await db.getClient()
        .from('z_notes')
        .update({ embedding: `[${embedding.join(',')}]` })
        .eq('id', noteId);

      if (error) {
        console.error('Failed to update note embedding:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Database error updating note embedding:', error);
      return false;
    }
  }
}

/**
 * Create AutoClassifyService instance configured for the bot
 */
export function createAutoClassifyService(): AutoClassifyService {
  const classifierConfig: AutoClassifyConfig = {
    classifier: {
      provider: config.llm.provider,
      classificationEnabled: config.llm.classificationEnabled,
      japaneseCategoryEnabled: config.llm.japaneseCategoryEnabled,
      autoConfirmThreshold: config.llm.autoConfirmThreshold,
      showButtonThreshold: config.llm.showButtonThreshold,
      gemini: {
        apiKey: config.gemini.apiKey,
        model: config.gemini.model
      },
      openrouter: {
        apiKey: config.openrouter.apiKey,
        model: config.openrouter.model,
        fallbackToGemini: config.openrouter.fallbackToGemini
      }
    },
    embeddingApiKey: config.gemini.apiKey, // Use Gemini API key for embeddings
    minContentLength: 20 // Skip notes shorter than 20 characters
  };

  return new AutoClassifyService(classifierConfig);
}

/**
 * Get the database adapter instance
 */
export function getDatabaseAdapter(): DatabaseAdapter {
  return new BotDatabaseAdapter();
}

/**
 * Process a note in the background (fire-and-forget)
 * @param noteId - Note ID
 * @param content - Note content
 * @param urls - URLs extracted from note
 */
export async function processNoteInBackground(
  noteId: string,
  content: string,
  urls: string[]
): Promise<void> {
  // Fire-and-forget pattern - don't await, don't block
  const service = createAutoClassifyService();
  const adapter = getDatabaseAdapter();

  const noteData: AutoClassifyNoteData = { noteId, content, urls };

  service.processNote(noteData, adapter).catch(error => {
    console.error(`[AutoClassify] Background processing failed for note ${noteId}:`, error);
    // Silent failure - user already got their "✅ Saved" message
  });
}
