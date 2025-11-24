# Archive Button UX Upgrade - Backlog

## Future Enhancements

### 🔧 Robust Tier (+2-3 hours)

#### 1. Custom Toast with Inline Undo Button
**Why**: More discoverable undo option, follows Gmail pattern exactly
**Current Limitation**: Toast provider only accepts strings, not React components

**Implementation**:
```typescript
// Upgrade ToastProvider to accept ReactNode
interface ToastMessage {
  id: string;
  message: string | ReactNode; // Allow components
  type: 'success' | 'error';
}

// Usage in NoteDetail
showToast(
  <div className="flex items-center justify-between gap-4">
    <span>📦 Note archived</span>
    <button onClick={handleUndo} className="...">
      Undo
    </button>
  </div>,
  'success'
);
```

**Impact**: Faster undo access, matches Gmail UX exactly
**Effort**: 1 hour
**Priority**: Medium

#### 2. Keyboard Shortcut Support (Cmd+Z / Ctrl+Z)
**Why**: Power users expect undo shortcut after destructive actions

**Implementation**:
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Only if archived and within grace period
    if (isArchived && (e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      handleUndo();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isArchived]);
```

**Impact**: Faster undo for keyboard users, professional touch
**Effort**: 1 hour
**Priority**: Medium

#### 3. Archive Confirmation Setting
**Why**: Some users prefer explicit confirmation before destructive actions

**Implementation**:
```typescript
// User Settings
interface UserPreferences {
  confirmBeforeArchive: boolean;
}

// In NoteDetail
const handleArchive = async () => {
  if (userPreferences.confirmBeforeArchive) {
    const confirmed = await showConfirmDialog({
      title: 'Archive note?',
      message: 'This note will be hidden from your active notes.',
      confirmLabel: 'Archive',
      cancelLabel: 'Cancel'
    });
    if (!confirmed) return;
  }

  // Proceed with archive...
};
```

**Impact**: Accommodates users who want extra safety
**Effort**: 2 hours
**Priority**: Low (most users prefer instant action)

#### 4. Improved Error Messages
**Current**: Generic "Failed to archive" message
**Proposed**: Specific error messages based on failure type

**Implementation**:
```typescript
onError: (error) => {
  const errorMessages = {
    'Network request failed': '📡 No internet connection - please try again',
    'Permission denied': '🔒 You don\'t have permission to archive this note',
    'Note not found': '❓ This note no longer exists',
    'default': `❌ Failed to archive: ${error.message}`
  };

  const message = errorMessages[error.message] || errorMessages.default;
  showToast(message, 'error');
}
```

**Impact**: Better troubleshooting for users
**Effort**: 1 hour
**Priority**: Medium

#### 5. Archive Animation Sound Effect
**Why**: Audio feedback enhances satisfaction (like macOS trash sound)

**Implementation**:
```typescript
const archiveSound = new Audio('/sounds/archive.mp3');

const handleArchive = async () => {
  setIsArchived(true);
  if (userPreferences.soundEffects) {
    archiveSound.play().catch(() => {}); // Ignore if blocked
  }
  // ... rest of logic
};
```

**Impact**: Delightful detail, premium feel
**Effort**: 30 minutes (+ sound design time)
**Priority**: Low (nice-to-have)

#### 6. Archive Success Animation
**Current**: Simple fade-out
**Proposed**: Checkmark animation before fade-out

**Implementation**:
```typescript
<div className="relative">
  {isArchived && (
    <div className="absolute inset-0 flex items-center justify-center animate-fade-in">
      <CheckCircle className="w-16 h-16 text-green-500 animate-scale-in" />
    </div>
  )}
  <div className={isArchived ? 'animate-fade-out-delayed' : ''}>
    {/* Note content */}
  </div>
