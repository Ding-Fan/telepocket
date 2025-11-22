import { useEffect, useState } from 'react';
import { createBrowserClient as createClient, GlanceNote, PriorityNote, StreamNote } from '@telepocket/shared';

interface UseGlanceDataReturn {
  priorityNotes: PriorityNote[];
  categoryNotes: GlanceNote[];
  loading: boolean;
  error: string | null;
}

export function useGlanceData(userId: number): UseGlanceDataReturn {
  const [priorityNotes, setPriorityNotes] = useState<PriorityNote[]>([]);
  const [categoryNotes, setCategoryNotes] = useState<GlanceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGlanceData() {
      try {
        setLoading(true);
        setError(null);

        const supabase = createClient();

        const { data, error: rpcError } = await supabase.rpc('get_notes_priority_stream', {
          telegram_user_id_param: userId,
          priority_limit: 3,
          notes_per_category: 2
        });

        if (rpcError) {
          console.error('Failed to fetch glance priority stream:', rpcError);
          setError('Unable to load glance view. Please try again later.');
          setPriorityNotes([]);
          setCategoryNotes([]);
          return;
        }

        const allNotes = (data || []) as StreamNote[];

        // Split by section
        const priority = allNotes.filter(n => n.section === 'priority') as PriorityNote[];
        const category = allNotes.filter(n => n.section === 'category') as GlanceNote[];

        setPriorityNotes(priority);
        setCategoryNotes(category);
      } catch (err) {
        console.error('Unexpected error fetching glance data:', err);
        setError('An unexpected error occurred.');
        setPriorityNotes([]);
        setCategoryNotes([]);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchGlanceData();
    }
  }, [userId]);

  return { priorityNotes, categoryNotes, loading, error };
}
