'use client';

import { useState } from 'react';
import { updateTag } from '@/actions/tags';
import { useRouter } from 'next/navigation';
import { Tag } from '@telepocket/shared';

interface EditTagModalProps {
  tag: Tag;
  userId: number;
  onClose: () => void;
}

export function EditTagModal({ tag, userId, onClose }: EditTagModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tagName, setTagName] = useState(tag.tag_name);
  const [isAITag, setIsAITag] = useState(tag.is_ai_enabled);
  const [scorePrompt, setScorePrompt] = useState(tag.score_prompt || '');
  const [autoConfirmThreshold, setAutoConfirmThreshold] = useState(tag.auto_confirm_threshold);
  const [suggestThreshold, setSuggestThreshold] = useState(tag.suggest_threshold);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await updateTag(
      tag.id,
      {
        tag_name: tagName.toLowerCase().trim(),
        score_prompt: scorePrompt.trim() || undefined,
        is_ai_enabled: isAITag,
        auto_confirm_threshold: isAITag ? autoConfirmThreshold : undefined,
        suggest_threshold: isAITag ? suggestThreshold : undefined
      },
      userId
    );

    if (result.success) {
      router.refresh();
      onClose();
    } else {
      setError(result.error || 'Failed to update tag');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Edit Tag</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSubmitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tag Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Tag Name *
              </label>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="todo"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base text-gray-900 placeholder:text-gray-400"
                required
                pattern="[a-z0-9][a-z0-9_-]{0,28}[a-z0-9]"
                title="Lowercase letters, numbers, hyphens, underscores (2-30 chars)"
              />
              <p className="text-xs text-gray-500 mt-2">
                Lowercase letters, numbers, hyphens, underscores (2-30 chars)
              </p>
            </div>

            {/* AI Tag Toggle */}
            <div className="border-t-2 border-gray-100 pt-6">
              <label className="flex items-start gap-4 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isAITag}
                  onChange={(e) => setIsAITag(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <div>
                  <span className="font-semibold text-gray-900 text-base group-hover:text-blue-600 transition-colors">
                    Enable AI Auto-Tagging
                  </span>
                  <p className="text-sm text-gray-600 mt-1">
                    Let LLM automatically suggest this tag for relevant notes
                  </p>
                </div>
              </label>
            </div>

            {/* AI Configuration (shown when AI tag is enabled) */}
            {isAITag && (
              <div className="space-y-6 pl-6 border-l-4 border-blue-200 bg-blue-50/30 py-4 rounded-r-xl">
                {/* Score Prompt */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Score Prompt (optional)
                  </label>
                  <textarea
                    value={scorePrompt}
                    onChange={(e) => setScorePrompt(e.target.value)}
                    placeholder={`Rate 0-100 how well this note matches "${tagName}".\n\nContent: {content}\nURLs: {urls}\n\nReturn only a number 0-100.`}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm leading-relaxed text-gray-900 placeholder:text-gray-400"
                    rows={8}
                    required={false}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Prompt can be filled now and AI enabled later. Use{' '}
                    <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-xs">{'{content}'}</code> and{' '}
                    <code className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-xs">{'{urls}'}</code> placeholders
                  </p>
                </div>

                {/* Thresholds */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Auto-confirm threshold
                    </label>
                    <input
                      type="number"
                      value={autoConfirmThreshold}
                      onChange={(e) => setAutoConfirmThreshold(parseInt(e.target.value))}
                      min="60"
                      max="100"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base text-gray-900"
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      Score ≥{autoConfirmThreshold} = auto-apply
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Suggest threshold
                    </label>
                    <input
                      type="number"
                      value={suggestThreshold}
                      onChange={(e) => setSuggestThreshold(parseInt(e.target.value))}
                      min="0"
                      max="99"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base text-gray-900"
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      Score ≥{suggestThreshold} = suggest
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t-2 border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