</div>
```

**Impact**: Visual confirmation, satisfying feedback
**Effort**: 1 hour
**Priority**: Low

### 🚀 Advanced Tier (+6-10 hours)

#### 1. Animation Presets
**Why**: User preference, accessibility (motion sensitivity), brand customization

**Options**:
- **Fade**: Simple opacity change (current)
- **Slide Down**: Card slides down off screen
- **Zoom Out**: Card shrinks to center point
- **Flip**: 3D card flip effect
- **None**: Instant (for reduced motion preference)

**Implementation**:
```typescript
const animations = {
  fade: 'opacity-0 scale-95',
  slide: 'translate-y-full opacity-0',
  zoom: 'scale-0 opacity-0',
  flip: 'rotate-y-90 opacity-0',
  none: 'hidden'
};

<div className={`
  transition-all
  ${isArchived ? animations[userPreferences.archiveAnimation] : ''}
`}>
```

**Settings UI**:
- Visual preview of each animation
- Respect `prefers-reduced-motion` system setting
- Save preference to user settings

**Impact**: Personalization, accessibility compliance
**Effort**: 3 hours
**Priority**: Medium

#### 2. Configurable Grace Period
**Why**: Different users have different comfort levels

**Options**:
- 3 seconds (quick)
- 5 seconds (default)
- 10 seconds (comfortable)
- Never auto-navigate (manual only)

**Implementation**:
```typescript
const GRACE_PERIODS = {
  quick: 3000,
  default: 5000,
  comfortable: 10000,
  manual: Infinity
};

setTimeout(() => {
  if (isArchived && userPreferences.gracePeriod !== 'manual') {
    router.back();
  }
}, GRACE_PERIODS[userPreferences.gracePeriod]);
```

**Impact**: Accommodates different user speeds
**Effort**: 2 hours
**Priority**: Low

#### 3. Archive History View
**Why**: Users want to see what they've archived, restore old notes

**Features**:
- Dedicated "Archived Notes" page
- List view with search and filters
- Bulk unarchive (select multiple)
- Permanent delete option
- Archive date sorting
- Category filtering
- Search within archived notes

**Routes**:
```
/notes/archived - Main archived view
/notes/archived?category=todo - Filtered view
/notes/archived/[id] - Individual archived note
```

**Implementation**:
```typescript
// Page: app/notes/archived/page.tsx
export default function ArchivedNotesPage() {
  const { notes, loading } = useArchivedNotes({
    userId,
    pageSize: 20
  });

  return (
    <AppLayout>
      <ArchivedNotesList
        notes={notes}
        onUnarchive={handleBulkUnarchive}
        onDelete={handlePermanentDelete}
      />
    </AppLayout>
  );
}
```

**Database**:
```sql
-- Add archived_at timestamp
ALTER TABLE z_notes ADD COLUMN archived_at TIMESTAMPTZ;

-- Update when archiving
UPDATE z_notes
SET status = 'archived', archived_at = NOW()
WHERE id = $1;
```

**Impact**: Complete archive management, user control
**Effort**: 8 hours
**Priority**: High (very useful feature)

#### 4. Archive Queue with Batch Undo
**Why**: Multiple archives in quick succession, bulk operations

**Scenario**:
User archives 3 notes in quick succession:
```
Toast shows: "3 notes archived [Undo All]"
```

**Implementation**:
```typescript
const [archiveQueue, setArchiveQueue] = useState<string[]>([]);

const handleArchive = () => {
  setArchiveQueue(prev => [...prev, noteId]);
  // Show combined toast
  showToast(`${archiveQueue.length + 1} notes archived`, 'success');
};

const handleUndoAll = async () => {
  await Promise.all(
    archiveQueue.map(id => unarchiveNote(id, userId))
  );
  setArchiveQueue([]);
};
```

**Impact**: Efficient bulk operations
**Effort**: 4 hours
**Priority**: Low (rare use case)

#### 5. Archive Analytics Dashboard
**Why**: Understand user behavior, optimize UX

**Metrics to Track**:
```typescript
interface ArchiveAnalytics {
  // Frequency
  totalArchives: number;
  archivesPerDay: number;
  archivesByCategory: Record<NoteCategory, number>;

