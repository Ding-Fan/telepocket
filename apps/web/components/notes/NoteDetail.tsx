'use client';

import { useState, useTransition } from 'react';
import { NoteDetail, NoteCategory, CATEGORY_EMOJI, CATEGORY_LABELS, ALL_CATEGORIES } from '@telepocket/shared';
import { confirmNoteCategory, unarchiveNote } from '@/actions/notes';
import { useRouter } from 'next/navigation';
import { CopyNoteButton } from '@/components/ui/CopyNoteButton';
import { useToast } from '@/components/ui/ToastProvider';
import { useArchiveNoteMutation } from '@/hooks/useArchiveNoteMutation';

interface NoteDetailProps {
  note: NoteDetail;
  onBack?: () => void;
}

// Utility function to detect and linkify URLs in text
function linkifyContent(text: string) {
  // URL detection regex pattern
  const urlPattern = /(https?:\/\/[^\s]+)/g;

  const parts = text.split(urlPattern);

  return parts.map((part, index) => {
    // If this part matches a URL pattern, make it a link
    if (part.match(urlPattern)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-400/30 hover:decoration-cyan-300 transition-colors"
        >
          {part}
        </a>
      );
    }
    // Otherwise, return the text as-is
    return part;
  });
}

export function NoteDetailComponent({ note, onBack }: NoteDetailProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirmedCategories, setConfirmedCategories] = useState<NoteCategory[]>(note.confirmed_categories);
  const [isArchived, setIsArchived] = useState(false);
  const archiveMutation = useArchiveNoteMutation();

  // Format dates
  const createdDate = new Date(note.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const updatedDate = new Date(note.updated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const emoji = CATEGORY_EMOJI[note.category];
  const categoryLabel = CATEGORY_LABELS[note.category];

  // Filter out confirmed categories from available options
  const availableCategories = ALL_CATEGORIES.filter(
    cat => !confirmedCategories.includes(cat)
  );

  // Handle category confirmation
  const handleCategoryClick = async (category: NoteCategory) => {
    startTransition(async () => {
      const result = await confirmNoteCategory(note.note_id, category, note.telegram_user_id);

      if (result.success) {
        // Update local state optimistically
        setConfirmedCategories([...confirmedCategories, category]);
        showToast(`✅ Tagged as ${CATEGORY_EMOJI[category]} ${CATEGORY_LABELS[category]}`, 'success');
      } else {
        showToast(`❌ Failed to tag category: ${result.error}`, 'error');
      }
    });
  };

  // Handle archive with undo functionality
  const handleArchive = async () => {
    // Set archived state immediately for smooth fade-out
    setIsArchived(true);

    // Archive note with mutation
    archiveMutation.mutate(
      {
        noteId: note.note_id,
        userId: note.telegram_user_id,
      },
      {
        onSuccess: () => {
          // Show success toast
          showToast('📦 Note archived - Click Undo to restore', 'success');
        },
        onError: (error) => {
          // Revert archived state on error
          setIsArchived(false);
          showToast(`❌ Failed to archive: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        },
      }
    );
  };

  // Handle undo archive
  const handleUndo = async () => {
    const result = await unarchiveNote(note.note_id, note.telegram_user_id);
    if (result.success) {
      setIsArchived(false);
      showToast('✅ Archive cancelled', 'success');
    } else {
      showToast(`❌ Failed to undo: ${result.error}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-ocean-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Action Buttons Row */}
        <div className="mb-6 flex items-center justify-between gap-4">
          {/* Back Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-ocean-300 hover:text-ocean-100 transition-colors duration-200 group"
            >
              <svg
                className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="font-medium">Back to Notes</span>
            </button>
          )}

          {/* Action Buttons Group */}
          <div className="flex items-center gap-3">
            {/* Copy Button */}
            <CopyNoteButton note={note} variant="default" />

            {/* Archive/Undo Button */}
            {isArchived ? (
              <button
                onClick={handleUndo}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/20 transition-all duration-200 animate-fade-in"
              >
                <span className="text-lg">↩️</span>
                <span className="font-medium">Undo Archive</span>
              </button>
            ) : (
              <button
                onClick={handleArchive}
                disabled={archiveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 hover:bg-amber-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-lg">📦</span>
                <span className="font-medium">
                  {archiveMutation.isPending ? 'Archiving...' : 'Archive'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-glass rounded-3xl border border-ocean-700/30 overflow-hidden animate-fade-in">
          {/* Header Section */}
          <div className="p-8 border-b border-ocean-700/30 relative overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-amber-500/5 pointer-events-none" />

            <div className="relative">
              {/* Category Badge */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-amber-500/10 border border-cyan-500/20">
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-ocean-100 font-semibold text-sm tracking-wide">{categoryLabel}</span>
                </div>
              </div>

              {/* Dates */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-ocean-400">Created:</span>
                  <span className="text-ocean-200 font-medium">{createdDate}</span>
                </div>
                {note.updated_at !== note.created_at && (
                  <div className="flex items-center gap-2">
                    <span className="text-ocean-400">Updated:</span>
                    <span className="text-ocean-200 font-medium">{updatedDate}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-8">
            <div className="prose prose-invert prose-ocean max-w-none">
              <div className="text-ocean-100 text-lg leading-relaxed whitespace-pre-wrap">
                {linkifyContent(note.content)}
              </div>
            </div>
          </div>

          {/* Category Selection Section */}
          {availableCategories.length > 0 && (
            <div className="px-8 pb-8">
              <div className="border-t border-ocean-700/30 pt-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-display">
                  <span className="text-cyan-400">🏷️</span>
                  Add Category Tags
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => handleCategoryClick(category)}
                      disabled={isPending}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-amber-500/10 border border-cyan-500/30 text-ocean-100 font-medium hover:from-cyan-500/20 hover:to-amber-500/20 hover:border-cyan-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-xl">{CATEGORY_EMOJI[category]}</span>
                      <span>{CATEGORY_LABELS[category]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Links Section */}
          {note.links.length > 0 && (
            <div className="px-8 pb-8">
              <div className="border-t border-ocean-700/30 pt-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 font-display">
                  <span className="text-cyan-400">🔗</span>
                  Links
                  <span className="text-ocean-400 text-sm font-normal">({note.links.length})</span>
                </h3>
                <div className="space-y-3">
                  {note.links.map((link) => (
                    <a
                      key={link.link_id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block bg-ocean-900/30 rounded-xl p-4 border border-ocean-700/30 hover:border-cyan-500/50 transition-all duration-300"
                    >
                      <div className="flex items-start gap-4">
                        {/* Link Image Preview */}
                        {link.image_url && (
                          <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-ocean-800/50">
                            <img
                              src={link.image_url}
                              alt={link.title || 'Link preview'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Link Content */}
                        <div className="flex-1 min-w-0">
                          {link.title && (
                            <h4 className="text-ocean-100 font-semibold mb-1 group-hover:text-cyan-300 transition-colors line-clamp-2">
                              {link.title}
                            </h4>
                          )}
                          {link.description && (
                            <p className="text-ocean-400 text-sm mb-2 line-clamp-2">
                              {link.description}
                            </p>
                          )}
                          <p className="text-cyan-400 text-xs font-mono truncate">
                            {link.url}
                          </p>
                        </div>

                        {/* External Link Icon */}
                        <div className="flex-shrink-0 text-ocean-500 group-hover:text-cyan-400 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Images Section */}
          {note.images.length > 0 && (
            <div className="px-8 pb-8">
              <div className="border-t border-ocean-700/30 pt-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 font-display">
                  <span className="text-amber-400">🖼️</span>
                  Images
                  <span className="text-ocean-400 text-sm font-normal">({note.images.length})</span>
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {note.images.map((image) => (
                    <div
                      key={image.image_id}
                      className="group relative rounded-xl overflow-hidden bg-ocean-900/30 border border-ocean-700/30 hover:border-amber-500/50 transition-all duration-300"
                    >
                      <img
                        src={image.file_path}
                        alt="Note attachment"
                        className="w-full h-auto"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ocean-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <p className="text-ocean-300 text-xs font-mono truncate">
                            {(image.file_size / 1024).toFixed(1)} KB • {image.mime_type}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
