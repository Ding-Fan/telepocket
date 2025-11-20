import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { NoteCategory } from '@/constants/categories';

interface Note {
  note_id: string;
  note_content: string;
  category: NoteCategory;
  telegram_message_id: number;
  created_at: string;
  links: any[];
  total_count: number;
}

interface UseNotesListOptions {
  userId: number;
  pageSize?: number;
  category?: NoteCategory | null;
  status?: 'active' | 'archived' | 'all';
}

interface UseNotesListReturn {
  notes: Note[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function useNotesList({
  userId,
  pageSize = 20,
  category = null,
  status = 'active'
}: UseNotesListOptions): UseNotesListReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchNotes(1); // Reset to page 1 when filters change
  }, [userId, category, status]);

  const fetchNotes = async (page: number) => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      let rpcCall;
      let params: any = {
        telegram_user_id_param: userId,
        page_number: page,
        page_size: pageSize
      };

      // Choose appropriate RPC based on filters
      if (category) {
        rpcCall = 'get_notes_by_category';
        params.category_param = category;
      } else if (status === 'archived') {
        rpcCall = 'get_archived_notes_with_pagination';
      } else {
        rpcCall = 'get_notes_with_pagination';
      }

      const { data, error: rpcError } = await supabase.rpc(rpcCall, params);

      if (rpcError) {
        console.error('Failed to fetch notes:', rpcError);
        setError(`Unable to load notes: ${rpcError.message}`);
        setNotes([]);
        return;
      }

      if (!data || data.length === 0) {
        if (page === 1) {
          setNotes([]);
          setTotalCount(0);
        }
        return;
      }

      // Extract total count from first row
      const newTotalCount = data[0]?.total_count || 0;
      setTotalCount(newTotalCount);

      // Append or replace notes based on page
      if (page === 1) {
        setNotes(data);
      } else {
        setNotes(prev => [...prev, ...data]);
      }

      setCurrentPage(page);
    } catch (err) {
      console.error('Unexpected error fetching notes:', err);
      setError('An unexpected error occurred.');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchNotes(currentPage + 1);
    }
  };

  const refresh = () => {
    setNotes([]);
    setCurrentPage(1);
    fetchNotes(1);
  };

  const hasMore = notes.length < totalCount;

  return {
    notes,
    loading,
    error,
    totalCount,
    hasMore,
    loadMore,
    refresh
  };
}
