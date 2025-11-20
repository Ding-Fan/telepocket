/**
 * Suggestion Selection Service
 *
 * Implements weighted selection algorithms for the /suggest command:
 * - Weighted Random: 70% least-shown, 30% random (impression-based fairness)
 * - LLM Scoring: Semantic relevance scoring for query-based suggestions
 */

import { NoteCategory } from '../types/noteCategories';
import { ALL_CATEGORIES } from '../constants/noteCategories';
import { SuggestionNote } from '../database/noteOperations';
import { NoteClassifier } from './noteClassifier';

/**
 * Select one note per category using weighted random algorithm
 *
 * Algorithm:
 * - 70% probability: Pick random from least-shown notes (impression_count = min_impression_count)
 * - 30% probability: Pick random from all notes (serendipity factor)
 *
 * @param notes - All notes from getSuggestionsByImpression
 * @param categories - Categories to select from (default: all categories)
 * @returns One suggestion note per category (or null if category empty)
 */
export function selectWeightedRandom(
  notes: SuggestionNote[],
  categories: NoteCategory[] = ALL_CATEGORIES
): SuggestionNote[] {
  const selectedNotes: SuggestionNote[] = [];

  // Group notes by category
  const notesByCategory = new Map<NoteCategory, SuggestionNote[]>();
  for (const category of categories) {
    notesByCategory.set(category, []);
  }

  // Populate category groups
  for (const note of notes) {
    const category = note.category as NoteCategory;
    if (notesByCategory.has(category)) {
      notesByCategory.get(category)!.push(note);
    }
  }

  // Select one note per category using weighted algorithm
  for (const [category, categoryNotes] of notesByCategory.entries()) {
    if (categoryNotes.length === 0) {
      continue; // Skip empty categories
    }

    // Find least-shown notes (impression_count = min_impression_count)
    const minImpressionCount = categoryNotes[0].min_impression_count;
    const leastShownNotes = categoryNotes.filter(
      note => note.impression_count === minImpressionCount
    );

    // Weighted selection: 70% from least-shown, 30% from all
    const randomValue = Math.random();
    let selectedNote: SuggestionNote;

    if (randomValue < 0.7 && leastShownNotes.length > 0) {
      // 70% probability: Pick random from least-shown
      selectedNote = leastShownNotes[Math.floor(Math.random() * leastShownNotes.length)];
    } else {
      // 30% probability: Pick random from all (serendipity)
      selectedNote = categoryNotes[Math.floor(Math.random() * categoryNotes.length)];
    }

    selectedNotes.push(selectedNote);
  }

  return selectedNotes;
}

/**
 * Select one note per category using LLM semantic scoring
 *
 * Algorithm:
 * - For each note in category, score relevance to query (0-100)
 * - Select note with highest score per category
 * - Handle API failures gracefully (skip note if scoring fails)
 *
 * @param notes - All notes from getSuggestionsByImpression
 * @param query - User's search query
 * @param classifier - NoteClassifier instance for LLM scoring
 * @param categories - Categories to select from (default: all categories)
 * @returns One suggestion note per category with highest relevance score
 */
export async function selectByLLMScore(
  notes: SuggestionNote[],
  query: string,
  classifier: NoteClassifier,
  categories: NoteCategory[] = ALL_CATEGORIES
): Promise<SuggestionNote[]> {
  const selectedNotes: SuggestionNote[] = [];

  // Group notes by category
  const notesByCategory = new Map<NoteCategory, SuggestionNote[]>();
  for (const category of categories) {
    notesByCategory.set(category, []);
  }

  // Populate category groups
  for (const note of notes) {
    const category = note.category as NoteCategory;
    if (notesByCategory.has(category)) {
      notesByCategory.get(category)!.push(note);
    }
  }

  // Select highest-scoring note per category
  for (const [category, categoryNotes] of notesByCategory.entries()) {
    if (categoryNotes.length === 0) {
      continue; // Skip empty categories
    }

    let highestScore = -1;
    let bestNote: SuggestionNote | null = null;

    // Score each note for relevance
    for (const note of categoryNotes) {
      try {
        const score = await classifier.scoreNoteRelevance(note.content, query);

        if (score > highestScore) {
          highestScore = score;
          bestNote = note;
        }
      } catch (error) {
        // Log error and skip this note
        console.error(`Failed to score note ${note.note_id}:`, error);
        continue;
      }
    }

    // Add best note if found
    if (bestNote) {
      selectedNotes.push(bestNote);
    }
  }

  return selectedNotes;
}
