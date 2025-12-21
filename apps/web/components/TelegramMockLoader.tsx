'use client';

import { useEffect } from 'react';
import { mockTelegramWebApp } from '@/lib/mockTelegramWebApp';

/**
 * Loads Telegram WebApp mock in development mode
 * Must run before any component tries to access window.Telegram
 */
export function TelegramMockLoader() {
  useEffect(() => {
    // Run mock immediately on mount
    mockTelegramWebApp();
  }, []);

  return null; // No visual output
}
