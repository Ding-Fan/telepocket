'use client';

import { useState } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { useNotesSearch } from '@/hooks/useNotesSearch';
import { NotesSearchBar } from '@/components/notes/NotesSearchBar';
import { NoteCard } from '@/components/notes/NoteCard';

export function SearchContainer() {
    const { user } = useTelegram();
    const [query, setQuery] = useState('');

    const { results, loading, error, totalCount, hasMore, loadMore } = useNotesSearch({
        userId: user?.id || 0,
        query,
        debounceMs: 500
    });

    const handleClear = () => {
        setQuery('');
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4">
                <h1 className="text-2xl font-bold mb-4 text-white">Search</h1>

                <NotesSearchBar
                    value={query}
                    onChange={setQuery}
                    onClear={handleClear}
                    placeholder="Search notes (e.g. 'latest ideas', 'recipes')..."
                />

                {/* Results */}
                <div className="mt-6">
                    {loading && results.length === 0 && (
                        <div className="text-center py-8">
                            <div className="animate-spin text-2xl mb-2">⏳</div>
                            <p className="text-ocean-300">Searching...</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center text-red-200">
                            {error}
                        </div>
                    )}

                    {!loading && !error && query && results.length === 0 && (
                        <div className="text-center py-12 text-ocean-400">
                            <div className="text-4xl mb-3">🔍</div>
                            <p>No matching notes found</p>
                        </div>
                    )}

                    {!query && results.length === 0 && (
                        <div className="text-center py-12 text-ocean-500">
                            <div className="text-4xl mb-3">⌨️</div>
                            <p>Type to start searching</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {results.map((note) => (
                            <div key={note.id} className="relative group">
                                <NoteCard
                                    noteId={note.id}
                                    category={(note.category || 'reference') as any} // Fallback to reference if null
                                    content={note.content}
                                    createdAt={note.created_at}
                                    linkCount={note.links?.length || 0}
                                    imageCount={0}
                                />
                                {/* Relevance Score Badge (Optional, for debugging/transparency) */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-xs text-white px-2 py-1 rounded-full pointer-events-none">
                                    {Math.round(note.relevance_score * 100)}% match ({note.search_type})
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load More */}
                    {hasMore && (
                        <div className="mt-6 text-center">
                            <button
                                onClick={loadMore}
                                disabled={loading}
                                className="px-4 py-2 rounded-xl bg-ocean-800/50 text-ocean-200 hover:bg-ocean-700/50 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
