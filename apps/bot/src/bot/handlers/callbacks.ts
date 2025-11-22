import { Composer } from 'grammy';
import { config } from '../../config/environment';
import { validateSearchKeyword } from '../../utils/validation';
import { dbOps } from '../../database/operations';
import { handleClassifyAssignClick } from '../commands/classify';

export const callbackHandler = new Composer();

// Forward declare view functions - will be imported from legacy client until views are extracted
let showLinksPage: (ctx: any, userId: number, page: number) => Promise<void>;
let showSearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;
let showNotesPage: (ctx: any, userId: number, page: number) => Promise<void>;
let showNoteSearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;
let showLinksOnlyPage: (ctx: any, userId: number, page: number) => Promise<void>;
let showLinksOnlySearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;
let showNotesByCategory: (ctx: any, userId: number, category: string, page: number) => Promise<void>;
let showNoteDetail: (ctx: any, userId: number, noteId: string, returnPath: string) => Promise<void>;
let showSuggestView: (ctx: any, userId: number) => Promise<void>;
let showSuggestViewWithQuery: (ctx: any, userId: number, query: string) => Promise<void>;
let showDeleteConfirmation: (ctx: any, noteId: string, returnPath: string) => Promise<void>;
let deleteNoteAndReturn: (ctx: any, userId: number, noteId: string, returnPath: string) => Promise<void>;
let toggleNoteMarkAndRefresh: (ctx: any, userId: number, noteId: string, returnPath: string) => Promise<void>;
let showArchivedNotesPage: (ctx: any, userId: number, page: number) => Promise<void>;
let showArchivedNoteSearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;
let archiveNoteAndReturn: (ctx: any, userId: number, noteId: string, returnPath: string) => Promise<void>;
let unarchiveNoteAndReturn: (ctx: any, userId: number, noteId: string, returnPath: string) => Promise<void>;
let showUnifiedSearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;

/**
 * Initialize view function references
 * This is a temporary solution until view methods are extracted
 */
export function initCallbackHandlerViews(views: {
  showLinksPage: typeof showLinksPage;
  showSearchResults: typeof showSearchResults;
  showNotesPage: typeof showNotesPage;
  showNoteSearchResults: typeof showNoteSearchResults;
  showLinksOnlyPage: typeof showLinksOnlyPage;
  showLinksOnlySearchResults: typeof showLinksOnlySearchResults;
  showNotesByCategory: typeof showNotesByCategory;
  showNoteDetail: typeof showNoteDetail;
  showSuggestView: typeof showSuggestView;
  showSuggestViewWithQuery: typeof showSuggestViewWithQuery;
  showDeleteConfirmation: typeof showDeleteConfirmation;
  deleteNoteAndReturn: typeof deleteNoteAndReturn;
  toggleNoteMarkAndRefresh: typeof toggleNoteMarkAndRefresh;
  showArchivedNotesPage: typeof showArchivedNotesPage;
  showArchivedNoteSearchResults: typeof showArchivedNoteSearchResults;
  archiveNoteAndReturn: typeof archiveNoteAndReturn;
  unarchiveNoteAndReturn: typeof unarchiveNoteAndReturn;
  showUnifiedSearchResults: typeof showUnifiedSearchResults;
}) {
  showLinksPage = views.showLinksPage;
  showSearchResults = views.showSearchResults;
  showNotesPage = views.showNotesPage;
  showNoteSearchResults = views.showNoteSearchResults;
  showLinksOnlyPage = views.showLinksOnlyPage;
  showLinksOnlySearchResults = views.showLinksOnlySearchResults;
  showNotesByCategory = views.showNotesByCategory;
  showNoteDetail = views.showNoteDetail;
  showSuggestView = views.showSuggestView;
  showSuggestViewWithQuery = views.showSuggestViewWithQuery;
  showDeleteConfirmation = views.showDeleteConfirmation;
  deleteNoteAndReturn = views.deleteNoteAndReturn;
  toggleNoteMarkAndRefresh = views.toggleNoteMarkAndRefresh;
  showArchivedNotesPage = views.showArchivedNotesPage;
  showArchivedNoteSearchResults = views.showArchivedNoteSearchResults;
  archiveNoteAndReturn = views.archiveNoteAndReturn;
  unarchiveNoteAndReturn = views.unarchiveNoteAndReturn;
  showUnifiedSearchResults = views.showUnifiedSearchResults;
}

