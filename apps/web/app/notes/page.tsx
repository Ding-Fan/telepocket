'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';
import { AppLayout } from '@/components/layout/AppLayout';
import { NotesList } from '@/components/notes/NotesList';
import { NotesSearchBar } from '@/components/notes/NotesSearchBar';
import { useNotesSearch } from '@/hooks/useNotesSearch';
import { useNotesList } from '@/hooks/useNotesList';
import { NoteCardV2 } from '@/components/notes/NoteCardV2';
import { NoteCategory, CATEGORY_EMOJI, CATEGORY_LABELS } from '@telepocket/shared';
import { generateTodosFromNotesAndSave } from '@/actions/generateTodos';

export default function NotesPage() {
  const { user, isReady } = useTelegram();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [authTimeout, setAuthTimeout] = useState(false);

  // Get search query and category from URL
  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') as NoteCategory | null;

  // Local state synced with URL
  const [searchQuery, setSearchQuery] = useState(queryParam);

  // Todo generation state
  const [isGeneratingTodo, setIsGeneratingTodo] = useState(false);
  const [todoGenerationError, setTodoGenerationError] = useState<string | null>(null);
  const [lastGenerationTime, setLastGenerationTime] = useState<number>(0);

  // Sync local state with URL params when they change
  useEffect(() => {
    setSearchQuery(queryParam);
  }, [queryParam]);

  // Set timeout for authentication (3 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user) {
        setAuthTimeout(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [user]);

  // === SCROLL RESTORATION USING HISTORY API ===
  // Save scroll position to browser history state (survives navigation)
  useEffect(() => {
    let scrollTimer: NodeJS.Timeout;

    const handleScroll = () => {
      // Debounce scroll saves to avoid excessive history writes
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const currentState = window.history.state || {};
        window.history.replaceState(
          { ...currentState, scrollPos: window.scrollY },
          ''
        );
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(scrollTimer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Save scroll position immediately when clicking a note card
  useEffect(() => {
    const handleNoteCardClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const noteCard = target.closest('[role="article"]');
      if (noteCard) {
        // Save immediately to history state (bypass debounce)
        const currentState = window.history.state || {};
        window.history.replaceState(
          { ...currentState, scrollPos: window.scrollY },
          ''
        );
      }
    };

    document.addEventListener('click', handleNoteCardClick, true);
    return () => document.removeEventListener('click', handleNoteCardClick, true);
  }, []);

  // Restore scroll position on popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const scrollPos = window.history.state?.scrollPos;
      if (scrollPos !== undefined) {
        // Use double requestAnimationFrame to run AFTER Next.js scroll restoration
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo(0, scrollPos);
          });
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Also restore on mount (for initial page load with history state)
  useLayoutEffect(() => {
    const scrollPos = window.history.state?.scrollPos;
    if (scrollPos !== undefined) {
      // Multiple attempts with increasing delays to ensure we override Next.js
      const attempts = [0, 100, 300];
      attempts.forEach((delay) => {
        setTimeout(() => {
          requestAnimationFrame(() => {
            window.scrollTo(0, scrollPos);
          });
        }, delay);
      });
    }
  }, []);

  // Use search hook when query exists, otherwise use regular list
  const searchResults = useNotesSearch({
    userId: user?.id || 0,
    query: searchQuery,
    category: categoryParam
  });

  const regularNotes = useNotesList({
    userId: user?.id || 0,
    pageSize: 60,
    category: categoryParam
  });

  // Determine which data to display
  const isSearching = searchQuery.trim().length >= 2;

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    // Update URL with search query
    const params = new URLSearchParams(searchParams.toString());

    if (value.trim().length >= 2) {
      params.set('q', value);
    } else {
      params.delete('q');
    }

    // Preserve category filter
    if (categoryParam) {
      params.set('category', categoryParam);
    }

    const newUrl = params.toString() ? `/notes?${params.toString()}` : '/notes';
    router.replace(newUrl, { scroll: false });
  };

  const handleClearSearch = () => {
    setSearchQuery('');

    // Remove search query from URL, preserve category
    const params = new URLSearchParams();
    if (categoryParam) {
      params.set('category', categoryParam);
    }

    const newUrl = params.toString() ? `/notes?${params.toString()}` : '/notes';
    router.replace(newUrl, { scroll: false });
  };

  const handleClearCategory = () => {
    // Remove category, preserve search query
    const params = new URLSearchParams();
    if (searchQuery.trim().length >= 2) {
      params.set('q', searchQuery);
    }

    const newUrl = params.toString() ? `/notes?${params.toString()}` : '/notes';
    router.replace(newUrl, { scroll: false });
  };

  const handleTodoGeneration = async () => {
    if (!user?.id) {
      alert('Please log in to generate todos');
      return;
    }

    // Rate limiting: 5 second cooldown
    const now = Date.now();
    if (now - lastGenerationTime < 5000) {
      setTodoGenerationError('Please wait a moment before generating again');
      return;
    }
    setLastGenerationTime(now);

    setIsGeneratingTodo(true);
    setTodoGenerationError(null);

    try {
      const result = await generateTodosFromNotesAndSave(user.id);

      if (!result.success) {
        setTodoGenerationError(result.error || 'Failed to generate todos');
        return;
      }

      // Success! Redirect to the generated note
      if (result.noteId) {
        setSearchQuery('');
        router.push(`/notes/${result.noteId}`);
      }
    } catch (error) {
      console.error('Todo generation error:', error);
      setTodoGenerationError('An unexpected error occurred. Please try again.');
    } finally {
      setIsGeneratingTodo(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-ocean-950 py-6 px-2 md:px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">All Notes</h1>
            <p className="text-ocean-300 text-sm">
              {isSearching
                ? `Search results for "${searchQuery}"`
                : categoryParam
                ? `Showing ${CATEGORY_LABELS[categoryParam]} notes`
                : 'Browse and manage your notes'}
            </p>
          </div>

          {user ? (
            <>
              {/* Search Bar */}
              <NotesSearchBar
                value={searchQuery}
                onChange={handleSearchChange}
                onClear={handleClearSearch}
                userId={user.telegram_user_id}
              />

              {/* Generate Todos Button */}
              <div className="mb-4">
                <button
                  onClick={handleTodoGeneration}
                  disabled={isGeneratingTodo || !user?.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-amber-500/10 border border-cyan-500/30 text-ocean-100 font-medium hover:from-cyan-500/20 hover:to-amber-500/20 hover:border-cyan-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-xl">🤖</span>
                  <span>Generate Todos from Notes</span>
                  {!isGeneratingTodo && regularNotes.notes.length > 0 && (
                    <span className="text-ocean-400 text-sm">({regularNotes.notes.length} notes)</span>
                  )}
                </button>
              </div>

              {/* Category Filter Chip */}
              {categoryParam && (
                <div className="mb-4">
                  <button
                    onClick={handleClearCategory}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 text-ocean-100 font-medium hover:from-cyan-500/30 hover:to-amber-500/30 transition-all duration-200 text-sm group"
                  >
                    <span className="text-lg">{CATEGORY_EMOJI[categoryParam]}</span>
                    <span>{CATEGORY_LABELS[categoryParam]}</span>
                    <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Results */}
              {isGeneratingTodo ? (
                // Loading state for todo generation
                <div className="text-center py-12 bg-glass rounded-2xl border border-cyan-500/30">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-amber-500/20 flex items-center justify-center animate-pulse">
                    <span className="text-4xl">🤖</span>
                  </div>
                  <p className="text-ocean-100 font-semibold mb-2 text-lg">
                    Generating todos from your notes...
                  </p>
                  <p className="text-ocean-400 text-sm">
                    AI is analyzing your recent notes • This may take a few seconds
                  </p>
                </div>
              ) : todoGenerationError ? (
                // Error state for todo generation
                <div className="text-center py-12 bg-glass rounded-2xl border border-red-500/20">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <p className="text-ocean-100 font-semibold mb-2">Todo generation failed</p>
                  <p className="text-ocean-400 text-sm mb-4">{todoGenerationError}</p>
                  <button
                    onClick={() => {
                      setTodoGenerationError(null);
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 rounded-xl bg-glass border border-ocean-700/30 text-ocean-100 hover:border-cyan-500/50 transition-all duration-200"
                  >
                    Dismiss
                  </button>
                </div>
              ) : isSearching ? (
                // Search Results
                <SearchResults
                  results={searchResults.results}
                  loading={searchResults.loading}
                  error={searchResults.error}
                  totalCount={searchResults.totalCount}
                  hasMore={searchResults.hasMore}
                  loadMore={searchResults.loadMore}
                  query={searchQuery}
                />
              ) : (
                // Regular Notes List
                <NotesList userId={user.id} category={categoryParam} />
              )}
            </>
          ) : authTimeout ? (
            // Authentication timeout - show error with retry
            <div className="text-center py-12 bg-glass rounded-2xl border border-red-500/20">
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <p className="text-ocean-100 font-semibold mb-2">Authentication failed</p>
              <p className="text-ocean-400 text-sm mb-4">
                Please open this page from Telegram app
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 text-ocean-100 font-medium hover:from-cyan-500/30 hover:to-amber-500/30 transition-all duration-200"
              >
                Retry
              </button>
            </div>
          ) : (
            // Loading state
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-amber-500/20 flex items-center justify-center animate-pulse">
                <span className="text-4xl">🔐</span>
              </div>
              <p className="text-ocean-100 font-semibold mb-2">Authenticating...</p>
              <p className="text-ocean-400 text-sm">Verifying your Telegram identity</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// Search Results Component
function SearchResults({
  results,
  loading,
  error,
  totalCount,
  hasMore,
  loadMore,
  query
}: any) {
  // Loading state - First load
  if (loading && results.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-glass rounded-2xl border border-ocean-700/30 p-3 animate-pulse aspect-[2/3] flex flex-col"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="h-5 w-16 bg-ocean-700/30 rounded-full"></div>
              <div className="h-3 w-14 bg-ocean-700/30 rounded"></div>
            </div>
            <div className="space-y-1.5 mb-3 flex-grow">
              <div className="h-3 bg-ocean-700/30 rounded w-full"></div>
              <div className="h-3 bg-ocean-700/30 rounded w-5/6"></div>
              <div className="h-3 bg-ocean-700/30 rounded w-4/6"></div>
            </div>
            <div className="pt-2 border-t border-ocean-700/20 mt-auto">
              <div className="h-2.5 bg-ocean-700/30 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12 bg-glass rounded-2xl border border-red-500/20">
        <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <p className="text-ocean-100 font-semibold mb-2">Search failed</p>
        <p className="text-ocean-400 text-sm">{error}</p>
      </div>
    );
  }

  // Empty search results
  if (results.length === 0 && !loading) {
    return (
      <div className="text-center py-12 bg-glass rounded-2xl border border-ocean-700/30">
        <div className="text-6xl mb-4">🔍</div>
        <p className="text-ocean-100 font-semibold mb-2 text-lg">
          No results for "{query}"
        </p>
        <p className="text-ocean-400 text-sm">
          Try different keywords or check your spelling
        </p>
      </div>
    );
  }

  // Search results with cards
  return (
    <div>
      {/* Results count */}
      {totalCount > 0 && (
        <div className="mb-4 text-sm text-ocean-400">
          Found {totalCount} {totalCount === 1 ? 'result' : 'results'}
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {results.map((note: any, index: number) => (
          <div
            key={note.id}
            style={{
              animationDelay: `${index * 50}ms`
            }}
          >
            <NoteCardV2
              noteId={note.id}
              content={note.content}
              createdAt={note.created_at}
              tags={note.tags}
              links={note.links?.map((link: any) => ({
                id: link.id,
                url: link.url,
                title: link.title,
                description: null,
                image_url: null
              }))}
            />
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 text-ocean-100 font-medium hover:from-cyan-500/30 hover:to-amber-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Loading...
              </span>
            ) : (
              <>Load More ({totalCount - results.length} remaining)</>
            )}
          </button>
        </div>
      )}

      {/* All loaded indicator */}
      {!hasMore && results.length > 0 && (
        <div className="mt-6 text-center text-ocean-500 text-sm">
          ✓ All results loaded
        </div>
      )}
    </div>
  );
}
