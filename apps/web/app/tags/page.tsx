'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useTelegram } from '@/hooks/useTelegram';
import { AppLayout } from '@/components/layout/AppLayout';
import { getUserTags } from '@/actions/tags';
import { TagList } from '@/components/tags/TagList';
import { CreateTagButton } from '@/components/tags/CreateTagButton';

export default function TagsPage() {
  const router = useRouter();
  const { user } = useTelegram();
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTags() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await getUserTags(user.id);

      if (!result.success) {
        setError(result.error || 'Failed to load tags');
      } else {
        setTags(result.tags || []);
      }
      setLoading(false);
    }

    loadTags();
  }, [user?.id]);

  if (!user) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-ocean-400">
            Loading user information...
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-red-400">
            Error loading tags: {error}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-ocean-800/50 border border-ocean-700/30 text-ocean-300 hover:bg-ocean-700/50 hover:text-ocean-100 transition-all duration-200"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">Tags</h1>
              <p className="text-ocean-400 mt-1">
                Manage your tags. AI-enabled tags auto-classify notes using LLM.
              </p>
            </div>
          </div>
          <CreateTagButton userId={user.id} />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-ocean-400">Loading tags...</p>
          </div>
        ) : (
          <TagList tags={tags} userId={user.id} />
        )}
      </div>
    </AppLayout>
  );
}
