'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import * as Toast from '@radix-ui/react-toast';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface ToastContextValue {
  showToast: (message: string, type: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now().toString();
    setToasts(prev => {
      // Limit to 5 toasts max
      const newToasts = [...prev, { id, message, type }];
      return newToasts.slice(-5);
    });

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            className={`
              fixed top-4 right-4 left-4 sm:left-auto z-50
              p-4 rounded-xl border shadow-xl
              sm:min-w-[320px] sm:max-w-[420px]
              animate-fade-in
              data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]
              data-[swipe=cancel]:translate-x-0
              data-[swipe=cancel]:transition-transform
              data-[swipe=end]:animate-swipe-out
              data-[state=open]:animate-fade-in
              data-[state=closed]:animate-fade-out
              ${
                toast.type === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-200 backdrop-blur-sm'
                  : 'bg-red-500/10 border-red-500/30 text-red-200 backdrop-blur-sm'
              }
            `}
            onOpenChange={(open) => {
              if (!open) removeToast(toast.id);
            }}
          >
            <Toast.Description className="text-sm font-medium">
              {toast.message}
            </Toast.Description>
          </Toast.Root>
        ))}
        <Toast.Viewport />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
