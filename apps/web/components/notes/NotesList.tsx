'use client';

import { useState } from 'react';
import { NoteCard } from './NoteCard';
import { useNotesList } from '@/hooks/useNotesList';
import { NoteDetail, NoteCategory } from '@telepocket/shared';

interface NotesListProps {
  userId: number;
}

export function NotesList({ userId }: NotesListProps) {
  const [category, setCategory] = useState<NoteCategory | null>(null);
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');

  const { notes, loading, error, totalCount, hasMore, loadMore, refresh } = useNotesList({
    userId,
    category,
    status
  });

  // Loading state - First load
  if (loading && notes.length === 0) {
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
              <div className="h-4 bg-ocean-700/30 rounded w-4/6"></div>
            </div>
            <div className="pt-3 border-t border-ocean-700/20">
              <div className="h-3 bg-ocean-700/30 rounded w-32"></div>
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
        <p className="text-ocean-100 font-semibold mb-2">Unable to load notes</p>
        <p className="text-ocean-400 text-sm mb-4">{error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 text-ocean-100 font-medium hover:from-cyan-500/30 hover:to-amber-500/30 transition-all duration-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (notes.length === 0 && !loading) {
    return (
      <div className="text-center py-12 bg-glass rounded-2xl border border-ocean-700/30">
        <div className="text-6xl mb-4">🌊</div>
        <p className="text-ocean-100 font-semibold mb-2 text-lg">No notes found</p>
        <p className="text-ocean-400 text-sm mb-6">
          Start by creating your first note in the Telegram bot!
        </p>
      </div>
    );
  }

  // Notes list with cards
  return (
    <div>
      {/* Notes count */}
      {totalCount > 0 && (
        <div className="mb-4 text-sm text-ocean-400">
          Showing {notes.length} of {totalCount} notes
        </div>
      )}

      {/* Notes Grid */}
      <div className="space-y-3">
        {notes.map((note, index) => (
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
              imageCount={0} // Will be added when we fetch image data
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
              <>Load More ({totalCount - notes.length} remaining)</>
            )}
          </button>
        </div>
      )}

      {/* All loaded indicator */}
      {!hasMore && notes.length > 0 && (
        <div className="mt-6 text-center text-ocean-500 text-sm">
          ✓ All notes loaded
        </div>
      )}
    </div>
  );
}
