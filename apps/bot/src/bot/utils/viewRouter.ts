/**
 * Path-based View Router
 *
 * This module provides a centralized routing system for bot navigation using
 * file-system-like paths. Each view is identified by a unique path, making
 * navigation stateless and self-documenting.
 *
 * Path Format Examples:
 * - /glance/                           -> Glance view
 * - /notes/1                           -> Notes page 1
 * - /category/tech/2                   -> Tech category page 2
 * - /search/keyword/3                  -> Search results page 3
 * - /suggest/                          -> Suggest view
 * - /suggest/query/searchTerm          -> Suggest with query
 * - /archived/1                        -> Archived notes page 1
 * - /archived_search/keyword/2         -> Archived search results page 2
 * - /unified_search/keyword/1          -> Unified search page 1
 */

/**
 * Parse and navigate to a view based on its path
 * This is the central routing function that all navigation goes through
 */
export async function navigateToPath(
  ctx: any,
  userId: number,
  path: string,
  viewFunctions: ViewFunctions
): Promise<void> {
  // Normalize path: remove leading/trailing slashes and split
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  const parts = normalizedPath.split('/').filter(Boolean);

  if (parts.length === 0) {
    // Empty path defaults to main menu
    await viewFunctions.showNotesPage(ctx, userId, 1);
    return;
  }

  const viewType = parts[0];

  try {
    switch (viewType) {
      case 'glance':
        await viewFunctions.showGlanceView(ctx, userId);
        break;

      case 'notes':
        const notesPage = parts[1] ? parseInt(parts[1]) : 1;
        if (isNaN(notesPage) || notesPage < 1) {
          throw new Error('Invalid page number');
        }
        await viewFunctions.showNotesPage(ctx, userId, notesPage);
        break;

      case 'category':
        const category = parts[1];
        const categoryPage = parts[2] ? parseInt(parts[2]) : 1;
        if (!category) {
          throw new Error('Missing category');
        }
        if (isNaN(categoryPage) || categoryPage < 1) {
          throw new Error('Invalid page number');
        }
        await viewFunctions.showNotesByCategory(ctx, userId, category, categoryPage);
        break;

      case 'search':
        const searchKeyword = parts[1] ? decodeURIComponent(parts[1]) : '';
        const searchPage = parts[2] ? parseInt(parts[2]) : 1;
        if (!searchKeyword) {
          throw new Error('Missing search keyword');
        }
        if (isNaN(searchPage) || searchPage < 1) {
          throw new Error('Invalid page number');
        }
        await viewFunctions.showNoteSearchResults(ctx, userId, searchKeyword, searchPage);
        break;

      case 'suggest':
        if (parts[1] === 'query' && parts[2]) {
          const query = decodeURIComponent(parts[2]);
          await viewFunctions.showSuggestViewWithQuery(ctx, userId, query);
        } else {
          await viewFunctions.showSuggestView(ctx, userId);
        }
        break;

      case 'archived':
        const archivedPage = parts[1] ? parseInt(parts[1]) : 1;
        if (isNaN(archivedPage) || archivedPage < 1) {
          throw new Error('Invalid page number');
        }
        await viewFunctions.showArchivedNotesPage(ctx, userId, archivedPage);
        break;

      case 'archived_search':
        const archivedSearchKeyword = parts[1] ? decodeURIComponent(parts[1]) : '';
        const archivedSearchPage = parts[2] ? parseInt(parts[2]) : 1;
        if (!archivedSearchKeyword) {
          throw new Error('Missing search keyword');
        }
        if (isNaN(archivedSearchPage) || archivedSearchPage < 1) {
          throw new Error('Invalid page number');
        }
        await viewFunctions.showArchivedNoteSearchResults(ctx, userId, archivedSearchKeyword, archivedSearchPage);
        break;

      case 'unified_search':
        const unifiedSearchKeyword = parts[1] ? decodeURIComponent(parts[1]) : '';
        const unifiedSearchPage = parts[2] ? parseInt(parts[2]) : 1;
        if (!unifiedSearchKeyword) {
          throw new Error('Missing search keyword');
        }
        if (isNaN(unifiedSearchPage) || unifiedSearchPage < 1) {
          throw new Error('Invalid page number');
        }
        await viewFunctions.showUnifiedSearchResults(ctx, userId, unifiedSearchKeyword, unifiedSearchPage);
        break;

      default:
        console.error(`Unknown view type: ${viewType}`);
        await viewFunctions.showNotesPage(ctx, userId, 1);
    }
  } catch (error) {
    console.error('Error navigating to path:', path, error);
    // Fallback to main view on error
    await viewFunctions.showNotesPage(ctx, userId, 1);
  }
}

/**
 * Build a path string from view parameters
 */
export function buildPath(viewType: string, ...params: (string | number)[]): string {
  const parts = [viewType, ...params.map(p => String(p))];
  return '/' + parts.join('/');
}

/**
 * Interface for all view functions that the router can call
 * This ensures type safety when routing
 */
export interface ViewFunctions {
  showGlanceView: (ctx: any, userId: number) => Promise<void>;
  showNotesPage: (ctx: any, userId: number, page: number) => Promise<void>;
  showNotesByCategory: (ctx: any, userId: number, category: string, page: number) => Promise<void>;
  showNoteSearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;
  showSuggestView: (ctx: any, userId: number) => Promise<void>;
  showSuggestViewWithQuery: (ctx: any, userId: number, query: string) => Promise<void>;
  showArchivedNotesPage: (ctx: any, userId: number, page: number) => Promise<void>;
  showArchivedNoteSearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;
  showUnifiedSearchResults: (ctx: any, userId: number, keyword: string, page: number) => Promise<void>;
}
