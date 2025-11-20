import { GlanceNote } from '@/constants/categories';

interface GlanceCardProps {
  note: GlanceNote;
  onClick?: () => void;
}

export function GlanceCard({ note, onClick }: GlanceCardProps) {
  // Format date as "MMM DD"
  const formattedDate = new Date(note.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  // Truncate content to 30 characters
  const preview = note.content.length > 30
    ? note.content.substring(0, 30) + '...'
    : note.content;

  return (
    <div
      onClick={onClick}
      className="group relative bg-glass rounded-2xl p-4 border border-ocean-700/30 hover:border-ocean-500/50 transition-all duration-300 cursor-pointer overflow-hidden"
    >
      {/* Diagonal gradient accent on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute -inset-1 bg-gradient-to-br from-cyan-500/10 via-transparent to-amber-500/10 rounded-2xl blur-sm" />
      </div>

      {/* Left accent border */}
      <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-gradient-to-b from-cyan-500/50 to-amber-500/50 rounded-full opacity-60 group-hover:opacity-100 group-hover:w-1 transition-all duration-300" />

      <div className="relative pl-3">
        {/* Content Preview */}
        <p className="text-ocean-100 text-sm leading-relaxed mb-3 font-sans line-clamp-2">
          {preview}
        </p>

        {/* Meta Info Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Date */}
          <span className="text-ocean-400 text-xs font-medium tracking-wide">
            {formattedDate}
          </span>

          {/* Badges */}
          <div className="flex items-center gap-1.5">
            {note.link_count > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                <span className="text-cyan-400 text-[10px]">🔗</span>
                <span className="text-cyan-300 text-[10px] font-semibold">{note.link_count}</span>
              </div>
            )}
            {note.image_count > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <span className="text-amber-400 text-[10px]">🖼️</span>
                <span className="text-amber-300 text-[10px] font-semibold">{note.image_count}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-amber-500/0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10" />
    </div>
  );
}
