# Client.ts Cleanup Plan

## Overview
Systematic removal of code that has been successfully extracted to modular files.
Each step will be verified before proceeding to the next.

## Current File Size
- **client.ts**: 2800 lines
- **Target**: ~1200 lines (only view methods + helpers)

---

## Step 1: Remove setupCommands() Method ✅ VERIFIED

**Lines to Remove**: 63-364 (~300 lines)

**What's Being Removed**:
- All command handlers (/start, /help, /note, /notes, /archived, /links, /search, /glance, /suggest, /classify)
- Photo message handler (message:photo)
- Callback query handler (callback_query)

**Verification**:
- ✅ /start → commands/start.ts
- ✅ /help → commands/help.ts
- ✅ /note → REMOVED (redundant)
- ✅ /notes → commands/notes.ts
- ✅ /archived → commands/archived.ts
- ✅ /links → commands/links.ts
- ✅ /search → commands/search.ts
- ✅ /glance → commands/glance.ts
- ✅ /suggest → commands/suggest.ts
- ✅ /classify → commands/classify.ts
- ✅ message:photo → handlers/messages.ts
- ✅ callback_query → handlers/callbacks.ts

**Status**: ✅ All commands and handlers extracted and working in production

---

## Step 2: Remove Extracted Classify Methods

**Methods to Remove**:
1. `runBatchClassification` (lines 2524-2718) → commands/classify.ts
2. `autoAssignPendingClassifications` (lines 2719-2762) → commands/classify.ts
3. `showClassificationSummary` (lines 2763-2794) → commands/classify.ts
4. `handleClassifyAssignClick` (lines 1944-2007) → commands/classify.ts (exported)

**Verification**:
- ✅ All methods copied to commands/classify.ts
- ✅ /classify command working in production
- ✅ Classification workflow tested

**Status**: ✅ Ready to remove

---

## Step 3: Remove Extracted Callback Helper

**Methods to Remove**:
1. `handleCategoryButtonClick` (lines 1898-1939) → handlers/callbacks.ts

**Verification**:
- ✅ Method copied to handlers/callbacks.ts
- ✅ Category button clicks working in production

**Status**: ✅ Ready to remove

---

## Step 4: Remove Extracted View Methods

**Methods to Remove**:
1. `showGlanceView` (lines 1180-1285) → views/glance.ts
2. `showSuggestView` (lines 1286-1352) → views/suggest.ts
3. `showSuggestViewWithQuery` (lines 1353-1430) → views/suggest.ts

**Verification**:
- ✅ All methods copied to views/
- ✅ /glance command working
- ✅ /suggest command working (both modes)

**Status**: ✅ Ready to remove

---

## Step 5: Remove createMainKeyboard Method

**Method to Remove**:
- `createMainKeyboard` (lines 56-61) → utils/keyboards.ts

**Verification**:
- ✅ Method extracted to utils/keyboards.ts
- ✅ All modules importing from utils/keyboards

**Status**: ✅ Ready to remove

---

## Step 6: Remove Classify-Related Properties

**Properties to Remove**:
- `pendingClassifications` (line 37) → commands/classify.ts
- `classificationTimeout` (line 38) → commands/classify.ts

**Verification**:
- ✅ Properties moved to commands/classify.ts
- ✅ Classification workflow working

**Status**: ✅ Ready to remove

---

## Step 7: Update Constructor

**Action**: Remove calls to removed methods
- Remove `this.setupCommands()` call

**Verification**:
- ✅ Commands now registered in bot.ts
- ✅ Bot assembly working correctly

**Status**: ✅ Ready to update

---

## Methods to KEEP (Still Used via Delegation)

**View Methods (Bound from bot.ts)**:
1. `showLinksPage` (line 737)
2. `showSearchResults` (line 836)
3. `showNotesPage` (line 933)
4. `showNotesByCategory` (line 1072)
5. `showNoteSearchResults` (line 1431)
6. `showLinksOnlyPage` (line 1536)
7. `showLinksOnlySearchResults` (line 1640)
8. `showUnifiedSearchResults` (line 1752)
9. `showNoteDetail` (line 2008)
10. `showDeleteConfirmation` (line 2132)
11. `deleteNoteAndReturn` (line 2162)
12. `toggleNoteMarkAndRefresh` (line 2182)
13. `archiveNoteAndReturn` (line 2206)
14. `unarchiveNoteAndReturn` (line 2226)
15. `showArchivedNotesPage` (line 2246)
16. `showArchivedNoteSearchResults` (line 2379)

**Helper Methods**:
1. `mergeSearchResults` (line 2479) - Used by showUnifiedSearchResults
2. `delay` (line 2795) - Utility method

**Core Methods**:
1. `setupErrorHandling` (line 50)
2. `sendMessage` (line 712)
3. `start` (line 727)
4. `stop` (line 732)
5. `isAuthorizedUser` - Used throughout

---

## Execution Order

1. ✅ Create this cleanup plan
2. Step 1: Remove setupCommands() method
3. Step 2: Remove classify methods
4. Step 3: Remove callback helper
5. Step 4: Remove extracted views
6. Step 5: Remove keyboard utility
7. Step 6: Remove classify properties
8. Step 7: Update constructor
9. Build and test
10. Verify all functionality works

---

## Safety Checks After Each Step

- [ ] File compiles without errors
- [ ] Bot starts successfully
- [ ] Test affected commands/features
- [ ] Check PM2 logs for errors

---

## Expected Final State

**Remaining in client.ts (~1200 lines)**:
- Constructor
- Error handling setup
- Core methods (start, stop, sendMessage)
- 16 view methods (used via delegation)
- 2 helper methods (mergeSearchResults, delay)
- isAuthorizedUser method
