import { NoteCategory } from '../types/noteCategories';

/**
 * Category-specific prompts for 0-100 scoring system
 * Each category has its own specialized prompt that returns a single integer score
 */

export const CATEGORY_PROMPTS: Record<NoteCategory, (content: string, urls: string[]) => string> = {
  todo: (content: string, urls: string[]) => `You are a task detection AI. Analyze the content and score how likely it represents a TODO/task/action item.

CONTENT: "${content}"
URLS: ${urls.length > 0 ? urls.join(', ') : 'none'}

Score 0-100 based on:
- Task verbs (need, must, should, remind, fix, implement): +40
- Temporal indicators (tomorrow, deadline, by date): +30
- Urgency markers (important, urgent, ASAP): +20
- Checkbox format or action list: +10

Return ONLY an integer 0-100. No explanation.`,

  idea: (content: string, urls: string[]) => `You are an idea detection AI. Analyze the content and score how likely it represents a creative IDEA/concept/brainstorm.

CONTENT: "${content}"
URLS: ${urls.length > 0 ? urls.join(', ') : 'none'}

Score 0-100 based on:
- Explicit idea markers (idea:, what if, concept): +40
- Creative/speculative language (could build, imagine, new approach): +30
- Innovation terms (novel, creative, unique): +20
- Hypothetical scenarios (if we, suppose, consider): +10

Return ONLY an integer 0-100. No explanation.`,

  blog: (content: string, urls: string[]) => `You are a blog/article detection AI. Analyze the content and score how likely it contains blog posts or written articles.

CONTENT: "${content}"
URLS: ${urls.length > 0 ? urls.join(', ') : 'none'}

Score 0-100 based on:
- Known blog platforms (medium.com, dev.to, substack.com): +50
- URL path indicators (/blog/, /article/, /post/): +30
- Reading material mentions (article, blog post, wrote about): +15
- Content structure hints (long-form, tutorial): +5

Return ONLY an integer 0-100. No explanation.`,

  youtube: (content: string, urls: string[]) => `You are a video content detection AI. Analyze the content and score how likely it contains video/YouTube content.

CONTENT: "${content}"
URLS: ${urls.length > 0 ? urls.join(', ') : 'none'}

Score 0-100 based on:
- YouTube URL (youtube.com, youtu.be): +60
- Other video platforms (vimeo, twitch, loom): +50
- Video keywords (video, watch, tutorial, talk): +30
- Streaming/recording mentions (webinar, conference, recorded): +10

Return ONLY an integer 0-100. No explanation.`,

  reference: (content: string, urls: string[]) => `You are a reference/documentation detection AI. Analyze the content and score how likely it contains reference material or documentation.

CONTENT: "${content}"
URLS: ${urls.length > 0 ? urls.join(', ') : 'none'}

Score 0-100 based on:
- Official docs URLs (docs.*, api.*, developer.*): +50
- Documentation mentions (docs, API reference, manual): +30
- Knowledge bases (stackoverflow, wiki, MDN): +15
- Learning resources (guide, tutorial, how-to): +5

Return ONLY an integer 0-100. No explanation.`,

  japanese: (content: string, urls: string[]) => `You are a Japanese language study material detection AI. Analyze the content and score how likely it contains Japanese learning content.

CONTENT: "${content}"
URLS: ${urls.length > 0 ? urls.join(', ') : 'none'}

Score 0-100 based on:
- Contains hiragana (ぁ-ん) or katakana (ァ-ヶ): +50 (if 3+ chars: +60)
- Japanese learning site URLs (jisho.org, bunpro.jp, wanikani.com): +50
- Language keywords (Japanese, 日本語, JLPT, kanji, grammar): +30
- Romanized Japanese in educational context: +20
- Learning context (study, vocabulary, syntax): +10

Special rules:
- If hiragana or katakana present: minimum score 85
- If 3+ Japanese kana/kanji characters: minimum score 95
- Mixed Japanese + English explanation: score 90-95
- Pure Chinese text (only 一-龯 characters, no kana): score 0-30 (not Japanese)

IMPORTANT: Chinese and Japanese share many characters (kanji/hanzi). Only score high if:
1. Hiragana or katakana are present (definite Japanese), OR
2. Context clearly indicates Japanese learning (JLPT, Japanese grammar, etc.)

Return ONLY an integer 0-100. No explanation.`
};

/**
 * Japanese character regex patterns
 * Note: CJK characters (\u4E00-\u9FFF) include both Japanese kanji and Chinese characters
 * To distinguish Japanese from Chinese, we check for hiragana or katakana presence
 */
export const HIRAGANA_REGEX = /[\u3040-\u309F]/;
export const KATAKANA_REGEX = /[\u30A0-\u30FF]/;
export const CJK_REGEX = /[\u4E00-\u9FFF]/;
export const JAPANESE_CHAR_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g;

/**
 * Japanese learning site URL patterns (score 95-100)
 */
export const JAPANESE_LEARNING_DOMAINS = [
  'jisho.org',
  'bunpro.jp',
  'wanikani.com',
  'jpdb.io',
  'tangorin.com',
  'guidetojapanese.org',
  'nhk.or.jp/lesson'
];

/**
 * Blog platform URL patterns (score 95-100)
 */
export const BLOG_PLATFORM_DOMAINS = [
  'medium.com',
  'dev.to',
  'hashnode.dev',
  'substack.com',
  'ghost.io'
];

/**
 * Blog path indicators (score 85-95)
 */
export const BLOG_PATH_PATTERNS = [
  '/blog/',
  '/article/',
  '/post/',
  '/posts/'
];

/**
 * Video platform domains (score 95-100)
 */
export const VIDEO_PLATFORM_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'twitch.tv',
  'loom.com'
];

/**
 * Documentation site patterns (score 95-100)
 */
export const DOCUMENTATION_PATTERNS = [
  'docs.',
  'api.',
  'developer.',
  'reference.',
  'readthedocs.io',
  'github.com/',
  '/docs/'
];
