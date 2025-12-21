'use client';

import { NoteDetail, NoteDetailLink, CATEGORY_EMOJI, CATEGORY_LABELS } from '@telepocket/shared';
import { useRouter } from 'next/navigation';
import { PinToggleButton } from './PinToggleButton';
import { LinkPreviewCard } from '@/components/ui/LinkPreviewCard';

interface NoteCardProps {
  // Core data
  noteId: string;
  category: NoteDetail['category'];
  content: string;
  createdAt: string;

  // Metadata
  linkCount: number;
  imageCount: number;
  tags?: string[];  // NEW: Tag chips display
  linkPreviews?: NoteDetailLink[];  // NEW: Link preview thumbnails (optional)

  // Interactions
  onClick?: () => void;
  isMarked?: boolean;  // NEW: Pin state
  onPinToggle?: (noteId: string) => void;  // NEW: Pin callback

  // Display options
  previewLength?: number;  // Default 120, glance uses 30-60
  showCategory?: boolean;  // Default true
}

export function NoteCard({
  noteId,
  category,
  content,
  createdAt,
  linkCount,
  imageCount,
  tags,
  linkPreviews,
  onClick,
  isMarked = false,
  onPinToggle,
  previewLength = 80,
  showCategory = true
}: NoteCardProps) {
  const router = useRouter();

  const emoji = CATEGORY_EMOJI[category];
  const categoryLabel = CATEGORY_LABELS[category];

  // Format date - short format for compact previews
  const date = new Date(createdAt);
  const formattedDate = previewLength <= 60
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Truncate content to previewLength
  const truncatedContent = content.length > previewLength
    ? content.substring(0, previewLength) + '...'
    : content;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/notes/${noteId}`);
    }
  };

  const handlePinToggle = () => {
    if (onPinToggle) {
      onPinToggle(noteId);
    }
  };

  return (
    <article
      onClick={handleClick}
      className="group relative bg-glass rounded-2xl border border-ocean-700/30 p-3 cursor-pointer transition-all duration-300 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 animate-fade-in aspect-[2/3] flex flex-col"
      role="article"
      aria-label={`${categoryLabel} note from ${formattedDate}`}
    >
      {/* Pin toggle button (if onPinToggle provided) */}
      {onPinToggle && (
        <PinToggleButton
          noteId={noteId}
          isMarked={isMarked}
          onToggle={handlePinToggle}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        {/* Category Badge (conditional) */}
        {showCategory && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-cyan-500/10 to-amber-500/10 border border-cyan-500/20">
            <span className="text-base">{emoji}</span>
            <span className="text-ocean-100 font-medium text-[10px] tracking-wide">
              {categoryLabel}
            </span>
          </div>
        )}

        {/* Date */}
        <time
          dateTime={createdAt}
          className={`text-ocean-400 text-[10px] font-medium ${!showCategory ? 'ml-0' : ''}`}
        >
          {formattedDate}
        </time>
      </div>

      {/* Content Preview */}
      <p className="text-ocean-100 text-[11px] leading-relaxed mb-3 line-clamp-4 flex-grow">
        {truncatedContent}
      </p>

      {/* Link Preview Thumbnails */}
      {linkPreviews && linkPreviews.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          {linkPreviews.slice(0, 2).map((link, idx) => (
            <div
              key={idx}
              onClick={(e) => e.stopPropagation()}
            >
              <LinkPreviewCard link={link} variant="thumbnail" />
            </div>
          ))}
          {linkPreviews.length > 2 && (
            <div className="text-ocean-400 text-[9px] text-center py-0.5">
              +{linkPreviews.length - 2} more link{linkPreviews.length > 3 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Footer with Tags and Metadata */}
      <div className="flex items-center justify-between pt-2 border-t border-ocean-700/20 mt-auto">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tag Chips (compact) */}
          {tags && tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {tags.slice(0, 2).map((tag, index) => (
                <span
                  key={index}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/10 to-amber-500/10 border border-cyan-500/20"
                >
                  <span className="text-[10px]">🏷️</span>
                  <span className="text-ocean-100 text-[9px] font-medium">{tag}</span>
                </span>
              ))}
              {tags.length > 2 && (
                <span className="text-ocean-400 text-[9px]">+{tags.length - 2}</span>
              )}
            </div>
          )}

          {/* Link/Image Count Badges (compact, icon + number only) */}
          <div className="flex items-center gap-2 text-ocean-400 text-[10px]">
            {linkCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="text-[11px]">🔗</span>
                <span>{linkCount}</span>
              </span>
            )}
            {imageCount > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="text-[11px]">📷</span>
                <span>{imageCount}</span>
              </span>
            )}
          </div>
        </div>

        {/* Arrow indicator */}
        <div className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 ml-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </article>
  );
}
