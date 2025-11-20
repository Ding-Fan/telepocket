# Glance Section Specification

## Problem & Solution

**Problem**: Users need a quick overview of recent activity across all note categories without navigating through lists or using the bot.
**Solution**: Display 2 most recent notes per category (6 categories total) in a scannable card layout, matching the bot's /glance command.
**Returns**: Array of `GlanceNote` objects grouped by category with metadata (date, content preview, counts).

## Component API

```typescript
interface GlanceNote {
  note_id: string;
  category: 'todo' | 'idea' | 'blog' | 'youtube' | 'reference' | 'japanese';
  content: string;
  updated_at: string;
  created_at: string;
  telegram_message_id: number;
  link_count: number;
  image_count: number;
  row_number: number;
  category_total: number;
  category_max_updated: string;
}

interface GlanceSectionProps {
  userId: number;
  onNoteClick?: (noteId: string) => void;
}

interface GlanceCardProps {
  note: GlanceNote;
  onClick?: () => void;
}
```

## Usage Example

```typescript
import { GlanceSection } from '@/components/notes/GlanceSection';

<GlanceSection
  userId={user.id}
  onNoteClick={(noteId) => router.push(`/notes/${noteId}`)}
/>
```

## Core Flow

```
Component mounts
  ↓
Fetch glance data via Supabase RPC
  ↓
Group notes by category (6 categories)
  ↓
Render category sections with 0-2 note cards each
  ↓
Display empty state if no notes in category
```

## User Stories

**US-1: View Recent Notes**
User opens notes page and immediately sees up to 2 recent notes per category in a glance view, providing quick context of their recent activity without scrolling or searching.

**US-2: Navigate to Full Note**
User clicks on a note card preview and is taken to the full note detail view (future tier - MVP shows static cards).

**US-3: Empty Category State**
User sees "(No notes)" text under categories with zero notes, maintaining consistent layout and setting expectations.

## MVP Scope

**Included**:
- GlanceSection component (reusable container)
- GlanceCard sub-component (individual note preview)
- Supabase RPC integration (`get_notes_glance_view`)
- Category grouping with emoji headers
- Content preview (first 30 chars)
- Date formatting (e.g., "Nov 14")
- Link/image count badges
- Empty state for categories with no notes
- Ocean theme styling (glass cards, gradients)

**NOT Included** (Future):
- Click-to-expand full note → 🔧 Robust
- Category filtering/toggling → 🔧 Robust
- Loading skeletons → 🔧 Robust
- Real-time updates → 🚀 Advanced
- Search within glance → 🚀 Advanced
- Custom category ordering → 🚀 Advanced

## Data Integration

**Supabase RPC**: `get_notes_glance_view`

**Parameters**:
```typescript
{
  telegram_user_id_param: number,
  notes_per_category: number  // Default: 2
}
```

**Response**:
```typescript
GlanceNote[]  // Array of 0-12 notes (up to 2 per category)
```

## Acceptance Criteria (MVP)

**Functional**:
- [ ] Fetches glance data on component mount
- [ ] Displays all 6 categories (todo, idea, blog, youtube, reference, japanese)
- [ ] Shows up to 2 notes per category
- [ ] Shows "(No notes)" for empty categories
- [ ] Formats dates as "MMM DD" (e.g., "Nov 14")
- [ ] Truncates content preview to 30 characters
- [ ] Displays link_count and image_count badges if > 0
- [ ] Handles loading state gracefully
- [ ] Handles error state with user-friendly message

**UI/UX**:
- [ ] Follows ocean theme (bg-glass, ocean colors, gradients)
- [ ] Category headers show emoji + label
- [ ] Cards have hover states
- [ ] Responsive layout (stacked on mobile, grid on desktop)
- [ ] Consistent spacing and alignment
- [ ] Smooth animations (slide-up, fade-in)

## Future Tiers

**🔧 Robust** (+2 days): Click-to-expand full note modal, category filter toggles, loading skeletons, error retry button, note count badges per category

**🚀 Advanced** (+3 days): Real-time updates via Supabase subscriptions, search/filter within glance view, drag-to-reorder categories, customizable notes-per-category (2/5/10), export glance as PDF

---

**Status**: ✅ Completed (MVP + Note Detail View) | **Actual Effort**: 2 days | **Completed**: Nov 19, 2025

---

## Implementation Summary

### What Was Built

**MVP Components (Completed)**:
- ✅ `GlanceSection` - Main container component with data fetching
- ✅ `GlanceCard` - Individual note preview cards with ocean theme
- ✅ `useGlanceData` - Custom hook for Supabase RPC integration
- ✅ Category constants (`categories.ts`) - Shared types and constants
- ✅ Integration with homepage (`app/page.tsx`)

**Bonus: Note Detail View (Robust Tier)**:
- ✅ Dynamic route: `app/notes/[id]/page.tsx`
- ✅ `NoteDetail` component with full note display
- ✅ `useNoteDetail` hook for fetching single note
- ✅ Database RPC function: `get_note_detail`
- ✅ Navigation from glance cards to detail pages
- ✅ Extended TypeScript types: `NoteLink`, `NoteImage`, `NoteDetail`

**Developer Tools**:
- ✅ Eruda debugging console for Telegram Web App
- ✅ Enhanced error logging for troubleshooting

### Database Integration

**RPC Functions Created**:
1. `get_notes_glance_view` (existing) - Fetch 2 notes per category
2. `get_note_detail` (new) - Fetch single note with links and images

**Migrations Created**:
- `20251119173547_create_get_note_detail_function.sql` - Initial RPC
- `20251119174115_fix_get_note_detail_function.sql` - Fixed aggregation
- `20251119174925_fix_note_detail_use_correct_columns.sql` - Fixed column names
- `20251119175123_fix_note_images_column_names.sql` - Fixed image columns
- `20251119175407_make_note_detail_more_lenient.sql` - LEFT JOIN for uncategorized notes

