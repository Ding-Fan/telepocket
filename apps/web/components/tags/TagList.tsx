'use client';

import { Tag } from '@telepocket/shared';
import { TagCard } from './TagCard';

interface TagListProps {
  tags: Tag[];
  userId: number;
}

export function TagList({ tags, userId }: TagListProps) {
  if (tags.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🏷️</div>
        <h3 className="text-xl font-semibold mb-2">No tags yet</h3>
        <p className="text-gray-600 mb-6">
          Create your first tag to start organizing your notes
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {tags.map(tag => (
        <TagCard key={tag.id} tag={tag} userId={userId} />
      ))}
    </div>
  );
}
