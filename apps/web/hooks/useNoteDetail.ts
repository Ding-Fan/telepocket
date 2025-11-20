import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { NoteDetail, NoteLink, NoteImage } from '@/constants/categories';

interface UseNoteDetailReturn {
  note: NoteDetail | null;
  loading: boolean;
  error: string | null;
}

export function useNoteDetail(noteId: string, userId?: number): UseNoteDetailReturn {
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNoteDetail() {
      try {
        setLoading(true);
        setError(null);

        if (!userId) {
          setError('User not authenticated.');
          setNote(null);
          setLoading(false);
          return;
        }

        const supabase = createClient();

        // Call RPC function to get note with all details
        const { data, error: rpcError } = await supabase.rpc('get_note_detail', {
          note_id_param: noteId,
          telegram_user_id_param: userId
        });

        console.log('RPC Response:', data);
        console.log('Note ID:', noteId, 'User ID:', userId);

        if (rpcError) {
          console.error('Failed to fetch note detail:', rpcError);
          console.error('RPC Error details:', JSON.stringify(rpcError, null, 2));
          console.error('Note ID:', noteId, 'User ID:', userId);
          setError(`Unable to load note: ${rpcError.message || 'Unknown error'}`);
          setNote(null);
          return;
        }

        if (!data || data.length === 0) {
          console.warn('No data returned from RPC. Note might not exist or filters too strict.');
          console.warn('Note ID:', noteId, 'User ID:', userId);
          setError('Note not found.');
          setNote(null);
          return;
        }

        const noteData = data[0];

        // Parse the note detail from RPC response
        const noteDetail: NoteDetail = {
          note_id: noteData.note_id,
          category: noteData.category || 'idea', // Default category if none
          content: noteData.content,
          updated_at: noteData.updated_at,
          created_at: noteData.created_at,
          telegram_user_id: noteData.telegram_user_id,
          telegram_message_id: noteData.telegram_message_id,
          status: noteData.status || 'active',
          confirmed_categories: noteData.confirmed_categories || [],
          links: noteData.links || [],
          images: noteData.images || [],
        };

        setNote(noteDetail);
      } catch (err) {
        console.error('Unexpected error fetching note detail:', err);
        setError('An unexpected error occurred.');
        setNote(null);
      } finally {
        setLoading(false);
      }
    }

    if (noteId && userId) {
      fetchNoteDetail();
    } else if (noteId && !userId) {
      // Wait for userId to be available
      setLoading(true);
    }
  }, [noteId, userId]);

  return { note, loading, error };
}
