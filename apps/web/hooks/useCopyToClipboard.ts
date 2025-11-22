'use client';

import { useState, useCallback } from 'react';
import copy from 'copy-to-clipboard';
import { useToast } from '@/components/ui/ToastProvider';

export interface UseCopyToClipboardReturn {
  copyToClipboard: (text: string) => Promise<boolean>;
  isCopying: boolean;
}

export function useCopyToClipboard(): UseCopyToClipboardReturn {
  const [isCopying, setIsCopying] = useState(false);
  const { showToast } = useToast();

  const copyToClipboard = useCallback(
    async (text: string): Promise<boolean> => {
      setIsCopying(true);

      try {
        // Use copy-to-clipboard library for better browser compatibility
        const success = copy(text, {
          debug: false,
          message: 'Press #{key} to copy',
          format: 'text/plain',
        });

        if (success) {
          showToast('✅ Note copied to clipboard', 'success');
          setIsCopying(false);
          return true;
        } else {
          showToast('❌ Failed to copy note', 'error');
          setIsCopying(false);
          return false;
        }
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        showToast('❌ Failed to copy note', 'error');
        setIsCopying(false);
        return false;
      }
    },
    [showToast]
  );

  return { copyToClipboard, isCopying };
}
