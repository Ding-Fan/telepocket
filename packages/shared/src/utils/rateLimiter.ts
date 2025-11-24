/**
 * Token Bucket Rate Limiter
 *
 * Implements a token bucket algorithm for rate limiting API calls.
 * Suitable for LLM APIs with request-per-minute limits.
 */

export interface RateLimiterOptions {
  maxTokens: number;      // Maximum number of tokens in bucket
  refillRate: number;     // Tokens added per interval
  refillInterval: number; // Interval in milliseconds
}

export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly refillInterval: number;
  private lastRefill: number;
  private refillTimer?: NodeJS.Timeout;

  constructor(options: RateLimiterOptions) {
    this.maxTokens = options.maxTokens;
    this.refillRate = options.refillRate;
    this.refillInterval = options.refillInterval;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();

    // Start automatic refill timer
    this.startRefillTimer();
  }

  /**
   * Attempt to consume tokens. Returns true if successful.
   * @param tokens Number of tokens to consume (default: 1)
   */
  async tryConsume(tokens: number = 1): Promise<boolean> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Wait until tokens are available, then consume them.
   * @param tokens Number of tokens to consume (default: 1)
   * @param timeoutMs Maximum time to wait in milliseconds (default: 30000)
   *                  Rationale: With Gemini at 40 RPM, worst case wait is ~90s for full bucket refill
   *                  30s timeout provides reasonable UX while allowing for rate limit recovery
   *                  If timeout occurs, classification falls back to pattern detection
   */
  async waitAndConsume(tokens: number = 1, timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      this.refill();

      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return;
      }

      // Wait for next refill or 100ms, whichever is shorter
      const waitTime = Math.min(100, this.refillInterval);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    throw new Error(`Rate limiter timeout: Could not acquire ${tokens} tokens within ${timeoutMs}ms`);
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const intervalsElapsed = Math.floor(elapsed / this.refillInterval);

    if (intervalsElapsed > 0) {
      const tokensToAdd = intervalsElapsed * this.refillRate;
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Start automatic refill timer
   */
  private startRefillTimer(): void {
    this.refillTimer = setInterval(() => {
      this.refill();
    }, this.refillInterval);
  }

  /**
   * Stop automatic refill timer (for cleanup)
   */
  stop(): void {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = undefined;
    }
  }

  /**
   * Get current token count
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

/**
 * Create a rate limiter for Google Gemini API
 * Free tier: 60 requests/minute
 * We use 40 RPM (67% of quota) for good UX while staying safe
 * With 6 categories per note, this allows ~6.6 notes/minute
 */
export function createGeminiRateLimiter(): RateLimiter {
  return new RateLimiter({
    maxTokens: 40,           // Max 40 requests in burst
    refillRate: 40,          // Refill 40 tokens per interval
    refillInterval: 60000    // Every 60 seconds (1 minute)
  });
}

/**
 * Create a rate limiter for OpenRouter API
 * OpenRouter has much higher limits than Gemini free tier
 * Configuration: 600 requests/minute (10 tokens/second)
 * Allows burst of 50 parallel requests for category classification
 */
export function createOpenRouterRateLimiter(): RateLimiter {
  return new RateLimiter({
    maxTokens: 50,           // Max 50 requests in burst (enough for 7+ notes with 7 categories)
    refillRate: 10,          // Refill 10 tokens per interval
    refillInterval: 1000     // Every 1 second (10 tokens/second = 600 requests/minute)
  });
}

/**
 * Wrap an async function with rate limiting and timeout
 */
export async function withRateLimit<T>(
  rateLimiter: RateLimiter,
  fn: () => Promise<T>,
  options: {
    timeoutMs?: number;
    cost?: number; // Number of tokens to consume (default: 1)
  } = {}
): Promise<T> {
  const { timeoutMs = 10000, cost = 1 } = options;

  // Wait for rate limit tokens
  await rateLimiter.waitAndConsume(cost, timeoutMs);

  // Execute function with timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([fn(), timeoutPromise]);
}
