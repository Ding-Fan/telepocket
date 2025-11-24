import { useMutation, useQueryClient } from '@tanstack/react-query';
import { archiveNote } from '@/actions/notes';

interface ArchiveNoteMutationParams {
  noteId: string;
  userId: number;
  onSuccess?: () => void;
}

export function useArchiveNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, userId }: ArchiveNoteMutationParams) => {
      const result = await archiveNote(noteId, userId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to archive note');
      }
      return result;
    },
    onSuccess: (data, variables) => {
      // Invalidate queries to update UI
      queryClient.invalidateQueries({ queryKey: ['glance-data', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['notes-list', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['note-detail', variables.noteId] });

      // Call optional success callback (for navigation)
      if (variables.onSuccess) {
        variables.onSuccess();
      }
    },
    onError: (err) => {
      console.error('Failed to archive note:', err);
    },
  });
}
