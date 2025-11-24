import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { CategoryScore, NoteCategory } from './types';
import { ALL_CATEGORIES } from './constants';
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
} from './constants/categoryPrompts';
import { createGeminiRateLimiter, createOpenRouterRateLimiter, RateLimiter } from './utils/rateLimiter';

// Singleton rate limiters for each provider
// Gemini free tier: 60 RPM, we use conservative 40 RPM
const geminiRateLimiter = createGeminiRateLimiter();
// OpenRouter: 600 RPM with 50-request burst capacity
const openRouterRateLimiter = createOpenRouterRateLimiter();

export interface NoteClassifierConfig {
  provider: 'gemini' | 'openrouter';
  classificationEnabled: boolean;
  japaneseCategoryEnabled: boolean;
  autoConfirmThreshold: number; // e.g., 95
  showButtonThreshold: number;  // e.g., 70
  gemini?: {
    apiKey: string;
    model: string;
  };
  openrouter?: {
    apiKey: string;
    model: string;
    fallbackToGemini: boolean;
  };
}

/**
 * NoteClassifier service for LLM-based note categorization
 * Uses Google Gemini with 0-100 scoring system and category-specific prompts
 *
 * Rate limiting: 40 requests/minute (conservative for free tier)
 * Timeout: 10 seconds per API call
 */
export class NoteClassifier {
  private genAI?: GoogleGenerativeAI;
  private model?: GenerativeModel;
  private rateLimiter: RateLimiter;
  private readonly config: NoteClassifierConfig;
  // API timeout: 10 seconds
  // Rationale: Gemini 2.5 Flash typically responds <1s for simple prompts
  // 10s allows for network variability and API slowdowns while failing fast
  // OpenRouter adds ~15-40ms gateway latency
  private readonly API_TIMEOUT_MS = 10000;

