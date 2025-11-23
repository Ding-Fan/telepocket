'use client';

import { useRouter } from 'next/navigation';
import { useTelegram } from '@/hooks/useTelegram';
import { useNoteDetail } from '@/hooks/useNoteDetail';
import { NoteDetailComponent } from '@/components/notes/NoteDetail';
import { AppLayout } from '@/components/layout/AppLayout';

interface NotePageProps {
  params: {
    id: string;
  };
}

export default function NotePage({ params }: NotePageProps) {
  const router = useRouter();
  const { user } = useTelegram();
  const { note, loading, error } = useNoteDetail(params.id, user?.id);

  // Loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-accent animate-pulse" />
            <p className="text-ocean-300 text-sm font-medium">Loading note...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error || !note) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center bg-glass rounded-3xl p-8 border border-red-500/20 max-w-md animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="text-ocean-100 font-semibold mb-2">Unable to load note</p>
            <p className="text-ocean-400 text-sm mb-4">{error || 'Note not found'}</p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 text-ocean-100 font-medium hover:from-cyan-500/30 hover:to-amber-500/30 transition-all duration-200"
            >
              Go Back
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Success state
  return (
    <AppLayout>
      <NoteDetailComponent
        note={note}
        onBack={() => router.back()}
      />
    </AppLayout>
  );
}
