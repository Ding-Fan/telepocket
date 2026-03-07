# Link Preview Card Mobile Responsiveness Fix

## Context

### Original Request
User reported that link preview cards in note cards are "too small on mobile view" and need redesign or responsive treatment.

### Interview Summary
**Key Discussions**:
- User confirmed wanting responsive thumbnail approach (single variant, larger on mobile)
- No separate mobile variant needed
- Keep horizontal layout, just scale sizes appropriately

**Research Findings**:
- Current thumbnail variant uses `text-[10px]` title and `text-[9px]` description - well below minimum legible 12px
- Image is only 40px × 40px - too small to see details on mobile
- Icon is 12px - below 44px minimum touch target (though parent is clickable)
- Padding `p-2` (8px) makes it cramped on mobile

---

## Work Objectives

### Core Objective
Make the LinkPreviewCard thumbnail variant readable and usable on mobile devices while keeping it compact on desktop.

### Concrete Deliverables
- Updated `apps/web/components/ui/LinkPreviewCard.tsx` thumbnail variant with responsive sizing

### Definition of Done
- [ ] Text is minimum 12px (`text-xs`) on mobile
- [ ] Image is minimum 48px on mobile
- [ ] Card has adequate padding on mobile
- [ ] Desktop appearance remains compact
- [ ] Visual verification on 375px viewport

### Must Have
- Mobile-first responsive sizing (larger mobile, smaller desktop with `sm:` prefix)
- Readable text (min 12px on mobile)
- Visible thumbnail image

### Must NOT Have (Guardrails)
- No separate component - keep single variant
- No JavaScript viewport detection - use CSS only
- No breaking changes to existing props/interface
- Do not change `inline` or `detailed` variants

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (no component tests for LinkPreviewCard)
- **User wants tests**: Manual-only
- **Framework**: N/A

### Manual QA Required

**By Deliverable Type**: Frontend/UI changes require browser verification

**Evidence Required**:
- Screenshots of mobile viewport (375px)
- Screenshots of desktop viewport (768px+)
- Visual comparison before/after

---

## Task Flow

```
Task 1 (single task - CSS-only change)
```

## Parallelization

Not applicable - single focused task.

---

## TODOs

- [x] 1. Update LinkPreviewCard thumbnail variant with responsive sizing

  **What to do**:
  1. Open `apps/web/components/ui/LinkPreviewCard.tsx`
  2. Find the `// THUMBNAIL VARIANT` section (lines 105-163)
  3. Replace the fixed small sizes with responsive sizes:
  
  **Size Changes**:
  | Element | Current | Mobile (default) | Desktop (sm:) |
  |---------|---------|------------------|---------------|
  | Container gap | `gap-2` | `gap-3` | `sm:gap-2` |
  | Container padding | `p-2` | `p-3` | `sm:p-2` |
  | Image | `w-10 h-10` | `w-14 h-14` | `sm:w-10 sm:h-10` |
  | Image sizes attr | `40px` | `(max-width: 640px) 56px, 40px` | - |
  | Fallback emoji | `text-sm` | `text-base` | `sm:text-sm` |
  | Title | `text-[10px]` | `text-sm` | `sm:text-[11px]` |
  | Title line-clamp | `line-clamp-1` | `line-clamp-2` | `sm:line-clamp-1` |
  | Description | `text-[9px]` | `text-xs` | `sm:text-[10px]` |
  | Description line-clamp | `line-clamp-1` | `line-clamp-2` | `sm:line-clamp-1` |
  | Icon | `w-3 h-3` | `w-4 h-4` | `sm:w-3 sm:h-3` |
  | Icon wrapper | (none) | `p-1` | `sm:p-0` |

  **Updated code block** (replace lines 105-163):
  ```tsx
  // THUMBNAIL VARIANT - Compact preview for NoteCard
  // Responsive: Larger on mobile for readability, compact on desktop
  if (variant === 'thumbnail') {
    return (
      <div className="group flex items-start gap-3 sm:gap-2 p-3 sm:p-2 rounded-lg bg-ocean-900/30 border border-ocean-700/30 hover:border-cyan-500/50 transition-all duration-200 w-full">
        {/* Image thumbnail - larger on mobile */}
        <div className="relative w-14 h-14 sm:w-10 sm:h-10 flex-shrink-0 rounded-md overflow-hidden bg-ocean-800/50">
          {link.image_url && !imageError ? (
            <Image
              src={link.image_url}
              alt={link.title || 'Link preview'}
              fill
              className={`object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              sizes="(max-width: 640px) 56px, 40px"
              loading="lazy"
              onError={() => setImageError(true)}
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <span className="text-ocean-500 text-base sm:text-sm">🔗</span>
            </div>
          )}
        </div>

        {/* Title and description - readable text on mobile */}
        <div className="flex-1 min-w-0">
          {link.title && (
            <h5 className="text-ocean-100 font-medium text-sm sm:text-[11px] leading-snug sm:leading-tight line-clamp-2 sm:line-clamp-1 mb-0.5">
              {link.title}
            </h5>
          )}
          {link.description && (
            <p className="text-ocean-400 text-xs sm:text-[10px] leading-relaxed sm:leading-snug line-clamp-2 sm:line-clamp-1">
              {link.description}
            </p>
          )}
          {!link.title && !link.description && (
            <p className="text-ocean-400 text-xs sm:text-[10px] leading-relaxed sm:leading-snug line-clamp-1 font-mono">
              {link.url}
            </p>
          )}
        </div>

        {/* External link icon - larger tap target on mobile */}
        <div className="flex-shrink-0 text-ocean-500 group-hover:text-cyan-400 transition-colors p-1 sm:p-0">
          <svg className="w-4 h-4 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </div>
      </div>
    );
  }
  ```

  **Must NOT do**:
  - Do not modify `inline` variant (lines 36-102)
  - Do not modify `detailed` variant (lines 166-236)
  - Do not change the component interface

  **Parallelizable**: N/A (single task)

  **References**:

  **Pattern References**:
  - `apps/web/components/ui/LinkPreviewCard.tsx:107-163` - Current thumbnail variant to replace
  - `apps/web/components/ui/LinkPreviewCard.tsx:36-102` - Inline variant (reference for responsive pattern used)

  **Documentation References**:
  - Tailwind responsive: mobile-first with `sm:` prefix for 640px+

  **Acceptance Criteria**:

  **Manual Execution Verification:**

  - [ ] Using playwright browser automation:
    - Navigate to: `http://localhost:3002/notes` (or running dev server)
    - Resize to mobile: 375px width
    - Verify: Link preview text is readable (visually ~14px, not tiny)
    - Verify: Thumbnail image is visible (~56px)
    - Resize to desktop: 768px width
    - Verify: Link previews are compact (small text, 40px image)
    - Screenshot both viewports

  **Commit**: YES
  - Message: `fix(web): make link preview cards readable on mobile`
  - Files: `apps/web/components/ui/LinkPreviewCard.tsx`
  - Pre-commit: N/A (CSS-only change)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(web): make link preview cards readable on mobile` | LinkPreviewCard.tsx | Visual QA |

---

## Success Criteria

### Verification Commands
```bash
# Start dev server if not running
pnpm --filter @telepocket/web dev

# Build to ensure no TypeScript errors
pnpm --filter @telepocket/web build
```

### Final Checklist
- [ ] Text readable on mobile (min 12px / text-xs)
- [ ] Images visible on mobile (56px)
- [ ] Desktop remains compact
- [ ] No TypeScript errors
- [ ] Other variants unchanged