### Key Technical Decisions

**1. Ocean Theme Consistency**:
- Glass morphism with `bg-glass` utility
- Gradient accents (cyan-500/amber-500)
- Expandable left accent border on hover
- Staggered animations (80ms delay per category)

**2. Database Architecture**:
- Used `LEFT JOIN` instead of `INNER JOIN` for categories
- Handles notes without confirmed categories gracefully
- Defaults to 'idea' category if none exists
- Gets `updated_at` from `z_note_categories` table (not `z_notes`)

**3. Error Handling**:
- Column name mismatches fixed through iterative debugging
- `telegram_file_id` not `file_id`
- `cloudflare_url` not `file_path`
- `nc.updated_at` not `n.updated_at`

**4. Debugging Approach**:
- Integrated Eruda console for mobile debugging
- Enhanced error logging with detailed RPC responses
- Client-side component for reliable script loading

### Files Created

```
apps/web/
├── components/
│   ├── notes/
│   │   ├── GlanceSection.tsx    (Main container)
│   │   ├── GlanceCard.tsx       (Note preview card)
│   │   └── NoteDetail.tsx       (Full note display)
│   └── DebugConsole.tsx         (Eruda integration)
├── hooks/
│   ├── useGlanceData.ts         (Glance RPC hook)
│   └── useNoteDetail.ts         (Detail RPC hook)
├── constants/
│   └── categories.ts            (Types & constants)
└── app/
    ├── page.tsx                 (Updated with GlanceSection)
    └── notes/[id]/
        └── page.tsx             (Note detail route)
```

### Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Column `n.updated_at` doesn't exist | Used `nc.updated_at` from categories table |
| Column `ni.file_id` doesn't exist | Used `ni.telegram_file_id` instead |
| Notes without categories invisible | Changed INNER JOIN to LEFT JOIN |
| Debugging in Telegram Web App | Integrated Eruda mobile console |
| Complex DISTINCT aggregation errors | Used subqueries for link/image aggregation |

### Performance Characteristics

- Single RPC call for glance data (12 notes max)
- Single RPC call for note detail (1 note + links + images)
- Client-side category grouping with useMemo
- Efficient JSON aggregation in database
- No N+1 query problems

---

## Nov 20, 2025 Update: Interactive Note Management

**Status**: ✅ Completed | **Effort**: 1 day

### New Features Added

**1. Category Selection UI**:
- ✅ Interactive category buttons in note detail view
- ✅ Grid layout (2-3 columns) with all 6 category options
- ✅ Smart filtering: Only shows unconfirmed categories
- ✅ Optimistic UI updates after confirmation
- ✅ Success toast notifications

**2. Archive Functionality**:
- ✅ Archive button in note detail view header
- ✅ Confirmation dialog before archiving
- ✅ Updates note status to 'archived'
- ✅ Navigates back to home after archiving
- ✅ Error handling with user feedback

**3. Server Actions** (`apps/web/actions/notes.ts`):
```typescript
// Secure server-side mutations
confirmNoteCategory(noteId, category, userId) → { success, error? }
archiveNote(noteId, userId) → { success, error? }
```

**4. Enhanced Type System**:
```typescript
interface NoteDetail {
  // ... existing fields
  status: 'active' | 'archived';           // NEW
  confirmed_categories: NoteCategory[];    // NEW
}
```

**5. Database Migration** (`20251119185449_update_get_note_detail_add_categories_and_status.sql`):
- Updated `get_note_detail` RPC function
- Returns `status` field from `z_notes` table
- Returns `confirmed_categories` JSONB array
- Aggregates all confirmed categories for filtering

### Implementation Details

**Component Updates**:
- `NoteDetail.tsx`: Added category buttons section + archive button
- `useNoteDetail.ts`: Parse new RPC response fields
- `categories.ts`: Updated TypeScript interfaces

**UI/UX Enhancements**:
- Toast notification system (success/error states)
- Loading states during mutations (isPending, isArchiving)
- Confirmation dialog for destructive actions
- Ocean theme consistency maintained

**Security**:
- Server Actions prevent client-side manipulation
- User ID validation in all mutations
- Revalidates paths after mutations (`revalidatePath`)

### Files Modified/Created

```
apps/web/
├── actions/
│   └── notes.ts                     (NEW - Server Actions)
├── components/notes/
│   └── NoteDetail.tsx               (UPDATED - Category + Archive UI)
├── hooks/
│   └── useNoteDetail.ts             (UPDATED - Parse new fields)
├── constants/
│   └── categories.ts                (UPDATED - Type extensions)
└── .spec/
    └── glance-section/              (MOVED from root)
        └── spec.md                  (THIS FILE)

apps/bot/supabase/migrations/
└── 20251119185449_update_get_note_detail_add_categories_and_status.sql
```

### Deployment

**Build & Deploy**:
```bash
cd apps/web
pnpm build                    # ✅ Build successful
pm2 stop telepocket-web       # Stop process
pm2 start telepocket-web      # Start with new code
pm2 save                      # Save process list
```

**Database**:
```bash
supabase db push              # ✅ Migration deployed
```

### Alignment with Bot Features

This implementation brings web app feature parity with bot's:
- Bot: Category buttons in note detail → Web: ✅ Same UI pattern
- Bot: Archive command → Web: ✅ Archive button
- Bot: Confirmed categories filter → Web: ✅ Smart button filtering

### Future Enhancements

**Potential Additions**:
- Unarchive functionality (restore archived notes)
- Bulk category tagging
- Undo archive (temporary restore window)
- Category statistics dashboard
