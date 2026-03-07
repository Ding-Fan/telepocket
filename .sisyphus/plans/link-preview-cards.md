# Link Preview Cards in NoteCardV2

## Context

### Original Request
User reported: "when the note card shows, it doesn't show the link as link card, it just show link as text, I can not know what the link is"

### Interview Summary
**Key Discussions**:
- User wants thumbnail-style link preview cards (like Slack/Discord) in note cards
- Compact cards with title, description, and small image

**Research Findings**:
- `LinkPreviewCard` component already exists with `variant="thumbnail"`
- Database RPC already returns link metadata (title, description, og_image)
- `NoteCardV2` doesn't receive links prop - only shows plain URLs

### Metis Review
**Identified Gaps** (addressed):
- Type mismatch: RPC uses `og_image`, `NoteDetailLink` uses `image_url` → Create adapter/mapper
- `HybridSearchResult.links` missing `description`, `image_url` → Graceful degradation
- GlanceSection has no links data in types → Exclude from Phase 1
- Inline URLs vs preview cards → Keep both (inline + preview after content)

---

## Work Objectives

### Core Objective
Add rich link preview cards (thumbnail style) to NoteCardV2 so users can see link title, description, and image without clicking.

### Concrete Deliverables
- `NoteCardV2.tsx` - Enhanced with `links` prop and LinkPreviewCard rendering
- `NotesList.tsx` - Pass links data to NoteCardV2
- `notes/page.tsx` (SearchResults) - Pass links data to NoteCardV2

