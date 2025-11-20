# Telepocket Ideas Backlog

A pool of feature ideas, improvements, and technical debt items for future consideration.

---

## 🎯 High Priority Ideas

Ideas that would provide significant value or solve important problems.

<!-- Add ideas here -->

---

## 💡 Feature Ideas

New features or enhancements to consider.

<!-- Add ideas here -->

---

## 🔧 Technical Improvements

Refactoring, optimization, and technical debt items.

<!-- Add ideas here -->

---

## 🐛 Known Issues

Bugs or issues to investigate and fix.

<!-- Add ideas here -->

---

## 🤔 Research Needed

Ideas that need more investigation or proof-of-concept.

<!-- Add ideas here -->

---

## 📦 Backlog (Unprioritized)

Unsorted ideas that haven't been categorized yet.

<!-- Add ideas here -->

---

## ✅ Implemented

Ideas that have been completed (for reference).

- **Classify Command - Show All Categories**: Display buttons for ALL 6 categories during `/classify` (not just those with score > 0)
  - Spec: `.spec/classify-all-categories/spec.md`
  - Changes: Show all 6 category buttons sorted by LLM score, 3 per row layout, removed score display from buttons
  - Benefit: Users can manually override wrong LLM suggestions with full category control
  - Implementation: `src/bot/commands/classify.ts:191-215`
  - Deployed: 2025-11-16

- **Classify Command - Configurable Batch Size**: Added optional parameter to `/classify` command to specify batch size
  - Usage: `/classify [batch_size]` where batch_size is optional (default: 3, max: 50)
  - Examples: `/classify` (3 items), `/classify 10` (10 items), `/classify 50` (50 items max)
  - Implementation: Parse command argument in `src/bot/commands/classify.ts`, validate range 1-50, pass to batch classification logic
  - Deployed: 2025-11-16

- **Bot Architecture Restructuring (Phase 1)**: Extracted `/classify` command into modular structure using Composer pattern
  - Created `src/bot/commands/classify.ts`
  - Fixed callback data length bug with short-key mapping
  - Proved modular architecture pattern works

---

## ❌ Rejected

Ideas that were considered but decided against (with reasoning).

<!-- Add rejected ideas with brief explanation -->
