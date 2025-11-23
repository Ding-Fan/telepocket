import { useQuery } from '@tanstack/react-query';
import { createBrowserClient as createClient, GlanceNote, PriorityNote, StreamNote } from '@telepocket/shared';

interface UseGlanceDataReturn {
  priorityNotes: PriorityNote[];
  categoryNotes: GlanceNote[];
  loading: boolean;
  error: string | null;
}

async function fetchGlanceData(userId: number) {
  const supabase = createClient();

  const { data, error: rpcError } = await supabase.rpc('get_notes_priority_stream', {
    telegram_user_id_param: userId,
    priority_limit: 3,
    notes_per_category: 2
  });

  if (rpcError) {
    console.error('Failed to fetch glance priority stream:', rpcError);
    throw new Error('Unable to load glance view. Please try again later.');
  }

  const allNotes = (data || []) as StreamNote[];

  // Split by section
  const priority = allNotes.filter(n => n.section === 'priority') as PriorityNote[];
  const category = allNotes.filter(n => n.section === 'category') as GlanceNote[];

  return { priority, category };
}

export function useGlanceData(userId: number): UseGlanceDataReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: ['glance-data', userId],
    queryFn: () => fetchGlanceData(userId),
    enabled: !!userId,
  });

  return {
    priorityNotes: data?.priority || [],
    categoryNotes: data?.category || [],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'An unexpected error occurred.') : null,
  };
}