  constructor(config: NoteClassifierConfig) {
    this.config = config;

    // Assign the correct rate limiter based on provider
    this.rateLimiter = config.provider === 'openrouter'
      ? openRouterRateLimiter
      : geminiRateLimiter;

    // Initialize provider-specific clients
    if (config.provider === 'gemini' && config.gemini) {
      this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: config.gemini.model
      });
    }
    // OpenRouter uses fetch API, no client initialization needed
  }

  /**
   * Call LLM API (supports both Gemini and OpenRouter)
   * @param prompt - The prompt to send to the LLM
   * @returns The text response from the LLM
   */
  private async callLLM(prompt: string): Promise<string> {
    if (this.config.provider === 'gemini') {
      return this.callGemini(prompt);
    } else {
      return this.callOpenRouter(prompt);
    }
  }

  /**
   * Call Gemini API
   */
  private async callGemini(prompt: string): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini model not initialized');
    }

    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  /**
   * Call OpenRouter API
   */
  private async callOpenRouter(prompt: string): Promise<string> {
    if (!this.config.openrouter) {
      throw new Error('OpenRouter config not provided');
    }

    console.log('[OpenRouter] Sending request to model:', this.config.openrouter.model);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/telepocket/bot', // Optional
        'X-Title': 'Telepocket Bot' // Optional
      },
      body: JSON.stringify({
        model: this.config.openrouter.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 10 // We only need a short numeric response
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenRouter] API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    console.log('[OpenRouter] Raw response:', content);
    return content;
  }

  /**
   * Suggest categories for a note based on content and URLs
   * @param content - The text content of the note
   * @param urls - Optional array of URLs extracted from the note
   * @returns Array of category scores with actions (auto-confirm, show-button, skip)
   */
  async suggestCategories(content: string, urls?: string[]): Promise<CategoryScore[]> {
    // Check if classification is enabled
    if (!this.config.classificationEnabled) {
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

      // 5. Return all scores sorted by score (best first)
      // Don't filter out low scores - let caller decide what to do with them
      return finalScores;
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
    const hasHiragana = HIRAGANA_REGEX.test(content);
    const hasKatakana = KATAKANA_REGEX.test(content);
    const japaneseMatches = content.match(JAPANESE_CHAR_REGEX);

    if (japaneseMatches && japaneseMatches.length > 0) {
      const charCount = japaneseMatches.length;

      // If hiragana or katakana present, definitely Japanese
      if (hasHiragana || hasKatakana) {
        scores.japanese = charCount >= 3 ? 95 : 85;
      }
      // If only kanji (could be Chinese or Japanese), give moderate confidence
      else {
        // Pure kanji - likely Japanese but not certain
        scores.japanese = charCount >= 3 ? 75 : 65;
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
    if (!this.config.japaneseCategoryEnabled) {
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

      // Wait for rate limiter token
      await this.rateLimiter.waitAndConsume(1, this.API_TIMEOUT_MS);

      // Call LLM API with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`LLM API timeout after ${this.API_TIMEOUT_MS}ms`)),
          this.API_TIMEOUT_MS
        );
      });

      const response = await Promise.race([
        this.callLLM(prompt),
        timeoutPromise
      ]);

      // Parse integer score (0-100)
      const score = parseInt(response.trim(), 10) || 0;

      // Clamp score to 0-100 range
      const clampedScore = Math.max(0, Math.min(100, score));

      console.log(`[Classifier] ${category}: raw="${response.trim()}" parsed=${score} clamped=${clampedScore}`);

      return {
        category,
        score: clampedScore,
        tier: this.getTier(clampedScore),
        action: this.getAction(clampedScore)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error scoring category ${category} with ${this.config.provider}: ${errorMessage}`);

      // Try fallback to Gemini if OpenRouter failed and fallback is enabled
      if (this.config.provider === 'openrouter' && this.config.openrouter?.fallbackToGemini && this.config.gemini?.apiKey) {
        try {
          console.log(`Attempting Gemini fallback for ${category}...`);
          const prompt = CATEGORY_PROMPTS[category](content, urls);

          // Temporarily switch to Gemini
          if (!this.genAI && this.config.gemini) {
            this.genAI = new GoogleGenerativeAI(this.config.gemini.apiKey);
            this.model = this.genAI.getGenerativeModel({
              model: this.config.gemini.model
            });
          }

          const response = await this.callGemini(prompt);
          const score = parseInt(response.trim(), 10) || 0;
          const clampedScore = Math.max(0, Math.min(100, score));

          console.log(`Gemini fallback succeeded for ${category}: score ${clampedScore}`);
          return {
            category,
            score: clampedScore,
            tier: this.getTier(clampedScore),
            action: this.getAction(clampedScore)
          };
        } catch (fallbackError) {
          console.error(`Gemini fallback also failed for ${category}:`, fallbackError);
        }
      }

      // Fallback to pattern-based detection if available
      const fastPathScores = this.detectByPattern(content, urls);
      const patternScore = fastPathScores[category];

      if (patternScore !== undefined && patternScore >= this.config.showButtonThreshold) {
        console.log(`Using pattern-based fallback for ${category}: score ${patternScore}`);
        return {
          category,
          score: patternScore,
          tier: this.getTier(patternScore),
          action: this.getAction(patternScore)
        };
      }

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
    if (score >= this.config.autoConfirmThreshold) {
      return 'auto-confirm';
    }
    if (score >= this.config.showButtonThreshold) {
      return 'show-button';
    }
    return 'skip';
  }

  /**
   * Classify a link based on URL, title, and description (independent of note content)
   * Used by /classify command for batch link classification
   * @param url - The URL of the link
   * @param title - Optional title metadata
   * @param description - Optional description metadata
   * @returns Array of category scores with actions
   */
  async classifyLink(url: string, title?: string, description?: string): Promise<CategoryScore[]> {
    // Check if classification is enabled
    if (!this.config.classificationEnabled) {
      return [];
    }

    try {
      // Build a synthetic "content" string from link metadata
      const contentParts: string[] = [];

      if (title) {
        contentParts.push(title);
      }
      if (description) {
        contentParts.push(description);
      }

      // If no metadata, use URL as content
      const content = contentParts.length > 0
        ? contentParts.join('\n\n')
        : url;

      // Use the existing suggestCategories method with URL metadata
      // This reuses all the pattern detection and LLM scoring logic
      const scores = await this.suggestCategories(content, [url]);

      return scores;
    } catch (error) {
      console.error('Error classifying link:', error);
      // Return empty array on failure (graceful degradation)
      return [];
    }
  }

  /**
   * Score a note's relevance to a user query
   * Used by /suggest <query> command for semantic search
   * @param content - Note content to score
   * @param query - User's search query
   * @returns Relevance score (0-100)
   */
  async scoreNoteRelevance(content: string, query: string): Promise<number> {
    try {
      // Build relevance scoring prompt
      const prompt = `You are analyzing a note for relevance to a user query.

User Query: "${query}"

Note Content:
"""
${content}
"""

Score this note's relevance to the query on a scale of 0-100:
- 0-20: Completely irrelevant
- 21-40: Tangentially related
- 41-60: Somewhat relevant
- 61-80: Quite relevant
- 81-100: Highly relevant

Return ONLY an integer score (0-100), nothing else.`;

      // Wait for rate limiter token
      await this.rateLimiter.waitAndConsume(1, this.API_TIMEOUT_MS);

      // Call LLM API with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`LLM API timeout after ${this.API_TIMEOUT_MS}ms`)),
          this.API_TIMEOUT_MS
        );
      });

      const response = await Promise.race([
        this.callLLM(prompt),
        timeoutPromise
      ]);

      // Parse integer score (0-100)
      const score = parseInt(response.trim(), 10);

      // Return 0 if parse failed (NaN)
      if (isNaN(score)) {
        console.error(`Failed to parse relevance score: "${response.trim()}"`);
        return 0;
      }

      // Clamp score to 0-100 range
      const clampedScore = Math.max(0, Math.min(100, score));

      console.log(`[Classifier] Relevance score: raw="${response.trim()}" parsed=${score} clamped=${clampedScore}`);

      return clampedScore;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error scoring note relevance: ${errorMessage}`);

      // Return 0 on failure
      return 0;
    }
  }
}
