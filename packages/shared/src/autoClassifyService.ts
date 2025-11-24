import { NoteClassifier, NoteClassifierConfig } from './noteClassifier';
import { EmbeddingService } from './embeddingService';
import { CategoryScore, NoteCategory } from './types';

export interface AutoClassifyConfig {
  classifier: NoteClassifierConfig;
  embeddingApiKey: string;
  minContentLength?: number; // Default: 20 characters
}

export interface AutoClassifyNoteData {
  noteId: string;
  content: string;
  urls: string[];
}

export interface AutoClassifyResult {
  noteId: string;
  autoConfirmedCategories: Array<{ category: NoteCategory; score: number }>;
  suggestedCategories: Array<{ category: NoteCategory; score: number }>;
  embedding: number[] | null;
  error?: string;
}

export interface DatabaseAdapter {
  addNoteCategory(
    noteId: string,
    category: NoteCategory,
    confidence: number,
    userConfirmed: boolean
  ): Promise<boolean>;

  updateNoteEmbedding(noteId: string, embedding: number[]): Promise<boolean>;
}

/**
 * AutoClassifyService - Handles automatic classification and embedding generation for new notes
 *
 * Features:
 * - Auto-confirms categories with score >= 95 (user_confirmed = true)
 * - Stores lower-confidence scores as suggestions (user_confirmed = false)
 * - Generates embeddings for semantic search
 * - Filters out trivial notes (< 20 characters by default)
 * - Silent error handling with console logging
 */
export class AutoClassifyService {
  private classifier: NoteClassifier;
  private embeddingService: EmbeddingService;
  private minContentLength: number;

  constructor(config: AutoClassifyConfig) {
    this.classifier = new NoteClassifier(config.classifier);
    this.embeddingService = new EmbeddingService(config.embeddingApiKey);
    this.minContentLength = config.minContentLength || 20;
  }

  /**
   * Process a note: classify and generate embedding
   * This is meant to be called in the background (fire-and-forget)
   *
   * @param note - Note data (noteId, content, URLs)
   * @param db - Database adapter for saving results
   * @returns AutoClassifyResult with classification and embedding results
   */
  async processNote(note: AutoClassifyNoteData, db: DatabaseAdapter): Promise<AutoClassifyResult> {
    const result: AutoClassifyResult = {
      noteId: note.noteId,
      autoConfirmedCategories: [],
      suggestedCategories: [],
      embedding: null
    };

    try {
      // Skip trivial notes
      if (note.content.trim().length < this.minContentLength) {
        console.log(`[AutoClassify] Skipping note ${note.noteId}: content too short (${note.content.length} chars)`);
        return result;
      }

      // Run classification and embedding in parallel
      const [categoryScores, embedding] = await Promise.all([
        this.classifyNote(note),
        this.generateEmbedding(note)
      ]);

      // Process category scores
      await this.saveCategories(note.noteId, categoryScores, db, result);

      // Save embedding
      if (embedding && embedding.length > 0) {
        const embeddingSaved = await db.updateNoteEmbedding(note.noteId, embedding);
        if (embeddingSaved) {
          result.embedding = embedding;
          console.log(`[AutoClassify] Saved embedding for note ${note.noteId}`);
        }
      }

      console.log(`[AutoClassify] Completed processing note ${note.noteId}: ${result.autoConfirmedCategories.length} auto-confirmed, ${result.suggestedCategories.length} suggestions`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[AutoClassify] Error processing note ${note.noteId}:`, errorMessage);
      result.error = errorMessage;
      return result;
    }
  }

  /**
   * Classify note content and URLs
   * @param note - Note data
   * @returns Array of category scores
   */
  private async classifyNote(note: AutoClassifyNoteData): Promise<CategoryScore[]> {
    try {
      const scores = await this.classifier.suggestCategories(note.content, note.urls);
      console.log(`[AutoClassify] Classification scores for note ${note.noteId}:`,
        scores.map(s => `${s.category}:${s.score}`).join(', '));
      return scores;
    } catch (error) {
      console.error(`[AutoClassify] Classification failed for note ${note.noteId}:`, error);
      return [];
    }
  }

  /**
   * Generate embedding for note content
   * @param note - Note data
   * @returns Embedding vector (768 dimensions)
   */
  private async generateEmbedding(note: AutoClassifyNoteData): Promise<number[] | null> {
    try {
      // Prepare text for embedding (content + link titles)
      const noteData = {
        content: note.content,
        links: note.urls.map(url => ({ url }))
      };
      const text = this.embeddingService.prepareNoteText(noteData);

      const embedding = await this.embeddingService.generateEmbedding(text);
      console.log(`[AutoClassify] Generated embedding for note ${note.noteId} (${embedding.length} dims)`);
      return embedding;
    } catch (error) {
      console.error(`[AutoClassify] Embedding generation failed for note ${note.noteId}:`, error);
      return null;
    }
  }

  /**
   * Save categories to database
   * Auto-confirms categories with score >= 95, stores others as suggestions
   *
   * @param noteId - Note ID
   * @param scores - Category scores from classifier
   * @param db - Database adapter
   * @param result - Result object to populate
   */
  private async saveCategories(
    noteId: string,
    scores: CategoryScore[],
    db: DatabaseAdapter,
    result: AutoClassifyResult
  ): Promise<void> {
    for (const score of scores) {
      // Determine if this should be auto-confirmed
      const isAutoConfirm = score.action === 'auto-confirm';
      const confidence = score.score / 100; // Convert to 0-1 range

      try {
        const saved = await db.addNoteCategory(
          noteId,
          score.category,
          confidence,
          isAutoConfirm
        );

        if (saved) {
          if (isAutoConfirm) {
            result.autoConfirmedCategories.push({
              category: score.category,
              score: score.score
            });
            console.log(`[AutoClassify] Auto-confirmed ${score.category} (${score.score}) for note ${noteId}`);
          } else if (score.action === 'show-button') {
            // Only save suggestions that meet the "show-button" threshold
            result.suggestedCategories.push({
              category: score.category,
              score: score.score
            });
            console.log(`[AutoClassify] Stored suggestion ${score.category} (${score.score}) for note ${noteId}`);
          }
        }
      } catch (error) {
        console.error(`[AutoClassify] Failed to save category ${score.category} for note ${noteId}:`, error);
      }
    }
  }
}
