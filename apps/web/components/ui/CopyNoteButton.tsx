'use client';

import { Copy, Loader2 } from 'lucide-react';
import { NoteDetail } from '@telepocket/shared';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { formatNoteAsMarkdown } from '@/utils/formatNoteAsMarkdown';

export interface CopyNoteButtonProps {
  note: NoteDetail;
  variant?: 'default' | 'icon-only';
  className?: string;
}

export function CopyNoteButton({ note, variant = 'default', className = '' }: CopyNoteButtonProps) {
  const { copyToClipboard, isCopying } = useCopyToClipboard();

  const handleCopy = async () => {
    const markdown = formatNoteAsMarkdown(note);
    await copyToClipboard(markdown);
  };

  if (variant === 'icon-only') {
    return (
      <button
        onClick={handleCopy}
        disabled={isCopying}
        className={`
          p-2 rounded-lg
          bg-cyan-500/10 border border-cyan-500/30 text-cyan-200
          hover:bg-cyan-500/20 hover:border-cyan-500/40
          active:bg-cyan-500/30
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        aria-label="Copy note"
        title="Copy note"
      >
        {isCopying ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      disabled={isCopying}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-xl
        bg-cyan-500/10 border border-cyan-500/30 text-cyan-200
        hover:bg-cyan-500/20 hover:border-cyan-500/40
        active:bg-cyan-500/30
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        font-medium
        ${className}
      `}
      aria-label="Copy note to clipboard"
    >
      {isCopying ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Copying...</span>
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          <span>Copy Note</span>
        </>
      )}
    </button>
  );
}
