import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient as createClient } from '@telepocket/shared';
import { searchNotesHybrid } from '@/actions/notes';
import { HybridSearchResult, NoteCategory } from '@telepocket/shared';

interface UseNotesSearchOptions {
  userId: number;
  query: string;
  pageSize?: number;
  debounceMs?: number;
  category?: NoteCategory | null;
}

interface UseNotesSearchReturn {
  results: HybridSearchResult[];
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
  debounceMs = 300,
  category = null
}: UseNotesSearchOptions): UseNotesSearchReturn {
  const [results, setResults] = useState<HybridSearchResult[]>([]);
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

  // Reset pagination when query or category changes
  useEffect(() => {
    setCurrentPage(1);
    setResults([]);
  }, [debouncedQuery, category]);

  // Perform search
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setResults([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    searchNotes(1);
  }, [userId, debouncedQuery, category]);

  const searchNotes = async (page: number) => {
    try {
      setLoading(true);
      setError(null);

      const { results: data, totalCount: newTotalCount, error: searchError } = await searchNotesHybrid(
        userId,
        debouncedQuery.trim(),
        page,
        pageSize,
        category
      );

      if (searchError) {
        console.error('Search failed:', searchError);
        setError(`Search failed: ${searchError} `);
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
