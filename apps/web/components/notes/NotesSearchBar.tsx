'use client';

import { useState, useRef, useEffect } from 'react';
import { getSearchHistory, clearSearchHistory } from '@/actions/notes';

interface NotesSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  userId: number;
}

export function NotesSearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search notes...',
  userId
}: NotesSearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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

  // Fetch history on focus
  const handleFocus = async () => {
    setShowHistory(true);

    if (searchHistory.length === 0 && !isLoadingHistory) {
      setIsLoadingHistory(true);
      const { searches } = await getSearchHistory(userId);
      setSearchHistory(searches);
      setIsLoadingHistory(false);
    }
  };

  // Handle history item click
  const handleHistoryClick = (query: string) => {
    onChange(query);
    setShowHistory(false);
  };

  // Handle clear history
  const handleClearHistory = async () => {
    const result = await clearSearchHistory(userId);
    if (result.success) {
      setSearchHistory([]);
    }
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setShowHistory(false);
      }
    };

    if (showHistory) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showHistory]);

  return (
    <div ref={containerRef} className="relative mb-4">
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
              onFocus={handleFocus}
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

      {/* Search History Dropdown */}
      {showHistory && searchHistory.length > 0 && value.trim().length < 2 && (
        <div
          className="absolute top-full left-0 right-0 mt-2 bg-glass rounded-xl border border-ocean-700/30 overflow-hidden z-50 animate-scale-in"
          style={{
            backdropFilter: 'blur(12px)',
            background: 'rgba(15, 23, 41, 0.95)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-ocean-700/30">
            <span className="text-xs text-ocean-400 font-medium">Recent Searches</span>
            <button
              onClick={handleClearHistory}
              className="text-xs text-ocean-500 hover:text-ocean-300 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* History Items */}
          <div className="max-h-64 overflow-y-auto">
            {searchHistory.map((query, index) => (
              <button
                key={index}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleHistoryClick(query);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-ocean-100 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-amber-500/10 transition-all duration-200 flex items-center gap-3 group"
              >
                {/* Clock icon */}
                <svg className="w-4 h-4 text-ocean-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>

                {/* Query text */}
                <span className="flex-1 truncate">{query}</span>

                {/* Arrow icon */}
                <svg className="w-4 h-4 text-ocean-600 group-hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search hint */}
      {isExpanded && (
        <div className="mt-2 text-xs text-ocean-400 animate-fade-in flex justify-between items-center">
          <span>Try: "todo" (AI todos), "latest idea", "help find job"</span>
          {value && <span>Press Esc to clear</span>}
        </div>
      )}
    </div>
  );
}