/**
 * Handle category button click from note detail view
 */
async function handleCategoryButtonClick(ctx: any, data: string): Promise<void> {
  try {
    // Parse callback data: category:noteId:categoryCode:returnPath
    const parts = data.split(':');
    if (parts.length < 3) {
      await ctx.answerCallbackQuery('❌ Invalid category data');
      return;
    }

    // Extract noteId and category code (always at positions 1 and 2)
    const noteId = parts[1];
    const categoryCode = parts[2];
    // returnPath at position 3 (base64url encoded)
    const encodedPath = parts[3];
    const returnPath = encodedPath
      ? Buffer.from(encodedPath, 'base64url').toString('utf-8')
      : '/notes/1';

    // Map short codes back to full category names
    const categoryMap: Record<string, string> = {
      'to': 'todo',
      'id': 'idea',
      'bl': 'blog',
      'yo': 'youtube',
      're': 'reference',
      'ja': 'japanese'
    };
    const category = categoryMap[categoryCode] || categoryCode;

    // Confirm the category in the database
    const success = await dbOps.confirmNoteCategory(noteId, category as any);

    if (!success) {
      await ctx.answerCallbackQuery('❌ Failed to save category');
      return;
    }

    // Import category constants dynamically to avoid circular deps
    const { CATEGORY_EMOJI, CATEGORY_LABELS } = await import('../../constants/noteCategories');
    const emoji = CATEGORY_EMOJI[category as keyof typeof CATEGORY_EMOJI];
    const label = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];

    // Answer with success message
    await ctx.answerCallbackQuery(`✅ Tagged as ${emoji} ${label}`);

    // Refresh the view to remove the confirmed category button
    const messageText = ctx.callbackQuery?.message?.text || '';
    if (messageText.includes('📝 Note Details')) {
      // Refresh detail view with proper return path
      await showNoteDetail(ctx, ctx.from!.id, noteId, returnPath);
    }
  } catch (error) {
    console.error('Error handling category button click:', error);
    await ctx.answerCallbackQuery('❌ An error occurred');
  }
}

/**
 * Callback query handler - routes all button clicks to appropriate handlers
 */
