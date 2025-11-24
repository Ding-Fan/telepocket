import { SupabaseClient } from '@supabase/supabase-js';
import { TagClassifier } from './tagClassifier';
import { Tag, TagScore, NoteTagInsert } from './types';

export interface AutoTagResult {
  autoConfirmed: TagScore[];
  suggested: TagScore[];
}

/**
 * AutoTagService - Automatically tags notes using AI-powered tag classification
 *
 * This service:
 * 1. Gets all user's AI tags (tags with score_prompt)
 * 2. Scores each tag against the note content
 * 3. Auto-confirms tags above threshold
 * 4. Suggests tags between thresholds
 * 5. Saves tag assignments to database
 */
export class AutoTagService {
  private tagClassifier: TagClassifier;
  private supabase: SupabaseClient;

  constructor(tagClassifier: TagClassifier, supabase: SupabaseClient) {
    this.tagClassifier = tagClassifier;
    this.supabase = supabase;
  }

  /**
   * Automatically tag a note with relevant tags
   * @param noteId - UUID of the note
   * @param content - Note content
   * @param userId - Telegram user ID
   * @param urls - Optional URLs in the note
   * @returns Auto-confirmed and suggested tags
   */
  async autoTagNote(
    noteId: string,
    content: string,
    userId: number,
    urls?: string[]
  ): Promise<AutoTagResult> {
    // Skip trivial content
    if (content.trim().length < 20) {
      return { autoConfirmed: [], suggested: [] };
    }

    try {
      // 1. Get all AI-enabled tags for user
      const tags = await this.getUserAITags(userId);

      if (tags.length === 0) {
        console.log(`[AutoTagService] User ${userId} has no AI tags`);
        return { autoConfirmed: [], suggested: [] };
      }

      console.log(`[AutoTagService] Scoring ${tags.length} AI tags for user ${userId}`);

      // 2. Score all tags in parallel
      const scores = await this.tagClassifier.scoreTags(content, tags, urls);

      // 3. Separate into auto-confirmed and suggested
      const autoConfirmed = scores.filter(s => s.action === 'auto-confirm');
      const suggested = scores.filter(s => s.action === 'suggest');

      console.log(`[AutoTagService] Auto-confirmed: ${autoConfirmed.length}, Suggested: ${suggested.length}`);

      // 4. Save auto-confirmed tags to database
      for (const score of autoConfirmed) {
        await this.addTagToNote(noteId, score.tag_id, {
          confidence: score.score / 100,
          user_confirmed: true
        });
      }

      // 5. Save suggested tags (user_confirmed=false)
      for (const score of suggested) {
        await this.addTagToNote(noteId, score.tag_id, {
          confidence: score.score / 100,
          user_confirmed: false
        });
      }

      return { autoConfirmed, suggested };
    } catch (error) {
      console.error('[AutoTagService] Error auto-tagging note:', error);
      // Return empty arrays on failure (graceful degradation)
      return { autoConfirmed: [], suggested: [] };
    }
  }

