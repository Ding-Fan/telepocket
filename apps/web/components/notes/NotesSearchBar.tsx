'use client';

import { useState, useRef, useEffect } from 'react';

interface NotesSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export function NotesSearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search notes...'
}: NotesSearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-expand if there's a value
  useEffect(() => {
    if (value) {
      setIsExpanded(true);
    }
  }, [value]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Handle Escape key to clear search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && value) {
        e.preventDefault();
        handleClear();
      }
    };

    if (isExpanded) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isExpanded, value]);

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    if (!value) {
      setIsExpanded(false);
    }
  };

  const handleClear = () => {
    onChange('');
    onClear();
    setIsExpanded(false);
  };

  return (
    <div className="mb-4">
      {!isExpanded ? (
        // Collapsed state - Search icon button
        <button
          onClick={handleExpand}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-glass border border-ocean-700/30 text-ocean-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-all duration-200 w-full"
          aria-label="Open search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span className="text-sm font-medium">Search notes...</span>
        </button>
      ) : (
        // Expanded state - Full search input
        <div className="flex items-center gap-2 animate-fade-in">
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={handleCollapse}
              placeholder={placeholder}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-glass border border-cyan-500/50 text-ocean-100 placeholder-ocean-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all duration-200"
            />
            {value && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ocean-400 hover:text-ocean-100 transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search hint */}
      {isExpanded && value && (
        <div className="mt-2 text-xs text-ocean-400 animate-fade-in">
          Press Esc to clear search
        </div>
      )}
    </div>
  );
}
