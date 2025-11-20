'use client';

import { NoteCategory, CATEGORY_EMOJI, CATEGORY_LABELS } from '@/constants/categories';
import { useRouter } from 'next/navigation';

interface NoteCardProps {
  noteId: string;
  category: NoteCategory;
  content: string;
  createdAt: string;
  linkCount: number;
  imageCount: number;
  onClick?: () => void;
}

export function NoteCard({
  noteId,
  category,
  content,
  createdAt,
  linkCount,
  imageCount,
  onClick
}: NoteCardProps) {
  const router = useRouter();

  const emoji = CATEGORY_EMOJI[category];
  const categoryLabel = CATEGORY_LABELS[category];

  // Format date
  const date = new Date(createdAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Truncate content to 3 lines
  const truncatedContent = content.length > 120
    ? content.substring(0, 120) + '...'
    : content;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/notes/${noteId}`);
    }
  };

  return (
    <article
      onClick={handleClick}
      className="group bg-glass rounded-2xl border border-ocean-700/30 p-4 cursor-pointer transition-all duration-300 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 animate-fade-in"
      role="article"
      aria-label={`${categoryLabel} note from ${formattedDate}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        {/* Category Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/10 to-amber-500/10 border border-cyan-500/20">
          <span className="text-lg">{emoji}</span>
          <span className="text-ocean-100 font-medium text-xs tracking-wide">
            {categoryLabel}
          </span>
        </div>

        {/* Date */}
        <time
          dateTime={createdAt}
          className="text-ocean-400 text-xs font-medium"
        >
          {formattedDate}
        </time>
      </div>

      {/* Content Preview */}
      <p className="text-ocean-100 text-sm leading-relaxed mb-4 line-clamp-3">
        {truncatedContent}
      </p>

      {/* Footer with Metadata */}
      <div className="flex items-center justify-between pt-3 border-t border-ocean-700/20">
        <div className="flex items-center gap-4 text-ocean-400 text-xs">
          {linkCount > 0 && (
            <span className="flex items-center gap-1">
              <span>🔗</span>
              <span>{linkCount} {linkCount === 1 ? 'link' : 'links'}</span>
            </span>
          )}
          {imageCount > 0 && (
            <span className="flex items-center gap-1">
              <span>📷</span>
              <span>{imageCount} {imageCount === 1 ? 'image' : 'images'}</span>
            </span>
          )}
          {linkCount === 0 && imageCount === 0 && (
            <span className="text-ocean-500">No attachments</span>
          )}
        </div>

        {/* Arrow indicator */}
        <div className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </article>
  );
}
