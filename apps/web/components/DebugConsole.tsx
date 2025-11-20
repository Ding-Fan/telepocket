'use client';

import { useEffect } from 'react';

export function DebugConsole() {
  useEffect(() => {
    // Load Eruda script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.onload = () => {
      if ((window as any).eruda) {
        (window as any).eruda.init();
        console.log('✅ Eruda debugging console loaded!');
      }
    };
    script.onerror = () => {
      console.error('❌ Failed to load Eruda');
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return null;
}
