'use client';

import { Tag } from '@telepocket/shared';
import { useState } from 'react';
import { EditTagModal } from './EditTagModal';
import { archiveTag } from '@/actions/tags';
import { useRouter } from 'next/navigation';

interface TagCardProps {
  tag: Tag;
  userId: number;
}

export function TagCard({ tag, userId }: TagCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const isAITag = tag.score_prompt !== null;

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete the "${tag.tag_name}" tag?`)) {
      return;
    }

    setIsDeleting(true);
    const result = await archiveTag(tag.id, userId);

    if (result.success) {
      router.refresh();
    } else {
      alert(`Failed to delete tag: ${result.error}`);
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white relative">
        {/* AI Enabled badge */}
        {isAITag && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
              🤖 AI ENABLED
            </span>
          </div>
        )}

        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Tag header */}
            <div className="flex items-center gap-3 mb-2">
              <div>
                <h3 className="text-lg font-semibold">{tag.tag_name}</h3>
                <div className="text-sm text-gray-500">
                  {tag.usage_count} {tag.usage_count === 1 ? 'note' : 'notes'}
                </div>
              </div>
            </div>

            {/* AI configuration */}
            {isAITag && (
              <div className="mt-3 space-y-2">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Auto-confirm threshold:</span>
                  <span className="ml-2 text-gray-600">{tag.auto_confirm_threshold}%</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Suggest threshold:</span>
                  <span className="ml-2 text-gray-600">{tag.suggest_threshold}%</span>
                </div>
                {tag.score_prompt && (
                  <details className="mt-2">
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                      View AI Prompt
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-700 whitespace-pre-wrap font-mono text-xs">
                      {tag.score_prompt}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              <span>Created {new Date(tag.created_at).toLocaleDateString()}</span>
              {tag.last_used_at && (
                <>
                  <span>•</span>
                  <span>Last used {new Date(tag.last_used_at).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-4 mt-8">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {isEditModalOpen && (
        <EditTagModal
          tag={tag}
          userId={userId}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
    </>
  );
}
