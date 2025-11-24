'use client';

import { useState } from 'react';
import { CreateTagModal } from './CreateTagModal';

interface CreateTagButtonProps {
  userId: number;
}

export function CreateTagButton({ userId }: CreateTagButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <span className="text-xl">+</span>
        Create Tag
      </button>

      {isModalOpen && (
        <CreateTagModal userId={userId} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
