'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGlanceData } from '@/hooks/useGlanceData';
import { GlanceCard } from './GlanceCard';
import { ALL_CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABELS, type NoteCategory, type GlanceNote } from '@/constants/categories';

interface GlanceSectionProps {
  userId: number;
  onNoteClick?: (noteId: string) => void;
}

export function GlanceSection({ userId, onNoteClick }: GlanceSectionProps) {
  const router = useRouter();
  const { notes, loading, error } = useGlanceData(userId);

  // Group notes by category
  const notesByCategory = useMemo(() => {
    return notes.reduce((map, note) => {
      const categoryNotes = map.get(note.category) || [];
      categoryNotes.push(note);
      map.set(note.category, categoryNotes);
      return map;
    }, new Map<NoteCategory, GlanceNote[]>());
  }, [notes]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center animate-fade-in">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl gradient-accent animate-pulse" />
          <p className="text-ocean-300 text-sm font-medium">Loading glance view...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center bg-glass rounded-3xl p-8 border border-red-500/20 max-w-md animate-fade-in">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-ocean-100 font-semibold mb-2">Unable to load glance view</p>
          <p className="text-ocean-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with See All Button */}
      <div className="flex items-center justify-between animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-cyan-500 to-amber-500 rounded-full" />
          <h2 className="text-3xl font-bold text-white font-display">Quick Glance</h2>
        </div>
        <button
          onClick={() => router.push('/notes')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 text-ocean-100 font-medium hover:from-cyan-500/30 hover:to-amber-500/30 transition-all duration-200 text-sm flex items-center gap-2"
        >
          See All Notes
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid gap-6">
        {ALL_CATEGORIES.map((category, index) => {
          const categoryNotes = notesByCategory.get(category) || [];
          const emoji = CATEGORY_EMOJI[category];
          const label = CATEGORY_LABELS[category];

          return (
            <div
              key={category}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Category Header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{emoji}</span>
                <h3 className="text-xl font-bold text-white font-display">{label}</h3>
                <div className="flex-1 h-px bg-gradient-to-r from-ocean-700 via-ocean-800 to-transparent" />
                {categoryNotes.length > 0 && (
                  <span className="text-ocean-400 text-sm font-medium">
                    {categoryNotes.length} {categoryNotes.length === 1 ? 'note' : 'notes'}
                  </span>
                )}
              </div>

              {/* Notes Grid or Empty State */}
              {categoryNotes.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {categoryNotes.map((note) => (
                    <GlanceCard
                      key={note.note_id}
                      note={note}
                      onClick={() => onNoteClick?.(note.note_id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-ocean-900/30 rounded-2xl p-6 border border-ocean-800/50 text-center">
                  <p className="text-ocean-500 text-sm italic">No notes yet</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
