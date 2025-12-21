'use client';

import { NoteDetailLink } from '@telepocket/shared';
import Image from 'next/image';
import { useState } from 'react';

type LinkPreviewVariant = 'inline' | 'detailed' | 'thumbnail';

interface LinkPreviewCardProps {
  link: NoteDetailLink;
  variant?: LinkPreviewVariant;
  onClick?: () => void;
  className?: string;
}

export function LinkPreviewCard({
  link,
  variant = 'detailed',
  onClick,
  className = ''
}: LinkPreviewCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  // INLINE VARIANT - Notion/Slack style (large card for inline content)
  // Mobile: Vertical stack with compact image
  // Tablet+: Horizontal layout with larger image
  if (variant === 'inline') {
    return (
      <div
        onClick={handleClick}
        className={`group relative cursor-pointer bg-glass rounded-xl border border-ocean-700/30 hover:border-cyan-500/50 transition-all duration-300 overflow-hidden hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] ${className}`}
      >
        {/* External link icon - absolute positioned top-right on mobile, flex item on desktop */}
        <div className="absolute top-3 right-3 z-10 text-ocean-500 group-hover:text-cyan-400 transition-colors sm:hidden">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </div>

        {/* Mobile: Vertical stack, Tablet+: Horizontal flex */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:gap-4">
          {link.image_url && !imageError && (
            <div className="relative w-full h-48 sm:w-24 sm:h-24 md:w-32 md:h-32 sm:flex-shrink-0 bg-ocean-800/50 overflow-hidden">
              <Image
                src={link.image_url}
                alt={link.title || 'Link preview'}
                fill
                className={`object-cover transition-all duration-500 ${
                  imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                }`}
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 96px, 128px"
                loading="lazy"
                onError={() => setImageError(true)}
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          )}

          <div className="flex-1 min-w-0 p-4">
            {link.title && (
              <h4 className="text-ocean-100 font-semibold mb-1 group-hover:text-cyan-300 transition-colors line-clamp-2 animate-fade-in">
                {link.title}
              </h4>
            )}
            {link.description && (
              <p className="text-ocean-400 text-sm mb-2 line-clamp-2 animate-fade-in [animation-delay:50ms]">
                {link.description}
              </p>
            )}
            <p className="text-cyan-400 text-xs font-mono truncate animate-fade-in [animation-delay:100ms]">
              {link.url}
            </p>
          </div>

          {/* Desktop icon - hidden on mobile, visible on tablet+ */}
          <div className="hidden sm:block flex-shrink-0 p-4 text-ocean-500 group-hover:text-cyan-400 transition-colors">
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
      </div>
    );
  }

  // THUMBNAIL VARIANT - Compact preview for NoteCard
  // Horizontal layout with small image + title/description
  if (variant === 'thumbnail') {
    return (
      <div className="group flex items-start gap-2 p-2 rounded-lg bg-ocean-900/30 border border-ocean-700/30 hover:border-cyan-500/50 transition-all duration-200 w-full">
        {/* Image thumbnail */}
        <div className="relative w-10 h-10 flex-shrink-0 rounded-md overflow-hidden bg-ocean-800/50">
          {link.image_url && !imageError ? (
            <Image
              src={link.image_url}
              alt={link.title || 'Link preview'}
              fill
              className={`object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              sizes="40px"
              loading="lazy"
              onError={() => setImageError(true)}
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <span className="text-ocean-500 text-sm">🔗</span>
            </div>
          )}
        </div>

        {/* Title and description */}
        <div className="flex-1 min-w-0">
          {link.title && (
            <h5 className="text-ocean-100 font-medium text-[10px] leading-tight line-clamp-1 mb-0.5">
              {link.title}
            </h5>
          )}
          {link.description && (
            <p className="text-ocean-400 text-[9px] leading-snug line-clamp-1">
              {link.description}
            </p>
          )}
          {!link.title && !link.description && (
            <p className="text-ocean-400 text-[9px] leading-snug line-clamp-1">
              {link.url}
            </p>
          )}
        </div>

        {/* External link icon - subtle */}
        <div className="flex-shrink-0 text-ocean-500 group-hover:text-cyan-400 transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </div>
      </div>
    );
  }

  // DETAILED VARIANT - Enhanced NoteDetail cards
  // Mobile: Compact vertical with small image
  // Tablet+: Horizontal layout with medium image
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative block bg-ocean-900/30 rounded-xl border border-ocean-700/30 hover:border-cyan-500/50 transition-all duration-300 overflow-hidden hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] active:scale-[0.98] ${className}`}
    >
      {/* External link icon - absolute positioned top-right on mobile, flex item on desktop */}
      <div className="absolute top-3 right-3 z-10 text-ocean-500 group-hover:text-cyan-400 transition-colors sm:hidden">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </div>

      {/* Mobile: Vertical stack with compact spacing, Tablet+: Horizontal flex */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 sm:gap-4 sm:p-4">
        {link.image_url && !imageError && (
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-ocean-800/50">
            <Image
              src={link.image_url}
              alt={link.title || 'Link preview'}
              fill
              className={`object-cover transition-all duration-500 ${
                imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
              }`}
              sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, 96px"
              loading="lazy"
              onError={() => setImageError(true)}
              onLoad={() => setImageLoaded(true)}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {link.title && (
            <h4 className="text-ocean-100 font-semibold mb-1 text-sm sm:text-base group-hover:text-cyan-300 transition-colors line-clamp-2">
              {link.title}
            </h4>
          )}
          {link.description && (
            <p className="text-ocean-400 text-xs sm:text-sm mb-2 line-clamp-2">
              {link.description}
            </p>
          )}
          <p className="text-cyan-400 text-[10px] sm:text-xs font-mono truncate">
            {link.url}
          </p>
        </div>

        {/* Desktop icon - hidden on mobile, visible on tablet+ */}
        <div className="hidden sm:flex items-start flex-shrink-0 text-ocean-500 group-hover:text-cyan-400 transition-colors">
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
  );
}
