import { getUserTags } from '@/actions/tags';
import { TagList } from '@/components/tags/TagList';
import { CreateTagButton } from '@/components/tags/CreateTagButton';

export const metadata = {
  title: 'Tags - Telepocket',
  description: 'Manage your tags'
};

export default async function TagsPage() {
  // Get user ID from environment (in real app, get from auth)
  const userId = parseInt(process.env.TELEGRAM_USER_ID || '0');

  if (!userId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">
          Error: User ID not configured
        </div>
      </div>
    );
  }

  const result = await getUserTags(userId);

  if (!result.success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">
          Error loading tags: {result.error}
        </div>
      </div>
    );
  }

  const tags = result.tags || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Tags</h1>
          <p className="text-gray-600 mt-1">
            Manage your tags. AI-enabled tags auto-classify notes using LLM.
          </p>
        </div>
        <CreateTagButton userId={userId} />
      </div>

      <TagList tags={tags} userId={userId} />
    </div>
  );
}