### Definition of Done
- [ ] Notes with links show thumbnail preview cards below content
- [ ] Maximum 2 link previews per card (configurable via `maxLinks` prop)
- [ ] Links without metadata gracefully fallback to URL display
- [ ] Clicking link preview opens URL (doesn't navigate to note detail)
- [ ] No TypeScript errors
- [ ] Mobile layout not broken

### Must Have
- Thumbnail link preview cards in NotesList and SearchResults
- Title, description, and image when available
- Fallback to URL when metadata missing
- Max 2 links per card

### Must NOT Have (Guardrails)
- DO NOT modify GlanceSection, GlanceNote, or PriorityNote types
- DO NOT modify any RPC functions or database schema
- DO NOT add client-side metadata fetching
- DO NOT create new hooks for link handling
- DO NOT modify LinkPreviewCard component itself
- DO NOT remove inline link rendering in text content
- DO NOT add try/catch blocks for link rendering (silent fallback is fine)
- DO NOT create over-abstracted utilities or hooks

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (no test framework for web app)
- **User wants tests**: Manual QA
- **Framework**: Manual verification with dev server

### Manual QA Procedures

Each task includes verification steps to run against dev server.

---

## Task Flow

```
Task 1 (NoteCardV2 props) → Task 2 (NotesList wiring) → Task 3 (SearchResults wiring)
                                                     ↘ Task 4 (Final verification)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| Sequential | 1 → 2,3 → 4 | Tasks 2,3 depend on Task 1; Task 4 is verification |
| A | 2, 3 | Can be done in parallel after Task 1 |

---

## TODOs

- [x] 1. Add links prop and rendering to NoteCardV2

  **What to do**:
  - Import `LinkPreviewCard` from `@/components/ui/LinkPreviewCard`
  - Add `NoteCardLink` interface to handle type normalization:
    ```typescript
    interface NoteCardLink {
      id: string;
      url: string;
      title?: string | null;
      description?: string | null;
      image_url?: string | null;  // Normalized from og_image
    }
    ```
  - Add props to `NoteCardV2Props`:
    ```typescript
    links?: NoteCardLink[];  // Link metadata for rich previews
    maxLinks?: number;  // Default: 2
    ```
  - Add links rendering section between content and tags:
    ```tsx
    {/* Link Previews */}
    {visibleLinks.length > 0 && (
      <div className="flex flex-col gap-2">
        {visibleLinks.map((link) => (
          <LinkPreviewCard
            key={link.id}
            link={{
              link_id: link.id,
              note_id: noteId,
              url: link.url,
              title: link.title ?? null,
              description: link.description ?? null,
              image_url: link.image_url ?? null,
              created_at: ''
            }}
            variant="thumbnail"
            onClick={(e) => e.stopPropagation()}
          />
        ))}
      </div>
    )}
    ```
  - Calculate `visibleLinks`:
    ```typescript
    const visibleLinks = (links || []).slice(0, maxLinks);
    ```
  - Add default value for maxLinks: `maxLinks = 2`

  **Must NOT do**:
  - Don't modify LinkPreviewCard component
  - Don't change existing renderContent() logic
  - Don't add new hooks

  **Parallelizable**: NO (foundation for other tasks)

  **References**:
  - `apps/web/components/notes/NoteCardV2.tsx` - Current component (full file)
  - `apps/web/components/ui/LinkPreviewCard.tsx:107-163` - Thumbnail variant implementation
  - `packages/shared/src/types.ts:137-145` - `NoteDetailLink` type for reference

  **Acceptance Criteria**:

  **Manual Verification**:
  - [ ] TypeScript compiles without errors: `pnpm --filter @telepocket/web build`
  - [ ] Component accepts `links` and `maxLinks` props

  **Commit**: NO (groups with 2, 3)

---

- [x] 2. Wire links from NotesList to NoteCardV2

  **What to do**:
  - In `NotesList.tsx`, update the NoteCardV2 usage (around line 100-105):
    ```tsx
    <NoteCardV2
      noteId={note.note_id}
      content={note.note_content}
      createdAt={note.created_at}
      tags={note.tags}
      links={note.links?.map((link: any) => ({
        id: link.id,
        url: link.url,
        title: link.title,
        description: link.description,
        image_url: link.og_image  // Map og_image → image_url
      }))}
    />
    ```
  - The `Note` interface in `useNotesList.ts` already has `links: any[]`

  **Must NOT do**:
  - Don't modify useNotesList hook
  - Don't change RPC calls

  **Parallelizable**: YES (with task 3, after task 1)

  **References**:
  - `apps/web/components/notes/NotesList.tsx:100-106` - Current NoteCardV2 usage
  - `apps/web/hooks/useNotesList.ts:5-14` - Note interface with links field
  - `packages/shared/supabase/migrations/20251204025149_add_tags_array_to_note_functions.sql:67-81` - RPC returns links JSONB

  **Acceptance Criteria**:

  **Manual Verification (using playwright browser automation)**:
  - [ ] Start dev server: `pnpm --filter @telepocket/web dev`
  - [ ] Navigate to notes list page
  - [ ] Find a note that has links (if none, create one via bot)
  - [ ] Verify link preview card appears below content text
  - [ ] Verify link preview shows title/description/image when available
  - [ ] Verify clicking link preview opens URL in new tab (doesn't navigate to note detail)
  - [ ] Verify note without links still renders correctly

  **Commit**: NO (groups with 3)

---

- [x] 3. Wire links from SearchResults to NoteCardV2

  **What to do**:
  - In `notes/page.tsx`, find SearchResults component (around line 440-455)
  - Update NoteCardV2 usage:
    ```tsx
    <NoteCardV2
      noteId={note.id}
      content={note.content}
      createdAt={note.created_at}
      tags={note.tags}
      links={note.links?.map((link) => ({
        id: link.id,
        url: link.url,
        title: link.title,
        description: null,  // Not available in HybridSearchResult
        image_url: null     // Not available in HybridSearchResult
      }))}
    />
    ```
  - Note: `HybridSearchResult.links` only has `id, url, title` - graceful degradation

  **Must NOT do**:
  - Don't modify HybridSearchResult type
  - Don't modify search RPCs
  - Don't add client-side metadata fetching

  **Parallelizable**: YES (with task 2, after task 1)

  **References**:
  - `apps/web/app/notes/page.tsx:447-452` - SearchResults NoteCardV2 usage
  - `packages/shared/src/types.ts:90-100` - HybridSearchResult type (links: { id, url, title }[])
  - `apps/web/hooks/useNotesSearch.ts:4` - Uses HybridSearchResult type

  **Acceptance Criteria**:

  **Manual Verification (using playwright browser automation)**:
  - [ ] Start dev server: `pnpm --filter @telepocket/web dev`
  - [ ] Navigate to notes page and enter a search query that matches notes with links
  - [ ] Verify search results show link preview cards (may be URL-only due to missing metadata)
  - [ ] Verify link preview cards are clickable and open URLs

  **Commit**: YES
  - Message: `feat(web): add link preview cards to note cards`
  - Files: 
    - `apps/web/components/notes/NoteCardV2.tsx`
    - `apps/web/components/notes/NotesList.tsx`
    - `apps/web/app/notes/page.tsx`
  - Pre-commit: `pnpm --filter @telepocket/web build`

---

- [x] 4. Final verification and edge case testing

  **What to do**:
  - Run comprehensive manual QA across all scenarios
  - Verify mobile layout with browser dev tools

  **Must NOT do**:
  - Don't make any code changes unless bugs found

  **Parallelizable**: NO (depends on 2, 3)

  **References**:
  - All modified files from tasks 1-3

  **Acceptance Criteria**:

  **Manual Verification (using playwright browser automation or dev tools)**:
  - [ ] **Note with 0 links**: Card renders correctly without link section
  - [ ] **Note with 1 link**: Shows 1 preview card
  - [ ] **Note with 3+ links**: Shows only 2 preview cards (max limit)
  - [ ] **Link without metadata**: Shows URL-only fallback (still clickable)
  - [ ] **Link with image**: Shows thumbnail image
  - [ ] **Link with broken image**: Fallback to emoji/icon placeholder
  - [ ] **Mobile viewport (375px)**: Cards don't overflow or break layout
  - [ ] **Click link preview**: Opens URL in new tab
  - [ ] **Click card (not preview)**: Navigates to note detail page

  **Commit**: NO (already committed in task 3)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 3 | `feat(web): add link preview cards to note cards` | NoteCardV2.tsx, NotesList.tsx, notes/page.tsx | `pnpm --filter @telepocket/web build` |

---

## Success Criteria

### Verification Commands
```bash
# Build succeeds
pnpm --filter @telepocket/web build

# Dev server runs
pnpm --filter @telepocket/web dev
```

### Final Checklist
- [ ] Notes with links show thumbnail preview cards
- [ ] Max 2 links per card
- [ ] Graceful fallback for missing metadata
- [ ] Link clicks open URLs (don't navigate to detail)
- [ ] Mobile layout intact
- [ ] No TypeScript errors
- [ ] GlanceSection unchanged (out of scope)
