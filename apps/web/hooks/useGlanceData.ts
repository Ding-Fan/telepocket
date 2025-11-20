import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { GlanceNote } from '@/constants/categories';

interface UseGlanceDataReturn {
  notes: GlanceNote[];
  loading: boolean;
  error: string | null;
}

export function useGlanceData(userId: number): UseGlanceDataReturn {
  const [notes, setNotes] = useState<GlanceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGlanceData() {
      try {
        setLoading(true);
        setError(null);

        const supabase = createClient();

        const { data, error: rpcError } = await supabase.rpc('get_notes_glance_view', {
          telegram_user_id_param: userId,
          notes_per_category: 2
        });

        if (rpcError) {
          console.error('Failed to fetch glance view:', rpcError);
          setError('Unable to load glance view. Please try again later.');
          setNotes([]);
          return;
        }

        setNotes((data || []) as GlanceNote[]);
      } catch (err) {
        console.error('Unexpected error fetching glance data:', err);
        setError('An unexpected error occurred.');
        setNotes([]);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchGlanceData();
    }
  }, [userId]);

  return { notes, loading, error };
}