  // Undo behavior
  undoRate: number; // % of archives that get undone
  averageTimeToUndo: number; // milliseconds
  undosByReason: {
    accidental: number;
    changed_mind: number;
    testing: number;
  };

  // Performance
  averageArchiveTime: number; // time to complete archive
  errorRate: number; // % of failed archives
  graceTimeoutRate: number; // % that auto-navigate
}
```

**Dashboard Views**:
- Archive trends over time (chart)
- Category breakdown (pie chart)
- Undo rate analysis
- Error log with stack traces
- User feedback correlation

**Implementation**:
```typescript
// Track archive event
analytics.track('note_archived', {
  noteId,
  category,
  timestamp: Date.now(),
  gracePeriod: 5000
});

// Track undo event
analytics.track('archive_undone', {
  noteId,
  timeSinceArchive: Date.now() - archiveTime,
  reason: 'user_initiated'
});
```

**Impact**: Data-driven UX improvements
**Effort**: 6 hours
**Priority**: Low (nice-to-have)

#### 6. Optimistic UI Updates
**Why**: Even faster perceived performance

**Current**: Archive → server → update UI
**Proposed**: Update UI → archive → confirm/revert

**Implementation**:
```typescript
// In useArchiveNoteMutation
onMutate: async ({ noteId, userId }) => {
  // Cancel outgoing queries
  await queryClient.cancelQueries(['glance-data', userId]);

  // Snapshot current state
  const previousData = queryClient.getQueryData(['glance-data', userId]);

  // Optimistically update cache
  queryClient.setQueryData(['glance-data', userId], (old) => {
    return {
      ...old,
      notes: old.notes.filter(n => n.note_id !== noteId)
    };
  });

  return { previousData };
},
onError: (err, variables, context) => {
  // Rollback on error
  if (context?.previousData) {
    queryClient.setQueryData(
      ['glance-data', variables.userId],
      context.previousData
    );
  }
}
```

**Impact**: Instant UI response, feels instantaneous
**Effort**: 2 hours
**Priority**: Medium

#### 7. Archive Reasons (Optional Tags)
**Why**: Understand why users archive, help rediscover later

**UI**:
```
[Archive button clicked]
  ↓
Modal appears:
  "Why are you archiving this note?"
  ○ No longer relevant
  ○ Task completed
  ○ Duplicate content
  ○ Moving to another system
  ○ Other

  [Skip] [Archive with reason]
```

**Schema**:
```sql
ALTER TABLE z_notes ADD COLUMN archive_reason TEXT;
```

**Impact**: Better archive organization, future AI insights
**Effort**: 3 hours
**Priority**: Low

#### 8. Smart Auto-Archive Suggestions
**Why**: Help users maintain clean notes with AI assistance

**Features**:
- Suggest archiving notes not viewed in 30+ days
- Detect completed tasks (contains "✓" or "Done")
- Identify duplicate content
- Find outdated links (404s, expired domains)

**Implementation**:
```typescript
// Cron job or periodic check
const autoArchiveSuggestions = await analyzeNotes({
  userId,
  rules: [
    { type: 'stale', daysUnviewed: 30 },
    { type: 'completed', markers: ['✓', 'Done', 'Completed'] },
    { type: 'duplicate', similarity: 0.9 },
    { type: 'broken_links', checkUrls: true }
  ]
});

// Show in UI
<Banner>
  Found 5 notes that might be ready to archive
  [Review suggestions]
</Banner>
```

**Impact**: Automated maintenance, cleaner notes
**Effort**: 10 hours
**Priority**: Low (future AI feature)

## Accessibility Improvements

### 1. Screen Reader Announcements
**Current**: Visual-only feedback
**Proposed**: Announce state changes to screen readers

**Implementation**:
```typescript
// ARIA live region
<div role="status" aria-live="polite" className="sr-only">
  {isArchived ? 'Note archived. Press Undo to restore.' : ''}
