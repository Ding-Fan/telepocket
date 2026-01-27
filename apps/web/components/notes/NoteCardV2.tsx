'use client';

import { useRouter } from 'next/navigation';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { LinkPreviewCard } from '@/components/ui/LinkPreviewCard';

interface NoteCardLink {
  id: string;
  url: string;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
}

interface NoteCardV2Props {
  // Core data
  noteId: string;
  content: string;
  createdAt: string;
  tags?: string[];  // Confirmed tags only
  links?: NoteCardLink[];
  maxLinks?: number;  // Default: 2

  // Interactions
  onClick?: () => void;

  // Display options
  previewLength?: number;  // Default: 180 characters
  maxTags?: number;  // Default: 3
}

export function NoteCardV2({
  noteId,
  content,
  createdAt,
  tags = [],
  links = [],
  maxLinks = 2,
  onClick,
  previewLength = 180,
  maxTags = 3
}: NoteCardV2Props) {
  const router = useRouter();
  const { copyToClipboard, isCopying } = useCopyToClipboard();

  // Auto-detect dark mode from system preference
  const isDarkMode = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;

  // Format date
  const date = new Date(createdAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Truncate content to previewLength
  const truncatedContent = content.length > previewLength
    ? content.substring(0, previewLength) + '...'
    : content;

  // Parse content and linkify URLs
  const renderContent = () => {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const parts = truncatedContent.split(urlPattern);

    return parts.map((part, index) => {
      if (part.match(urlPattern)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={isDarkMode
              ? 'text-blue-400 hover:text-blue-300 underline decoration-blue-400/30 hover:decoration-blue-300'
              : 'text-blue-600 hover:text-blue-700 underline decoration-blue-600/30 hover:decoration-blue-700'
            }
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // Get visible tags and remaining count
  const visibleTags = tags.slice(0, maxTags);
  const remainingTagsCount = tags.length - maxTags;

  // Get visible links and apply max limit
  const visibleLinks = (links || []).slice(0, maxLinks);

  // Handle card click
  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/notes/${noteId}`);
    }
  };

  // Handle copy button click
  const handleCopyClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    await copyToClipboard(content);
  };

  // Handle view button click (same as card click, but explicit)
  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent double trigger
    handleCardClick();
  };

  // Base classes for light/dark mode
  const cardClasses = isDarkMode
    ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
    : 'bg-white border-gray-200 hover:border-gray-300';

  const textPrimaryClasses = isDarkMode ? 'text-gray-50' : 'text-gray-900';
  const textSecondaryClasses = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const tagClasses = isDarkMode
    ? 'bg-gray-700 text-gray-300'
    : 'bg-gray-100 text-gray-700';
  const buttonClasses = isDarkMode
    ? 'text-blue-400 hover:text-blue-300 hover:bg-gray-700'
    : 'text-blue-500 hover:text-blue-600 hover:bg-gray-50';

  return (
    <article
      onClick={handleCardClick}
      className={`
        ${cardClasses}
        border rounded-lg p-3
        cursor-pointer
        transition-all duration-200
        flex flex-col gap-2.5
        min-w-[280px]
      `}
      role="article"
      aria-label={`Note from ${formattedDate}`}
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}
    >
      {/* Content Preview */}
      <div className={`${textPrimaryClasses} text-sm leading-normal whitespace-pre-wrap`}>
        {renderContent()}
      </div>

      {/* Link Previews */}
      {visibleLinks.length > 0 && (
        <div className="flex flex-col gap-2">
          {visibleLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block"
            >
              <LinkPreviewCard
                link={{
                  link_id: link.id,
                  note_id: noteId,
                  url: link.url,
                  title: link.title ?? null,
                  description: link.description ?? null,
                  image_url: link.image_url ?? null,
                  created_at: ''
                }}
                variant="thumbnail"
              />
            </a>
          ))}
        </div>
      )}

      {/* Tags Row */}
      {visibleTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {visibleTags.map((tag, index) => (
            <span
              key={index}
              className={`
                ${tagClasses}
                inline-flex items-center gap-1
                px-2 py-0.5
                rounded-full
                text-xs font-medium
              `}
            >
              <span>🏷️</span>
              <span>{tag}</span>
            </span>
          ))}
          {remainingTagsCount > 0 && (
            <span className={`${textSecondaryClasses} text-xs`}>
              +{remainingTagsCount} more
            </span>
          )}
        </div>
      )}

      {/* Footer Row */}
      <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-current border-opacity-10">
        {/* Date */}
        <time
          dateTime={createdAt}
          className={`${textSecondaryClasses} text-xs font-normal`}
        >
          {formattedDate}
        </time>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Copy Button */}
          <button
            onClick={handleCopyClick}
            disabled={isCopying}
            className={`
              ${buttonClasses}
              px-2.5 py-1
              rounded-md
              text-xs font-medium
              transition-colors duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            aria-label="Copy note content"
          >
            {isCopying ? 'Copying...' : 'Copy'}
          </button>

          {/* View Button */}
          <button
            onClick={handleViewClick}
            className={`
              ${buttonClasses}
              px-2.5 py-1
              rounded-md
              text-xs font-medium
              transition-colors duration-200
              flex items-center gap-0.5
            `}
            aria-label="View note details"
          >
            <span>View</span>
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
