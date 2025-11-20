interface LinkData {
  url: string;
  title?: string;
  description?: string;
}

export function escapeMarkdownV2(text: string): string {
  // For MarkdownV2, we need to escape: \ _ * [ ] ( ) ~ ` > # + - = | { } . !
  // Note: backslash must be escaped first to avoid double-escaping
  return text.replace(/[\\\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!]/g, '\\$&');
}

export function formatLinksForDisplay(
  links: LinkData[], 
  options: {
    startNumber?: number;
    maxDescriptionLength?: number;
    showNumbers?: boolean;
  } = {}
): string {
  const { 
    startNumber = 1, 
    maxDescriptionLength = 100, 
    showNumbers = true 
  } = options;

  let formattedText = '';

  links.forEach((link, index) => {
    const linkNumber = startNumber + index;
    const title = link.title || 'Untitled';
    
    // Create clickable link with title as text and URL as destination
    // For MarkdownV2, we need to escape the title but not the URL in the link syntax
    const escapedTitle = escapeMarkdownV2(title);
    
    if (showNumbers) {
      formattedText += `*${linkNumber}\\.* [${escapedTitle}](${link.url})\n`;
    } else {
      formattedText += `[${escapedTitle}](${link.url})\n`;
    }

    if (link.description) {
      // Truncate description if too long
      const truncatedDesc = link.description.length > maxDescriptionLength
        ? link.description.substring(0, maxDescriptionLength) + '...'
        : link.description;
      const desc = escapeMarkdownV2(truncatedDesc);
      formattedText += `📝 ${desc}\n`;
    }

    formattedText += '\n';
  });

  return formattedText;
}

interface NoteData {
  note_content: string;
  links: Array<{
    url: string;
    title?: string;
    description?: string;
  }>;
  images?: Array<{
    cloudflare_url: string;
  }>;
  relevance_score?: number;
}

export function formatNoteForDisplay(
  note: NoteData,
  options: {
    maxContentLength?: number;
    maxDescriptionLength?: number;
    showRelevanceScore?: boolean;
    compact?: boolean;
    showDetailLink?: boolean;
    detailLinkUrl?: string;
  } = {}
): string {
  const {
    maxContentLength = 200,
    maxDescriptionLength = 80,
    showRelevanceScore = false,
    compact = false,
    showDetailLink = false,
    detailLinkUrl
  } = options;

  let formattedText = '';

  // Display note content first
  const truncatedContent = note.note_content.length > maxContentLength
    ? note.note_content.substring(0, maxContentLength) + '...'
    : note.note_content;
  const escapedContent = escapeMarkdownV2(truncatedContent);
  formattedText += `📝 _${escapedContent}_`;

  // Add inline Detail link if requested
  if (showDetailLink && detailLinkUrl) {
    formattedText += ` [→ Detail](${detailLinkUrl})`;
  }

  formattedText += '\n';

  // Show relevance score if searching
  if (showRelevanceScore && note.relevance_score !== undefined) {
    const scorePercent = Math.round(note.relevance_score * 100);
    formattedText += `🎯 Relevance: ${scorePercent}%\n`;
  }

  if (compact) {
    // Compact mode: show counts only, no details
    const imageCount = note.images?.length || 0;
    const linkCount = note.links?.length || 0;

    if (imageCount > 0 || linkCount > 0) {
      const parts = [];
      if (imageCount > 0) parts.push(`📷 ${imageCount}`);
      if (linkCount > 0) parts.push(`🔗 ${linkCount}`);
      formattedText += `${parts.join(' • ')}\n`;
    }
  } else {
    // Full mode: show all details
    // Display images if any
    if (note.images && note.images.length > 0) {
      formattedText += '\n*Images:*\n';
      note.images.forEach((image) => {
        const escapedUrl = escapeMarkdownV2(image.cloudflare_url);
        formattedText += `• ${escapedUrl}\n`;
      });
    }

    // Display links if any
    if (note.links && note.links.length > 0) {
      formattedText += '\n*Links:*\n';
      note.links.forEach((link) => {
        const title = link.title || 'Untitled';
        const escapedTitle = escapeMarkdownV2(title);
        formattedText += `• [${escapedTitle}](${link.url})\n`;

        if (link.description) {
          const truncatedDesc = link.description.length > maxDescriptionLength
            ? link.description.substring(0, maxDescriptionLength) + '...'
            : link.description;
          const desc = escapeMarkdownV2(truncatedDesc);
          formattedText += `  ${desc}\n`;
        }
      });
    }
  }

  formattedText += '\n';
  return formattedText;
}

