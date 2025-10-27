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
  relevance_score?: number;
}

export function formatNoteForDisplay(
  note: NoteData,
  options: {
    maxContentLength?: number;
    maxDescriptionLength?: number;
    showRelevanceScore?: boolean;
  } = {}
): string {
  const {
    maxContentLength = 200,
    maxDescriptionLength = 80,
    showRelevanceScore = false
  } = options;

  let formattedText = '';

  // Display note content first
  const truncatedContent = note.note_content.length > maxContentLength
    ? note.note_content.substring(0, maxContentLength) + '...'
    : note.note_content;
  const escapedContent = escapeMarkdownV2(truncatedContent);
  formattedText += `📝 _${escapedContent}_\n`;

  // Show relevance score if searching
  if (showRelevanceScore && note.relevance_score !== undefined) {
    const scorePercent = Math.round(note.relevance_score * 100);
    formattedText += `🎯 Relevance: ${scorePercent}%\n`;
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

  formattedText += '\n';
  return formattedText;
}