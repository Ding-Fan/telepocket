'use client';

import { LinkPreviewCard } from '@/components/ui/LinkPreviewCard';

export default function TestPreviewPage() {
  const mockLink = {
    link_id: '1',
    note_id: 'note-1',
    url: 'https://example.com/very/long/url/that/should/be/truncated',
    title: 'This is a very long title that should be clamped to two lines on mobile and one line on desktop to test the responsive behavior correctly',
    description: 'This is a very long description that should also be clamped to two lines on mobile and one line on desktop. It contains enough text to overflow significantly.',
    image_url: 'https://placehold.co/400',
    created_at: new Date().toISOString()
  };

  return (
    <div className="min-h-screen bg-ocean-950 p-4">
      <h1 className="text-white mb-4">Link Preview Test</h1>
      
      <div className="max-w-md mx-auto space-y-4">
        <h2 className="text-white text-sm">Thumbnail Variant</h2>
        <LinkPreviewCard 
          link={mockLink} 
          variant="thumbnail" 
        />
        
        <h2 className="text-white text-sm mt-8">Inline Variant (Comparison)</h2>
        <LinkPreviewCard 
          link={mockLink} 
          variant="inline" 
        />
      </div>
    </div>
  );
}