/**
 * Format suggestions for /suggest command display
 * @param notes - Selected suggestion notes (one per category)
 * @param query - Optional search query for query mode
 * @returns Object with formatted message and inline button data
 */
export function formatSuggestionsForDisplay(
  notes: Array<{
    note_id: string;
    category: string;
    content: string;
    created_at: string;
    link_count: number;
    image_count: number;
  }>,
  query?: string
): {
  message: string;
  buttons: Array<{ text: string; callback_data: string }>;
} {
  // Import category constants locally to avoid circular dependency
  const CATEGORY_EMOJI: Record<string, string> = {
    todo: '📋',
    idea: '💡',
    blog: '📝',
    youtube: '📺',
    reference: '📚',
    japanese: '🇯🇵'
  };

  const CATEGORY_LABELS: Record<string, string> = {
    todo: 'Todo',
    idea: 'Idea',
    blog: 'Blog',
    youtube: 'YouTube',
    reference: 'Reference',
    japanese: 'Japanese'
  };

  const ALL_CATEGORIES = ['todo', 'idea', 'blog', 'youtube', 'reference', 'japanese'];

  // Build header
  let message = query
    ? `*🔍 Suggestions: ${escapeMarkdownV2(query)}*\n\n`
    : '*💡 Weekly Suggestions*\n\n';

  // Group notes by category
  const notesByCategory = new Map<string, typeof notes[0]>();
  for (const note of notes) {
    notesByCategory.set(note.category, note);
  }

  const buttons: Array<{ text: string; callback_data: string }> = [];
  let buttonIndex = 1;

  // Display notes in category order
  for (const category of ALL_CATEGORIES) {
    const emoji = CATEGORY_EMOJI[category] || '📌';
    const label = CATEGORY_LABELS[category] || category;
    const note = notesByCategory.get(category);

    message += `*${emoji} ${escapeMarkdownV2(label)}*\n`;

    if (note) {
      // Truncate content at 50 characters
      const preview = note.content.length > 50
        ? note.content.substring(0, 50) + '...'
        : note.content;

      // Format date as "Nov 14"
      const date = new Date(note.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });

      // Build note display line
      const escapedPreview = escapeMarkdownV2(preview);
      const escapedDate = escapeMarkdownV2(date);
      message += `${buttonIndex}\\. ${escapedPreview} \\- ${escapedDate}\n`;

      // Add button for this note
      const returnPath = query
        ? `/suggest/query/${encodeURIComponent(query)}`
        : '/suggest/';
      buttons.push({
        text: `${buttonIndex}`,
        callback_data: `detail:${note.note_id}:${returnPath}`
      });

      buttonIndex++;
    } else {
      // No suggestions for this category
      message += escapeMarkdownV2('(No suggestions)') + '\n';
    }

    message += '\n';
  }

  return { message, buttons };
}

/**
 * Format note for detailed view (shows full content without truncation)
 */
export function formatNoteDetailView(
  note: NoteData & { is_marked?: boolean },
  images: Array<{ cloudflare_url: string }> = []
): string {
  let formattedText = '*📝 Note Details*\n\n';

  // Show full content (no truncation)
  const escapedContent = escapeMarkdownV2(note.note_content);
  formattedText += `${escapedContent}\n`;

  // Display all images
  if (images.length > 0) {
    formattedText += '\n*📷 Images:*\n';
    images.forEach((image) => {
      const escapedUrl = escapeMarkdownV2(image.cloudflare_url);
      formattedText += `• ${escapedUrl}\n`;
    });
  }

  // Display all links with full metadata
  if (note.links && note.links.length > 0) {
    formattedText += '\n*🔗 Links:*\n';
    note.links.forEach((link, index) => {
      const title = link.title || 'Untitled';
      const escapedTitle = escapeMarkdownV2(title);
      formattedText += `*${index + 1}\\.* [${escapedTitle}](${link.url})\n`;

      if (link.description) {
        // Show full description up to 150 chars
        const truncatedDesc = link.description.length > 150
          ? link.description.substring(0, 150) + '...'
          : link.description;
        const desc = escapeMarkdownV2(truncatedDesc);
        formattedText += `   ${desc}\n`;
      }
    });
  }

  return formattedText;
}