callbackHandler.on('callback_query', async (ctx) => {
  const startTime = Date.now();
  const data = ctx.callbackQuery.data;
  const userId = ctx.from?.id;
  console.log(`[Callback] ${data} started at ${new Date().toISOString()}`);

  try {
    if (!userId || !isAuthorizedUser(userId)) {
      await ctx.answerCallbackQuery('🚫 Unauthorized access.');
      return;
    }

    // Route to appropriate handler based on callback data pattern
    if (data?.startsWith('links_page_')) {
      const requestedPage = parseInt(data.replace('links_page_', ''));
      if (isNaN(requestedPage) || requestedPage < 1) {
        await ctx.answerCallbackQuery('❌ Invalid page number.');
        return;
      }
      await ctx.answerCallbackQuery();
      await showLinksPage(ctx, userId, requestedPage);

    } else if (data?.startsWith('search_page_')) {
      const parts = data.replace('search_page_', '').split('_');
      const requestedPage = parseInt(parts[0]);
      let keyword = decodeURIComponent(parts.slice(1).join('_'));

      if (isNaN(requestedPage) || requestedPage < 1) {
        await ctx.answerCallbackQuery('❌ Invalid page number.');
        return;
      }

      keyword = keyword.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim();
      const validation = validateSearchKeyword(keyword);
      if (!validation.valid) {
        await ctx.answerCallbackQuery(`❌ ${validation.error}`);
        return;
      }

      await ctx.answerCallbackQuery();
      await showSearchResults(ctx, userId, keyword, requestedPage);

    } else if (data?.startsWith('notes_page_')) {
      const requestedPage = parseInt(data.replace('notes_page_', ''));
      if (isNaN(requestedPage) || requestedPage < 1) {
        await ctx.answerCallbackQuery('❌ Invalid page number.');
        return;
      }
      await ctx.answerCallbackQuery();
      await showNotesPage(ctx, userId, requestedPage);

    } else if (data?.startsWith('notes_search_')) {
      const parts = data.replace('notes_search_', '').split('_');
      const requestedPage = parseInt(parts[0]);
      let keyword = decodeURIComponent(parts.slice(1).join('_'));

      if (isNaN(requestedPage) || requestedPage < 1) {
        await ctx.answerCallbackQuery('❌ Invalid page number.');
        return;
      }

      keyword = keyword.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim();
      const validation = validateSearchKeyword(keyword);
      if (!validation.valid) {
        await ctx.answerCallbackQuery(`❌ ${validation.error}`);
        return;
      }

      await ctx.answerCallbackQuery();
      await showNoteSearchResults(ctx, userId, keyword, requestedPage);

    } else if (data?.startsWith('links_only_page_')) {
      const requestedPage = parseInt(data.replace('links_only_page_', ''));
      if (isNaN(requestedPage) || requestedPage < 1) {
        await ctx.answerCallbackQuery('❌ Invalid page number.');
        return;
      }
      await ctx.answerCallbackQuery();
      await showLinksOnlyPage(ctx, userId, requestedPage);

    } else if (data?.startsWith('links_only_search_')) {
      const parts = data.replace('links_only_search_', '').split('_');
      const requestedPage = parseInt(parts[0]);
      const keyword = decodeURIComponent(parts.slice(1).join('_'));

      if (isNaN(requestedPage) || requestedPage < 1) {
        await ctx.answerCallbackQuery('❌ Invalid page number.');
        return;
      }

      if (!keyword || keyword.length < 1 || keyword.length > 100) {
        await ctx.answerCallbackQuery('❌ Invalid search keyword.');
        return;
      }

      await ctx.answerCallbackQuery();
      await showLinksOnlySearchResults(ctx, userId, keyword, requestedPage);

    } else if (data?.startsWith('category:')) {
      await handleCategoryButtonClick(ctx, data);

    } else if (data?.startsWith('category_page_')) {
      const parts = data.replace('category_page_', '').split('_');
      const category = parts[0];
      const requestedPage = parseInt(parts[1]);

      if (isNaN(requestedPage) || requestedPage < 1) {
        await ctx.answerCallbackQuery('❌ Invalid page number.');
        return;
      }

      await ctx.answerCallbackQuery();
      await showNotesByCategory(ctx, userId, category, requestedPage);

    } else if (data?.startsWith('detail:')) {
      const parts = data.split(':');
      const noteId = parts[1];
      // returnPath may contain colons (e.g., "/suggest/query/search"), so join remaining parts
      const returnPath = parts.slice(2).join(':');

      if (!noteId) {
        await ctx.answerCallbackQuery('❌ Invalid note ID.');
        return;
      }

      await ctx.answerCallbackQuery();
      await showNoteDetail(ctx, userId, noteId, returnPath);

    } else if (data?.startsWith('back:')) {
      // Generic back button - navigate to path
      const returnPath = data.substring(5); // Remove 'back:' prefix
      await ctx.answerCallbackQuery();

      // Import and use view router
      const { navigateToPath } = await import('../utils/viewRouter');
      const { telegramClient } = await import('../client');
      await navigateToPath(ctx, userId, returnPath, telegramClient.getViewFunctions());

    } else if (data?.startsWith('confirm_delete:')) {
      const parts = data.split(':');
      const noteId = parts[1];
      const returnPath = parts.slice(2).join(':');
      await ctx.answerCallbackQuery();
      await showDeleteConfirmation(ctx, noteId, returnPath);

    } else if (data?.startsWith('delete:')) {
      const parts = data.split(':');
      const noteId = parts[1];
      const returnPath = parts.slice(2).join(':');
      await deleteNoteAndReturn(ctx, userId, noteId, returnPath);
      await ctx.answerCallbackQuery('🗑️ Note deleted');

    } else if (data?.startsWith('cancel_delete:')) {
      const parts = data.split(':');
      const noteId = parts[1];
      const returnPath = parts.slice(2).join(':');
      await ctx.answerCallbackQuery('❌ Cancelled');
      await showNoteDetail(ctx, userId, noteId, returnPath);

    } else if (data?.startsWith('mark:')) {
      const parts = data.split(':');
      const noteId = parts[1];
      const returnPath = parts.slice(2).join(':');
      await ctx.answerCallbackQuery();
      await toggleNoteMarkAndRefresh(ctx, userId, noteId, returnPath);

    } else if (data?.startsWith('archived_page_')) {
      const requestedPage = parseInt(data.replace('archived_page_', ''));
      if (isNaN(requestedPage) || requestedPage < 1) {
        await ctx.answerCallbackQuery('❌ Invalid page number.');
        return;
      }
      await ctx.answerCallbackQuery();
      await showArchivedNotesPage(ctx, userId, requestedPage);

    } else if (data?.startsWith('archived_search_')) {
      const parts = data.replace('archived_search_', '').split('_');
      const requestedPage = parseInt(parts[0]);
      const keyword = decodeURIComponent(parts.slice(1).join('_'));

      if (isNaN(requestedPage) || requestedPage < 1) {
        await ctx.answerCallbackQuery('❌ Invalid page number.');
        return;
      }

      if (!keyword || keyword.length < 1 || keyword.length > 100) {
        await ctx.answerCallbackQuery('❌ Invalid search keyword.');
        return;
      }

      await ctx.answerCallbackQuery();
      await showArchivedNoteSearchResults(ctx, userId, keyword, requestedPage);

    } else if (data?.startsWith('archive:')) {
      const parts = data.split(':');
      const noteId = parts[1];
      const returnPath = parts.slice(2).join(':');
      await archiveNoteAndReturn(ctx, userId, noteId, returnPath);
      await ctx.answerCallbackQuery('📦 Note archived');

    } else if (data?.startsWith('unarchive:')) {
      const parts = data.split(':');
      const noteId = parts[1];
      const returnPath = parts.slice(2).join(':');
      await unarchiveNoteAndReturn(ctx, userId, noteId, returnPath);
      await ctx.answerCallbackQuery('📤 Note restored');

    } else if (data?.startsWith('unified_search_')) {
      const parts = data.replace('unified_search_', '').split('_');

      if (parts[0] === 'info') {
        await ctx.answerCallbackQuery();
        return;
      }

      const requestedPage = parseInt(parts[0]);
      const encodedKeyword = parts.slice(1).join('_');
      const keyword = decodeURIComponent(encodedKeyword);

      if (isNaN(requestedPage) || requestedPage < 1) {
        await ctx.answerCallbackQuery('❌ Invalid page number.');
        return;
      }

      const sanitizedKeyword = keyword.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim();
      const validation = validateSearchKeyword(sanitizedKeyword);
      if (!validation.valid) {
        await ctx.answerCallbackQuery(`❌ ${validation.error}`);
        return;
      }

      await ctx.answerCallbackQuery();
      await showUnifiedSearchResults(ctx, userId, sanitizedKeyword, requestedPage);

    } else if (data?.startsWith('ca:') || data?.startsWith('classify_assign:')) {
      // Handle classification assignment (delegate to classify command handler)
      await handleClassifyAssignClick(ctx, data);

    } else if (data === 'page_info' || data === 'search_info' || data === 'notes_page_info' ||
               data === 'notes_search_info' || data === 'links_only_page_info' ||
               data === 'links_only_search_info' || data === 'category_page_info' ||
               data === 'archived_page_info' || data === 'archived_search_info' ||
               data === 'unified_search_info') {
      // Handle page indicator click (non-functional, just acknowledge)
      await ctx.answerCallbackQuery('📄 Current page indicator');
    }

    // Log successful completion
    const duration = Date.now() - startTime;
    console.log(`[Callback] ${data} completed in ${duration}ms`);

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if this is a timeout error
    if (errorMessage.includes('query is too old')) {
      console.log(`[Callback] ${data} timed out after ${duration}ms (query too old)`);
      // Don't try to answer - it will fail anyway
      return;
    }

    console.error(`[Callback] ${data} failed after ${duration}ms:`, error);

    // Try to send error feedback
    try {
      await ctx.answerCallbackQuery('❌ An error occurred. Please try again.');
    } catch (answerError) {
      console.error('[Callback] Failed to send error feedback:', answerError);
    }
  }
});

/**
 * Check if user is authorized
 */
function isAuthorizedUser(userId: number): boolean {
  return userId === config.telegram.userId;
}
