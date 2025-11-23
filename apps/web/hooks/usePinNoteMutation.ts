import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toggleNotePin } from '@/actions/notes';
import { GlanceNote, PriorityNote } from '@telepocket/shared';

interface PinNoteMutationParams {
  noteId: string;
  userId: number;
}

export function usePinNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, userId }: PinNoteMutationParams) => {
      const result = await toggleNotePin(noteId, userId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to toggle pin');
      }
      return result;
    },
    onMutate: async ({ noteId, userId }) => {
      // Cancel any outgoing refetches to prevent them from overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['glance-data', userId] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<{
        priority: PriorityNote[];
        category: GlanceNote[];
      }>(['glance-data', userId]);

      // Optimistically update the cache
      queryClient.setQueryData<{
        priority: PriorityNote[];
        category: GlanceNote[];
      }>(['glance-data', userId], (old) => {
        if (!old) return old;

        // Toggle is_marked for the note in both priority and category arrays
        const updateNote = (note: PriorityNote | GlanceNote) => {
          if (note.note_id === noteId) {
            return { ...note, is_marked: !note.is_marked };
          }
          return note;
        };

        const updatedPriority = old.priority.map(updateNote) as PriorityNote[];
        const updatedCategory = old.category.map(updateNote) as GlanceNote[];

        // Remove from priority section if unpinned
        const filteredPriority = updatedPriority.filter(note => note.is_marked);

        return {
          priority: filteredPriority,
          category: updatedCategory,
        };
      });

      // Return the snapshot as context for rollback
      return { previousData };
    },
    onError: (err, { userId }, context) => {
      // Rollback to the previous value on error
      if (context?.previousData) {
        queryClient.setQueryData(['glance-data', userId], context.previousData);
      }
      console.error('Failed to toggle pin:', err);
    },
    onSettled: (data, error, { userId }) => {
      // Always refetch to ensure we're in sync with the server
      queryClient.invalidateQueries({ queryKey: ['glance-data', userId] });
    },
  });
}
