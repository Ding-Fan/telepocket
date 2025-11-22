import { NoteDetail } from '@telepocket/shared';

/**
 * Formats a note as markdown with content, links, and images sections
 * @param note - The note detail to format
 * @returns Formatted markdown string
 */
export function formatNoteAsMarkdown(note: NoteDetail): string {
  const sections: string[] = [];

  // Add content first (no header)
  if (note.content?.trim()) {
    sections.push(note.content.trim());
  }

  // Add links section if links exist
  if (note.links && note.links.length > 0) {
    const linksHeader = `## Links (${note.links.length})`;
    const linkItems = note.links.map(link => {
      const title = link.title || 'Untitled';
      const linkLine = `- [${title}](${link.url})`;

      // Add description if available (truncated to 100 chars)
      if (link.description) {
        const truncatedDescription = link.description.length > 100
          ? link.description.substring(0, 100) + '...'
          : link.description;
        return `${linkLine}\n  ${truncatedDescription}`;
      }

      return linkLine;
    });

    sections.push([linksHeader, ...linkItems].join('\n'));
  }

  // Add images section if images exist
  if (note.images && note.images.length > 0) {
    const imagesHeader = `## Images (${note.images.length})`;
    const imageItems = note.images.map((image, index) => {
      return `- ![Image ${index + 1}](${image.file_path})`;
    });

    sections.push([imagesHeader, ...imageItems].join('\n'));
  }

  // Join sections with double newline
  return sections.join('\n\n');
}
