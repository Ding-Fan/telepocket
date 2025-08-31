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