  /**
   * Get all AI-enabled tags for a user (tags with score_prompt)
   * @param userId - Telegram user ID
   * @returns Array of tags with score_prompts
   */
  private async getUserAITags(userId: number): Promise<Tag[]> {
    const { data, error } = await this.supabase
      .from('z_tags')
      .select('*')
      .eq('created_by', userId)
      .eq('is_archived', false)
      .not('score_prompt', 'is', null)
      .order('usage_count', { ascending: false });

    if (error) {
      console.error('[AutoTagService] Error fetching user AI tags:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Add a tag to a note (or update if already exists)
   * @param noteId - UUID of the note
   * @param tagId - UUID of the tag
   * @param metadata - Confidence and user_confirmed status
   */
  private async addTagToNote(
    noteId: string,
    tagId: string,
    metadata: { confidence: number; user_confirmed: boolean }
  ): Promise<void> {
    const noteTag: NoteTagInsert = {
      note_id: noteId,
      tag_id: tagId,
      confidence: metadata.confidence,
      user_confirmed: metadata.user_confirmed
    };

    // Use upsert to handle both insert and update
    const { error } = await this.supabase
      .from('z_note_tags')
      .upsert(noteTag, {
        onConflict: 'note_id,tag_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`[AutoTagService] Error adding tag ${tagId} to note ${noteId}:`, error);
      return;
    }

    // Update tag usage count
    await this.updateTagUsage(tagId);
  }

  /**
   * Update tag usage count and last_used_at timestamp
   * @param tagId - UUID of the tag
   */
  private async updateTagUsage(tagId: string): Promise<void> {
    const { error } = await this.supabase.rpc('increment_tag_usage', {
      tag_id_param: tagId
    });

    // If RPC doesn't exist yet, fall back to fetching current count and updating
    if (error && error.message?.includes('does not exist')) {
      // Fetch current tag to get usage_count
      const { data: tag } = await this.supabase
        .from('z_tags')
        .select('usage_count')
        .eq('id', tagId)
        .single();

      if (tag) {
        const { error: updateError } = await this.supabase
          .from('z_tags')
          .update({
            usage_count: tag.usage_count + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', tagId);

        if (updateError) {
          console.error(`[AutoTagService] Error updating tag usage for ${tagId}:`, updateError);
        }
      }
    } else if (error) {
      console.error(`[AutoTagService] Error calling increment_tag_usage RPC:`, error);
    }
  }

  /**
   * Ensure user has starter tags (calls database function)
   * @param userId - Telegram user ID
   * @returns Number of tags created
   */
  async ensureUserStarterTags(userId: number): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc('ensure_user_starter_tags', {
        user_id_param: userId
      });

      if (error) {
        console.error('[AutoTagService] Error ensuring starter tags:', error);
        return 0;
      }

      if (data > 0) {
        console.log(`[AutoTagService] Created ${data} starter tags for user ${userId}`);
      }

      return data || 0;
    } catch (error) {
      console.error('[AutoTagService] Error calling ensure_user_starter_tags:', error);
      return 0;
    }
  }

  /**
   * Update starter tags with emojis and score prompts
   * This should be called after ensure_user_starter_tags to populate the full prompts
   * @param userId - Telegram user ID
   */
  async updateStarterTagsPrompts(userId: number): Promise<void> {
    const STARTER_TAG_PROMPTS = {
      todo: {
        emoji: '📋',
        prompt: `You are a task detection AI. Analyze the content and score how likely it represents a TODO/task/action item.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- Task verbs (need, must, should, remind, fix, implement): +40
- Temporal indicators (tomorrow, deadline, by date): +30
- Urgency markers (important, urgent, ASAP): +20
- Checkbox format or action list: +10

Return ONLY an integer 0-100. No explanation.`
      },
      idea: {
        emoji: '💡',
        prompt: `You are an idea detection AI. Analyze the content and score how likely it represents a creative IDEA/concept/brainstorm.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- Explicit idea markers (idea:, what if, concept): +40
- Creative/speculative language (could build, imagine, new approach): +30
- Innovation terms (novel, creative, unique): +20
- Hypothetical scenarios (if we, suppose, consider): +10

Return ONLY an integer 0-100. No explanation.`
      },
      blog: {
        emoji: '📝',
        prompt: `You are a blog/article detection AI. Analyze the content and score how likely it contains blog posts or written articles.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- Known blog platforms (medium.com, dev.to, substack.com): +50
- URL path indicators (/blog/, /article/, /post/): +30
- Reading material mentions (article, blog post, wrote about): +15
- Content structure hints (long-form, tutorial): +5

Return ONLY an integer 0-100. No explanation.`
      },
      youtube: {
        emoji: '📺',
        prompt: `You are a video content detection AI. Analyze the content and score how likely it contains video/YouTube content.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- YouTube URL (youtube.com, youtu.be): +60
- Other video platforms (vimeo, twitch, loom): +50
- Video keywords (video, watch, tutorial, talk): +30
- Streaming/recording mentions (webinar, conference, recorded): +10

Return ONLY an integer 0-100. No explanation.`
      },
      reference: {
        emoji: '📚',
        prompt: `You are a reference/documentation detection AI. Analyze the content and score how likely it contains reference material or documentation.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- Official docs URLs (docs.*, api.*, developer.*): +50
- Documentation mentions (docs, API reference, manual): +30
- Knowledge bases (stackoverflow, wiki, MDN): +15
- Learning resources (guide, tutorial, how-to): +5

Return ONLY an integer 0-100. No explanation.`
      },
      japanese: {
        emoji: '🇯🇵',
        prompt: `You are a Japanese language study material detection AI. Analyze the content and score how likely it contains Japanese learning content.

CONTENT: "{content}"
URLS: {urls}

Score 0-100 based on:
- Contains hiragana or katakana: +50 (if 3+ chars: +60)
- Japanese learning site URLs (jisho.org, bunpro.jp, wanikani.com): +50
- Language keywords (Japanese, JLPT, kanji, grammar): +30
- Romanized Japanese in educational context: +20
- Learning context (study, vocabulary, syntax): +10

Special rules:
- If hiragana or katakana present: minimum score 85
- If 3+ Japanese kana/kanji characters: minimum score 95
- Mixed Japanese + English explanation: score 90-95

Return ONLY an integer 0-100. No explanation.`
      }
    };

    try {
      for (const [tagName, data] of Object.entries(STARTER_TAG_PROMPTS)) {
        const { error } = await this.supabase
          .from('z_tags')
          .update({
            emoji: data.emoji,
            score_prompt: data.prompt
          })
          .eq('created_by', userId)
          .eq('tag_name', tagName);

        if (error) {
          console.error(`[AutoTagService] Error updating ${tagName} tag:`, error);
        }
      }

      console.log(`[AutoTagService] Updated starter tag prompts for user ${userId}`);
    } catch (error) {
      console.error('[AutoTagService] Error updating starter tag prompts:', error);
    }
  }
}
