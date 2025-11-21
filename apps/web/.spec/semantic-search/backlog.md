# Semantic Search Ideas Backlog

A pool of feature ideas, improvements, and technical debt items for future consideration.

---

## 🎯 High Priority Ideas

Ideas that would provide significant value or solve important problems.

- **Query embedding cache with Redis**: For high-traffic scenarios, move cache from in-memory to Redis for persistence across restarts
- **Embedding model versioning**: Track which embedding model version generated each vector, allow side-by-side comparison during upgrades
- **Semantic search for links-only view**: Apply same hybrid approach to `/links` command results

---

## 💡 Feature Ideas

New features or enhancements to consider.

- **Search suggestions/autocomplete**: Show popular queries as user types
- **Saved searches**: Allow users to bookmark frequent queries
- **Search filters**: Date range, category, relevance threshold sliders
- **Related notes**: "Notes similar to this one" feature using vector similarity
- **Multi-language embedding**: Support Japanese, Chinese notes with multilingual embedding models
- **Voice search**: Convert speech to text, then search (Web Speech API)
- **Search history**: Track user's past searches, allow quick re-run

---

## 🔧 Technical Improvements

Refactoring, optimization, and technical debt items.

- **HNSW index upgrade**: Better performance for >100K notes (10x faster than IVFFlat)
- **Embedding dimension tuning**: Test 384, 768, 1536 dimensions for quality/performance trade-off
- **Batch embedding API**: Process multiple notes per Gemini API call (reduce latency)
- **Streaming embeddings**: Use server-sent events for real-time search results as they're found
- **Database connection pooling**: Optimize Supabase connection reuse for high concurrency
- **CDN caching for common queries**: Cache popular search results at edge (Vercel Edge Functions)
- **Webhook for automatic re-embedding**: When note is edited, auto-regenerate embedding

---

## 🐛 Known Issues

Bugs or issues to investigate and fix.

- **Long query truncation**: Queries >2048 tokens are silently truncated, might affect accuracy
- **Embedding generation timeout**: If Gemini API is slow, search might timeout (needs circuit breaker)
- **Race condition on concurrent embeds**: Multiple processes embedding same note could cause duplicate work

---

## 🤔 Research Needed

Ideas that need more investigation or proof-of-concept.

- **Local embedding models**: Evaluate sentence-transformers for cost savings vs quality trade-off
- **Vector quantization**: Reduce storage by compressing 768 floats to lower precision
- **Hybrid index types**: Combine HNSW + IVFFlat for different query patterns
- **Semantic clustering**: Group similar notes automatically using k-means on embeddings
- **Cross-encoder re-ranking**: Use slower but more accurate model to re-rank top 100 results
- **Embedding fine-tuning**: Train custom embedding model on user's note corpus
- **Multi-modal embeddings**: Include image embeddings for notes with photos

---

## 📦 Backlog (Unprioritized)

Unsorted ideas that haven't been categorized yet.

<!-- Add new ideas here as they come up during development -->

---

## ✅ Implemented

Ideas that have been completed (for reference).

<!-- Move completed items here with date and brief description -->

---

## ❌ Rejected

Ideas that were considered but decided against (with reasoning).

- **Separate vector database (ChromaDB, Pinecone)**: Adds infrastructure complexity, data duplication, sync issues. pgvector in Supabase is sufficient for <1M notes.
- **Real-time embedding on every keystroke**: Too expensive (API costs), poor UX (flickering results). Stick with 300ms debounce.
