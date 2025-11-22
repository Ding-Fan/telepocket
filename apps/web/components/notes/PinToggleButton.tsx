'use client';

import { useState } from 'react';

interface PinToggleButtonProps {
  noteId: string;
  isMarked: boolean;
  onToggle: () => Promise<void>;
}

export function PinToggleButton({ noteId, isMarked, onToggle }: PinToggleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event

    if (isLoading) return;

    setIsLoading(true);
    try {
      await onToggle();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isMarked ? 'Unpin note' : 'Pin note'}
      className={`absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg backdrop-blur-sm border transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed group ${
        isMarked
          ? 'bg-cyan-500/20 border-cyan-500/50 hover:bg-cyan-500/30 hover:border-cyan-400'
          : 'bg-ocean-900/60 border-ocean-700/40 hover:bg-ocean-800/80 hover:border-ocean-600/50'
      }`}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={`w-4 h-4 transition-all duration-200 ${
            isMarked
              ? 'fill-cyan-400 drop-shadow-[0_0_4px_rgba(34,211,238,0.4)]'
              : 'fill-ocean-400 group-hover:fill-ocean-300'
          }`}
        >
          {isMarked ? (
            // Filled pin (pinned state)
            <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
          ) : (
            // Outline pin (unpinned state)
            <path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z" />
          )}
        </svg>
      )}
    </button>
  );
}
