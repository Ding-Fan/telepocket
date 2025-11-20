# Classify Command - Show All Categories

## Problem & Solution

**Problem**: When `/classify` command shows classification results, it only displays category buttons for categories with LLM score > 0. This prevents users from manually assigning the correct category when the LLM completely misses or gets it wrong. Users are forced to use detail view or other workarounds to manually categorize.

**Solution**: Display buttons for ALL 6 categories (todo, idea, blog, youtube, reference, japanese) regardless of LLM confidence scores → User can override wrong LLM suggestions → Full manual control when AI fails.

**Returns**: Complete category button set for every classified item, giving users full control to override incorrect AI suggestions.

## Component API

```typescript
// No API changes needed - just UI change in classify command

// Current behavior (BEFORE):
// Only show buttons for categories where score > 0
const buttonsToShow = scores.filter(s => s.score > 0);

// Desired behavior (AFTER):
// Show ALL categories as buttons, sorted by score descending
const buttonsToShow = ALL_CATEGORIES.map(category => {
  const score = scores.find(s => s.category === category);
  return {
    category,
    score: score?.score || 0
  };
}).sort((a, b) => b.score - a.score);
```

## User Experience

### Before (Current)
```
📝 "Buy milk and eggs tomorrow"

Suggested categories:
[💡 Idea (score: 25)]

❌ Problem: Obviously a TODO, but LLM scored todo as 0
❌ User has no way to assign TODO category from this view
```

### After (Desired)
```
📝 "Buy milk and eggs tomorrow"

Assign category:
[📋 Todo] [💡 Idea] [📝 Blog] [📺 YouTube] [📖 Reference] [🇯🇵 Japanese]

✅ Solution: All 6 categories shown, user can click TODO
✅ Buttons ordered by LLM confidence (highest score first)
✅ User can override wrong AI suggestions
```

## Implementation Notes

### Location
- File: `src/bot/commands/classify.ts`
- Function: `runBatchClassification()` - section where buttons are built for pending items

### Changes Required

1. **Import all categories constant**
   ```typescript
   import { ALL_CATEGORIES } from '../../constants/noteCategories';
   ```

2. **Update button generation logic** (around line 150-200)
   ```typescript
   // BEFORE: Only add buttons for categories with score > 0
   for (const score of scores.filter(s => s.score > 0)) {
     // Add button
   }

   // AFTER: Add buttons for ALL categories, sorted by score
   const sortedCategories = ALL_CATEGORIES.map(category => {
     const scoreObj = scores.find(s => s.category === category);
     return {
       category,
       score: scoreObj?.score || 0
     };
   }).sort((a, b) => b.score - a.score);

   for (const item of sortedCategories) {
     // Add button with category
   }
   ```

3. **Button layout**
   - 3 buttons per row (consistent with existing UI)
   - Display format: `${CATEGORY_EMOJI[category]} ${CATEGORY_LABELS[category]}`
   - No need to show scores on buttons (cleaner UI)

### Edge Cases
- All categories shown even if all scores are 0
- Categories with score 0 still clickable
- Maintain short-key mapping system (already handles this)
- Callback data format unchanged: `ca:shortKey:category:type`

## Benefits

1. **Full Manual Control**: Users can always assign correct category
2. **Override AI Mistakes**: When LLM is completely wrong, user can fix it
3. **Consistent UX**: Same 6 category buttons every time (predictable interface)
4. **No Workarounds**: No need to use detail view just to categorize

## Testing Checklist

- [ ] `/classify` shows all 6 category buttons for every item
- [ ] Buttons ordered by LLM confidence score (highest first)
- [ ] Clicking category button assigns it correctly
- [ ] Works for both notes and links
- [ ] Short-key mapping handles all 6 categories
- [ ] UI remains clean (3 buttons per row)
- [ ] Categories with score 0 are clickable
