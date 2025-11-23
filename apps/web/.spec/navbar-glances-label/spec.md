# Navbar "Glances" Label Specification

## Problem & Solution

**Problem**: Navbar label "Notes" is misleading. The home page shows a curated "Quick Glance" view with priority notes and category sections, not a full notes list. Users expecting to see all notes are confused and must click "See All Notes" to find the complete list.

**Solution**: Rename navbar label from "Notes" to "Glances" to accurately describe the page content. This aligns with the page's "Quick Glance" heading and clarifies that users are viewing a curated overview, not a comprehensive list.

**Returns**: Clear navigation labeling that matches page content and sets proper user expectations.

## Component API

```typescript
// config/navigation.ts
export const navigation = [
    { name: 'Glances', href: '/', icon: Home },
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Settings', href: '/settings', icon: Settings },
];
```

## Core Flow

```
User opens web app
  ↓
Sees navbar: [Glances] [Search] [Settings]
  ↓
Clicks "Glances" (or already on home page)
  ↓
Page shows "Quick Glance" heading
  ↓
User sees curated view:
  - High Priority section (pinned notes)
  - Category sections (Todo, Idea, Blog, YouTube, Reference)
  ↓
User clicks "See All Notes" if they want full list
  ↓
Full paginated notes list appears at /notes
```

## User Stories

**US-1: First-Time User**
New user opens web app, sees "Glances" in navbar. Clicks it and arrives at "Quick Glance" page showing curated priority notes. Label matches content, user understands this is an overview. User notices "See All Notes" button for complete list.

**US-2: Returning User from Search**
User finishes searching, wants to return to overview. Clicks "Glances" in navbar. Returns to curated view showing their most important notes. Clear distinction from full notes list.

**US-3: User Looking for Full List**
User clicks "Glances" thinking it's the full list. Sees "Quick Glance" heading and realizes it's a curated view. Spots "See All Notes" button prominently displayed. Clicks it to access complete notes list at `/notes`.

**US-4: User Understanding App Structure**
User explores app and learns navigation pattern:
- "Glances" = Quick overview of priority and categorized notes
- "See All Notes" button = Full paginated list
- "Search" = Find specific notes with filters

Clear labeling helps user build mental model of app structure.

## MVP Scope

**Included**:
- Change navbar label: "Notes" → "Glances"
- Update single navigation config file
- Label aligns with page heading "Quick Glance"
- Clear distinction between curated view and full list
- Maintains 3-item navbar (Glances, Search, Settings)

**NOT Included** (Future):
- Additional "All Notes" navbar item → 🔧 Robust
- Icon change for Glances → 🔧 Robust
- Tooltip explaining difference → 🔧 Robust
- Breadcrumb showing current section → 🚀 Advanced
- Customizable navbar labels → 🚀 Advanced

## Implementation Details

**Navigation Config**:
```typescript
// apps/web/config/navigation.ts

// Before
export const navigation = [
    { name: 'Notes', href: '/', icon: Home },  // ❌ Misleading
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Settings', href: '/settings', icon: Settings },
];

// After
export const navigation = [
    { name: 'Glances', href: '/', icon: Home },  // ✅ Accurate
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Settings', href: '/settings', icon: Settings },
];
```

**Page Content Structure**:
```
Home Page (/)
├── Navbar: "Glances" (highlighted)
├── Page Heading: "Quick Glance"
├── Priority Section
│   └── Pinned high-priority notes
├── Category Sections
│   ├── Todo
│   ├── Idea
│   ├── Blog
│   ├── YouTube
│   └── Reference
└── "See All Notes" button → /notes

Notes List Page (/notes)
├── Navbar: "Glances" (not highlighted)
├── Page Heading: "All Notes"
├── Filters and search
└── Paginated notes list
```

## Acceptance Criteria (MVP)

**Functional**:
- [x] Navigation config updated with "Glances" label
- [x] Label points to home page (`/`)
- [x] Home icon maintained
- [x] No broken links or navigation issues
- [x] Full notes list still accessible via "See All Notes" button

