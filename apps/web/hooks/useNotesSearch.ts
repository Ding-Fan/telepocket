import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { NoteCategory } from '@/constants/categories';

interface SearchNote {
  note_id: string;
  note_content: string;
  category: NoteCategory;
  telegram_message_id: number;
  created_at: string;
  links: any[];
  relevance_score: number;
  total_count: number;
}

interface UseNotesSearchOptions {
  userId: number;
  query: string;
  pageSize?: number;
  debounceMs?: number;
}

interface UseNotesSearchReturn {
  results: SearchNote[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
}

export function useNotesSearch({
  userId,
  query,
  pageSize = 20,
  debounceMs = 300
}: UseNotesSearchOptions): UseNotesSearchReturn {
  const [results, setResults] = useState<SearchNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Reset pagination when query changes
  useEffect(() => {
    setCurrentPage(1);
    setResults([]);
  }, [debouncedQuery]);

  // Perform search
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setResults([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    searchNotes(1);
  }, [userId, debouncedQuery]);

  const searchNotes = async (page: number) => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      const { data, error: rpcError } = await supabase.rpc(
        'search_notes_fuzzy_optimized',
        {
          telegram_user_id_param: userId,
          search_keyword: debouncedQuery.trim(),
          page_number: page,
          page_size: pageSize
        }
      );

      if (rpcError) {
        console.error('Search failed:', rpcError);
        setError(`Search failed: ${rpcError.message}`);
        setResults([]);
        return;
      }

      if (!data || data.length === 0) {
        if (page === 1) {
          setResults([]);
          setTotalCount(0);
        }
        return;
      }

      // Extract total count from first row
      const newTotalCount = data[0]?.total_count || 0;
      setTotalCount(newTotalCount);

      // Append or replace results based on page
      if (page === 1) {
        setResults(data);
      } else {
        setResults(prev => [...prev, ...data]);
      }

      setCurrentPage(page);
    } catch (err) {
      console.error('Unexpected search error:', err);
      setError('An unexpected error occurred during search.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!loading && hasMore && debouncedQuery) {
      searchNotes(currentPage + 1);
    }
  }, [loading, currentPage, debouncedQuery]);

  const hasMore = results.length < totalCount;

  return {
    results,
    loading,
    error,
    totalCount,
    hasMore,
    loadMore
  };
}
