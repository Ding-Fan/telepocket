'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';
import { AppLayout } from '@/components/layout/AppLayout';
import { NotesList } from '@/components/notes/NotesList';
import { NotesSearchBar } from '@/components/notes/NotesSearchBar';
import { useNotesSearch } from '@/hooks/useNotesSearch';
import { useNotesList } from '@/hooks/useNotesList';
import { NoteCard } from '@/components/notes/NoteCard';
import { NoteCategory, CATEGORY_EMOJI, CATEGORY_LABELS } from '@telepocket/shared';

export default function NotesPage() {
  const { user } = useTelegram();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // Get category from URL
  const categoryParam = searchParams.get('category') as NoteCategory | null;

  // Use search hook when query exists, otherwise use regular list
  const searchResults = useNotesSearch({
    userId: user?.id || 0,
    query: searchQuery,
    category: categoryParam
  });

  const regularNotes = useNotesList({
    userId: user?.id || 0,
    pageSize: 20,
    category: categoryParam
  });

  // Determine which data to display
  const isSearching = searchQuery.trim().length >= 2;

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleClearCategory = () => {
    router.push('/notes');
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-ocean-950 py-6 px-4">
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
                onChange={setSearchQuery}
                onClear={handleClearSearch}
              />

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
              {isSearching ? (
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
          ) : (
            <div className="text-center py-12">
              <p className="text-ocean-400">Loading user information...</p>
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
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-glass rounded-2xl border border-ocean-700/30 p-4 animate-pulse"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-6 w-24 bg-ocean-700/30 rounded-full"></div>
              <div className="h-4 w-20 bg-ocean-700/30 rounded"></div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-4 bg-ocean-700/30 rounded w-full"></div>
              <div className="h-4 bg-ocean-700/30 rounded w-5/6"></div>
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
      <div className="space-y-3">
        {results.map((note: any, index: number) => (
          <div
            key={note.note_id}
            style={{
              animationDelay: `${index * 50}ms`
            }}
          >
            <NoteCard
              noteId={note.note_id}
              category={note.category}
              content={note.note_content}
              createdAt={note.created_at}
              linkCount={note.links?.length || 0}
              imageCount={0}
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
