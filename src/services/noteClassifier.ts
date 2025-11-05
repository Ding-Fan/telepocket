import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { config } from '../config/environment';
import { CategoryScore, NoteCategory } from '../types/noteCategories';
import { ALL_CATEGORIES } from '../constants/noteCategories';
import {
  CATEGORY_PROMPTS,
  JAPANESE_CHAR_REGEX,
  HIRAGANA_REGEX,
  KATAKANA_REGEX,
  JAPANESE_LEARNING_DOMAINS,
  BLOG_PLATFORM_DOMAINS,
  BLOG_PATH_PATTERNS,
  VIDEO_PLATFORM_DOMAINS,
  DOCUMENTATION_PATTERNS
} from '../constants/categoryPrompts';

/**
 * NoteClassifier service for LLM-based note categorization
 * Uses Google Gemini with 0-100 scoring system and category-specific prompts
 */
export class NoteClassifier {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: config.gemini.model
    });
  }

  /**
   * Suggest categories for a note based on content and URLs
   * @param content - The text content of the note
   * @param urls - Optional array of URLs extracted from the note
   * @returns Array of category scores with actions (auto-confirm, show-button, skip)
   */
  async suggestCategories(content: string, urls?: string[]): Promise<CategoryScore[]> {
    // Check if classification is enabled
    if (!config.gemini.classificationEnabled) {
      return [];
    }

    const urlList = urls || [];

    try {
      // 1. Fast-path detection (deterministic, before LLM)
      const fastPathScores = this.detectByPattern(content, urlList);

      // 2. Parallel LLM scoring for all categories
      const llmScores = await this.scoreAllCategories(content, urlList);

      // 3. Merge scores (fast-path overrides LLM if higher)
      const mergedScores = this.mergeScores(fastPathScores, llmScores);

      // 4. Apply thresholds and determine actions
      const finalScores = mergedScores.map(score => ({
        ...score,
        tier: this.getTier(score.score),
        action: this.getAction(score.score)
      }));

      // 5. Filter out insufficient scores (< show button threshold)
      return finalScores.filter(score => score.action !== 'skip');
    } catch (error) {
      console.error('Error suggesting categories:', error);
      // Return empty array on failure (graceful degradation)
      return [];
    }
  }

  /**
   * Detect categories based on deterministic patterns (before LLM)
   * @param content - Note content
   * @param urls - URLs in the note
   * @returns Partial scores for categories with high-confidence pattern matches
   */
  private detectByPattern(content: string, urls: string[]): Partial<Record<NoteCategory, number>> {
    const scores: Partial<Record<NoteCategory, number>> = {};

    // Japanese character detection
    // Only trigger if hiragana or katakana present (to avoid misclassifying pure Chinese)
    const hasHiragana = HIRAGANA_REGEX.test(content);
    const hasKatakana = KATAKANA_REGEX.test(content);

    if (hasHiragana || hasKatakana) {
      const japaneseMatches = content.match(JAPANESE_CHAR_REGEX);
      if (japaneseMatches) {
        const charCount = japaneseMatches.length;
        scores.japanese = charCount >= 3 ? 95 : 85;
      }
    }

    // URL pattern detection
    for (const url of urls) {
      const lowerUrl = url.toLowerCase();

      // YouTube detection (100 confidence)
      if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
        scores.youtube = 100;
      }

      // Japanese learning sites (95 confidence)
      if (JAPANESE_LEARNING_DOMAINS.some(domain => lowerUrl.includes(domain))) {
        scores.japanese = Math.max(scores.japanese || 0, 95);
      }

      // Blog platforms (95 confidence)
      if (BLOG_PLATFORM_DOMAINS.some(domain => lowerUrl.includes(domain))) {
        scores.blog = 95;
      }

      // Blog path patterns (85 confidence)
      if (BLOG_PATH_PATTERNS.some(pattern => lowerUrl.includes(pattern))) {
        scores.blog = Math.max(scores.blog || 0, 85);
      }

      // Video platforms (95 confidence)
      if (VIDEO_PLATFORM_DOMAINS.some(domain => lowerUrl.includes(domain))) {
        scores.youtube = Math.max(scores.youtube || 0, 95);
      }

      // Documentation patterns (90 confidence)
      if (DOCUMENTATION_PATTERNS.some(pattern => lowerUrl.includes(pattern))) {
        scores.reference = Math.max(scores.reference || 0, 90);
      }
    }

    return scores;
  }

  /**
   * Score all categories using LLM (parallel execution)
   * @param content - Note content
   * @param urls - URLs in the note
   * @returns Array of category scores from LLM
   */
  private async scoreAllCategories(content: string, urls: string[]): Promise<CategoryScore[]> {
    // Filter categories based on feature flags
    let categoriesToScore = [...ALL_CATEGORIES];
    if (!config.gemini.japaneseCategoryEnabled) {
      categoriesToScore = categoriesToScore.filter(c => c !== 'japanese');
    }

    // Run all category prompts in parallel
    const scorePromises = categoriesToScore.map(category =>
      this.scoreSingleCategory(content, urls, category)
    );

    const scores = await Promise.all(scorePromises);
    return scores;
  }

  /**
   * Score a single category using its specialized prompt
   * @param content - Note content
   * @param urls - URLs in the note
   * @param category - Category to score
   * @returns Category score from LLM
   */
  private async scoreSingleCategory(
    content: string,
    urls: string[],
    category: NoteCategory
  ): Promise<CategoryScore> {
    try {
      // Build category-specific prompt
      const prompt = CATEGORY_PROMPTS[category](content, urls);

      // Call Gemini API
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Parse integer score (0-100)
      const score = parseInt(response.trim(), 10) || 0;

      // Clamp score to 0-100 range
      const clampedScore = Math.max(0, Math.min(100, score));

      return {
        category,
        score: clampedScore,
        tier: this.getTier(clampedScore),
        action: this.getAction(clampedScore)
      };
    } catch (error) {
      console.error(`Error scoring category ${category}:`, error);
      // Return zero score on failure
      return {
        category,
        score: 0,
        tier: 'insufficient',
        action: 'skip'
      };
    }
  }

  /**
   * Merge fast-path and LLM scores (fast-path takes precedence if higher)
   * @param fastPathScores - Deterministic pattern-based scores
   * @param llmScores - LLM-generated scores
   * @returns Merged category scores
   */
  private mergeScores(
    fastPathScores: Partial<Record<NoteCategory, number>>,
    llmScores: CategoryScore[]
  ): CategoryScore[] {
    const merged: CategoryScore[] = [];

    for (const llmScore of llmScores) {
      const fastPathScore = fastPathScores[llmScore.category];

      // Use fast-path score if it's higher than LLM score
      const finalScore = fastPathScore !== undefined && fastPathScore > llmScore.score
        ? fastPathScore
        : llmScore.score;

      merged.push({
        category: llmScore.category,
        score: finalScore,
        tier: this.getTier(finalScore),
        action: this.getAction(finalScore)
      });
    }

    // Sort by score descending
    return merged.sort((a, b) => b.score - a.score);
  }

  /**
   * Get confidence tier based on score
   * @param score - Category score (0-100)
   * @returns Confidence tier
   */
  private getTier(score: number): CategoryScore['tier'] {
    if (score >= 95) return 'definite';
    if (score >= 85) return 'high';
    if (score >= 70) return 'moderate';
    if (score >= 60) return 'low';
    return 'insufficient';
  }

  /**
   * Get action based on score and thresholds
   * @param score - Category score (0-100)
   * @returns Action to take (auto-confirm, show-button, skip)
   */
  private getAction(score: number): CategoryScore['action'] {
    if (score >= config.gemini.autoConfirmThreshold) {
      return 'auto-confirm';
    }
    if (score >= config.gemini.showButtonThreshold) {
      return 'show-button';
    }
    return 'skip';
  }
}