</div>
```

**Impact**: Accessible to visually impaired users
**Effort**: 30 minutes
**Priority**: High (accessibility is important)

### 2. Keyboard Focus Management
**Current**: Focus stays on archive button after animation
**Proposed**: Move focus to undo button after archive

**Implementation**:
```typescript
const undoButtonRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
  if (isArchived && undoButtonRef.current) {
    undoButtonRef.current.focus();
  }
}, [isArchived]);
```

**Impact**: Better keyboard navigation
**Effort**: 15 minutes
**Priority**: Medium

### 3. Reduced Motion Support
**Current**: Animations play for everyone
**Proposed**: Respect prefers-reduced-motion system setting

**Implementation**:
```typescript
const prefersReducedMotion = useReducedMotion();

<div className={`
  ${prefersReducedMotion
    ? 'hidden' // Instant hide
    : 'transition-all duration-300 opacity-0 scale-95' // Animated
  }
`}>
```

**Impact**: Accessibility for motion-sensitive users
**Effort**: 30 minutes
**Priority**: High

## Performance Optimizations

### 1. Animation with Will-Change
**Why**: Better GPU performance on complex animations

**Implementation**:
```css
.archive-animation {
  will-change: opacity, transform;
  transition: opacity 300ms, transform 300ms;
}
```

**Impact**: Smoother 60fps animations
**Effort**: 15 minutes
**Priority**: Low (already performs well)

### 2. Debounce Multiple Archive Clicks
**Current**: Disabled state prevents duplicates
**Proposed**: Visual feedback for rapid clicks

**Implementation**:
```typescript
const handleArchive = useMemo(
  () => debounce(archiveHandler, 300, { leading: true, trailing: false }),
  []
);
```

**Impact**: Prevents accidental double-archives
**Effort**: 15 minutes
**Priority**: Low (already handled by disabled state)

## Testing & QA Enhancements

### 1. Automated E2E Tests
**Why**: Ensure archive flow works across updates

**Implementation**:
```typescript
// tests/e2e/archive-flow.spec.ts
describe('Archive Note Flow', () => {
  it('archives note with smooth animation', async () => {
    await page.click('[data-testid="archive-button"]');
    await expect(page.locator('.note-card')).toHaveClass(/opacity-0/);
    await expect(page.locator('[data-testid="undo-button"]')).toBeVisible();
  });

  it('undoes archive successfully', async () => {
    await page.click('[data-testid="archive-button"]');
    await page.click('[data-testid="undo-button"]');
    await expect(page.locator('.note-card')).toHaveClass(/opacity-100/);
  });
});
```

**Impact**: Prevent regressions
**Effort**: 2 hours
**Priority**: Medium

### 2. Visual Regression Testing
**Why**: Ensure animations look correct across updates

**Tools**: Percy, Chromatic, or Playwright screenshots

**Impact**: Catch visual bugs early
**Effort**: 2 hours setup
**Priority**: Low

---

## Prioritization Matrix

| Feature | Impact | Effort | Priority | Tier |
|---------|--------|--------|----------|------|
| Inline undo toast button | High | Low | **P1** | Robust |
| Keyboard shortcut (Cmd+Z) | Medium | Low | **P1** | Robust |
| Reduced motion support | High | Low | **P1** | Robust |
| Screen reader announcements | High | Low | **P1** | Robust |
| Archive history view | High | High | **P2** | Advanced |
| Optimistic UI updates | Medium | Low | **P2** | Advanced |
| Improved error messages | Medium | Low | **P2** | Robust |
| Animation presets | Low | Medium | **P3** | Advanced |
| Archive analytics | Low | High | **P3** | Advanced |
| Auto-archive suggestions | Low | Very High | **P4** | Advanced |

## Next Steps

1. ✅ Complete MVP (Done)
2. Gather user feedback for 2-4 weeks
3. Monitor analytics (undo rate, error rate)
4. Prioritize P1 items based on feedback
5. Implement accessibility improvements (high priority)
6. Consider archive history view (highly requested feature)
7. Revisit backlog quarterly based on usage data
