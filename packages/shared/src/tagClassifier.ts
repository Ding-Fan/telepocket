import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Tag, TagScore } from './types';
import { createGeminiRateLimiter, createOpenRouterRateLimiter, RateLimiter } from './utils/rateLimiter';

// Singleton rate limiters for each provider
const geminiRateLimiter = createGeminiRateLimiter();
const openRouterRateLimiter = createOpenRouterRateLimiter();

export interface TagClassifierConfig {
  provider: 'gemini' | 'openrouter';
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
 * TagClassifier service for scoring notes against tags using their custom prompts
 *
 * Key difference from NoteClassifier:
 * - NoteClassifier: Uses hardcoded category prompts
 * - TagClassifier: Uses user-editable score_prompt from database
 *
 * This allows users to customize how AI scores their tags
 */
export class TagClassifier {
  private genAI?: GoogleGenerativeAI;
  private model?: GenerativeModel;
  private rateLimiter: RateLimiter;
  private readonly config: TagClassifierConfig;
  private readonly API_TIMEOUT_MS = 10000;

  constructor(config: TagClassifierConfig) {
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
  }

  /**
   * Score a single tag against note content using the tag's custom prompt
   * @param content - Note content
   * @param tag - Tag object with score_prompt
   * @param urls - Optional URLs in the note
   * @returns Score 0-100
   */
  async scoreTag(
    content: string,
    tag: Pick<Tag, 'tag_name' | 'score_prompt'>,
    urls?: string[]
  ): Promise<number> {
    // If tag doesn't have a score_prompt, it's a manual tag - return 0
    if (!tag.score_prompt) {
      return 0;
    }

    try {
      // Build prompt by replacing placeholders in the tag's score_prompt
      const prompt = this.buildPrompt(tag.score_prompt, content, urls || []);

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

      console.log(`[TagClassifier] ${tag.tag_name}: raw="${response.trim()}" parsed=${score} clamped=${clampedScore}`);

      return clampedScore;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error scoring tag ${tag.tag_name} with ${this.config.provider}: ${errorMessage}`);

      // Try fallback to Gemini if OpenRouter failed
      if (this.config.provider === 'openrouter' && this.config.openrouter?.fallbackToGemini && this.config.gemini?.apiKey) {
        try {
          console.log(`Attempting Gemini fallback for ${tag.tag_name}...`);
          const prompt = this.buildPrompt(tag.score_prompt!, content, urls || []);

          // Initialize Gemini if not already done
          if (!this.genAI && this.config.gemini) {
            this.genAI = new GoogleGenerativeAI(this.config.gemini.apiKey);
            this.model = this.genAI.getGenerativeModel({
              model: this.config.gemini.model
            });
          }

          const response = await this.callGemini(prompt);
          const score = parseInt(response.trim(), 10) || 0;
          const clampedScore = Math.max(0, Math.min(100, score));

          console.log(`Gemini fallback succeeded for ${tag.tag_name}: score ${clampedScore}`);
          return clampedScore;
        } catch (fallbackError) {
          console.error(`Gemini fallback also failed for ${tag.tag_name}:`, fallbackError);
        }
      }

      // Return 0 on failure
      return 0;
    }
  }

  /**
   * Score multiple tags in parallel
   * @param content - Note content
   * @param tags - Array of tags with score_prompts
   * @param urls - Optional URLs in the note
   * @returns Array of tag scores sorted by score descending
   */
  async scoreTags(
    content: string,
    tags: Tag[],
    urls?: string[]
  ): Promise<TagScore[]> {
    // Filter to only AI tags (tags with score_prompt)
    const aiTags = tags.filter(tag => tag.score_prompt);

    if (aiTags.length === 0) {
      return [];
    }

    // Score all tags in parallel
    const scorePromises = aiTags.map(async (tag) => {
      const score = await this.scoreTag(content, tag, urls);

      return {
        tag_id: tag.id,
        tag_name: tag.tag_name,
        score,
        tier: this.getTier(score),
        action: this.getAction(score, tag.auto_confirm_threshold, tag.suggest_threshold)
      };
    });

    const scores = await Promise.all(scorePromises);

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Build prompt by replacing placeholders in the tag's score_prompt
   * @param scorePrompt - The tag's custom prompt template
   * @param content - Note content
   * @param urls - URLs in the note
   * @returns Final prompt with replacements
   */
  private buildPrompt(scorePrompt: string, content: string, urls: string[]): string {
    const urlsText = urls.length > 0 ? urls.join(', ') : 'none';

    return scorePrompt
      .replace(/\{content\}/g, content)
      .replace(/\{urls\}/g, urlsText);
  }

  /**
   * Call LLM API (supports both Gemini and OpenRouter)
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
        'HTTP-Referer': 'https://github.com/telepocket/bot',
        'X-Title': 'Telepocket Bot'
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
   * Get confidence tier based on score
   */
  private getTier(score: number): TagScore['tier'] {
    if (score >= 95) return 'definite';
    if (score >= 85) return 'high';
    if (score >= 70) return 'moderate';
    if (score >= 60) return 'low';
    return 'insufficient';
  }

  /**
   * Get action based on score and tag's thresholds
   */
  private getAction(
    score: number,
    autoConfirmThreshold: number,
    suggestThreshold: number
  ): TagScore['action'] {
    if (score >= autoConfirmThreshold) {
      return 'auto-confirm';
    }
    if (score >= suggestThreshold) {
      return 'suggest';
    }
    return 'skip';
  }
}