**UI/UX**:
- [x] Navbar shows "Glances" instead of "Notes"
- [x] Label aligns with page heading "Quick Glance"
- [x] Clear visual hierarchy maintained
- [x] User expectations set correctly
- [x] No confusion about page content

**Consistency**:
- [x] Label matches page content
- [x] Navigation flow remains intuitive
- [x] "See All Notes" button still prominent
- [x] No other references to change

**Testing**:
- [x] Build succeeds without errors
- [x] Navigation works correctly
- [x] All pages accessible
- [x] No console errors
- [x] Mobile and desktop views work

## Design Rationale

### Why "Glances" is Better

**Problems with "Notes"**:
- Generic and vague
- Implies complete list of all notes
- Doesn't reflect curated/priority nature
- Causes user confusion
- Mismatches page heading "Quick Glance"

**Benefits of "Glances"**:
- Accurately describes curated view
- Aligns with page heading
- Implies quick overview, not full list
- Sets correct user expectations
- Maintains concise navbar
- Professional and clear

### Alternative Options Considered

1. **"Home"**
   - Pro: Universal understanding
   - Con: Doesn't describe content
   - Verdict: Too generic

2. **"Dashboard"**
   - Pro: Implies overview
   - Con: Overly formal for note-taking app
   - Verdict: Too enterprise-y

3. **"Overview"**
   - Pro: Clear meaning
   - Con: More characters, less catchy
   - Verdict: Good but longer

4. **"Glances"** ✅ (Selected)
   - Pro: Matches page heading, concise, accurate
   - Con: None identified
   - Verdict: Best option

### User Mental Model

**Before (Confusing)**:
```
Navbar: "Notes"
  ↓
User thinks: "This is all my notes"
  ↓
Page shows: Curated glance view
  ↓
User confused: "Where are all my notes?"
```

**After (Clear)**:
```
Navbar: "Glances"
  ↓
User thinks: "This is a quick overview"
  ↓
Page shows: Curated glance view
  ↓
User satisfied: "Makes sense! See All Notes for complete list"
```

## Future Tiers

**🔧 Robust** (+2-3h):
- Add "All Notes" as separate navbar item
- Custom icon for Glances (eye or dashboard icon)
- Tooltip on hover: "Quick overview of priority notes"
- Active state styling improvements
- Badge showing count of priority items

**🚀 Advanced** (+6-8h):
- Customizable navbar labels (user preferences)
- Multiple view modes: Glance, List, Grid
- Quick-switch dropdown in navbar
- Keyboard shortcuts for navigation (G for Glances, N for Notes)
- Analytics tracking for navigation patterns
- A/B test different labels for optimal UX

## Analytics & Metrics

**Metrics to Track**:
- Clicks on "Glances" navbar item
- Time spent on glance view vs full notes list
- "See All Notes" button click rate
- User flow: Glances → All Notes → Detail
- Bounce rate from glance view

**Success Indicators**:
- Reduced confusion in user support requests
- Increased engagement with glance view
- More deliberate navigation to full list
- Positive user feedback on clarity

---

**Status**: ✅ Completed | **Actual Effort**: ~5 minutes | **Deployed**: 2025-11-23

## Implementation Summary

**Files Modified**:
- `apps/web/config/navigation.ts:4` - Changed label from "Notes" to "Glances"

**Key Changes**:
- ✅ Single-line change in navigation config
- ✅ Label now matches page content
- ✅ Clear distinction from full notes list
- ✅ No breaking changes to functionality
- ✅ Maintains existing navigation structure

**Impact**:
- **Clarity**: Users immediately understand page purpose
- **Alignment**: Navbar label matches page heading
- **Discovery**: Users know to look for "See All Notes" for complete list
- **Professional**: More intentional and precise labeling

**User Feedback Expected**:
- Positive: "Now I understand the difference between Glances and All Notes"
- Neutral: "Glances is a nice name for the overview"
- Action: Users will adapt to new label quickly

**No Breaking Changes**:
- URLs unchanged (home still at `/`)
- Navigation flow unchanged
- "See All Notes" button still prominent
- All existing functionality preserved
