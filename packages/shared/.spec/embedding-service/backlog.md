# Embedding Service Ideas Backlog

A pool of feature ideas, improvements, and technical debt items for future consideration.

---

## 🎯 High Priority Ideas

**Batch API Optimization**
- Use Google Gemini batch embedContent API
- Process 10+ texts per call
- 10x faster backfill (41 min → 4 min)
- Maintain same free tier cost

**Query Embedding Cache**
- In-memory cache for common search queries
- TTL: 1 hour
- Reduce API calls by 60%
- Faster search response times

---

## 💡 Feature Ideas

**Field-Specific Weighting**
- Boost title matches higher than descriptions
- Weight: title (1.0), description (0.6), URL (0.3)
- Improved search precision
- Configurable weights

**Multi-Language Support**
- Document best practices for non-English notes
- Test embedding quality across languages
- Consider language-specific models
- Gemini embeddings already multilingual

**Embedding Model Versioning**
- Store model version with embedding
- Support multiple models concurrently
- A/B test different embedding models
- Graceful migration between models

**Semantic-Only Search Mode**
- Toggle between hybrid and semantic-only
- For users who want pure meaning-based search
- Skip fuzzy/keyword matching
- Higher precision, potentially lower recall

---

## 🔧 Technical Improvements

**Increase Max Input Length**
- Raise from 2,000 → 3,000 characters
- Support notes with 5+ rich links
- Better context preservation
- Still under 2,048 token limit

**Parallel Batch Processing**
- Process multiple batches concurrently
- Respect rate limits across parallel workers
- Faster backfill for large datasets
- Requires careful rate limit coordination

**Embedding Compression**
- Vector quantization (768 → 256 dims)
- 3x smaller storage footprint
- Faster similarity search
- Minimal accuracy loss (<5%)

**Retry Logic with Exponential Backoff**
- Auto-retry failed API calls
- Exponential backoff (1s, 2s, 4s, 8s)
- Max 3 retries before giving up
- Better resilience to transient errors

**Embedding Analytics Dashboard**
- Track generation times by model
- Monitor cache hit rates
- Cost tracking (if using paid tier)
- Performance regression detection

---

## 🐛 Known Issues

**Link Description Not Embedded** ✅ **Fixed (2025-12-12)**
- Resolved by updating prepareNoteText()
- Re-ran backfill script
- Search relevance improved 30% → 90%+

**Text Truncation Edge Cases**
- Truncation at 2,000 chars might cut mid-word
- Could split multi-byte characters
- Consider smarter truncation (sentence boundary)
- Low priority (rare issue)

---

## 🤔 Research Needed

**Local Embedding Models**
- Investigate sentence-transformers library
- BERT, all-MiniLM-L6-v2, etc.
- No API cost or latency
- Requires GPU for good performance
- Privacy benefit (no external calls)

**Alternative Embedding APIs**
- OpenAI text-embedding-ada-002 (paid)
- Cohere embed-multilingual-v3.0 (paid)
- Hugging Face hosted inference
- Performance/cost comparison

**HNSW Index Migration**
- Research pgvector HNSW support
- IVFFlat → HNSW upgrade path
- Performance improvements at scale
- Complexity vs benefit analysis

**Semantic Clustering**
- Pre-cluster embeddings by topic
- Faster search via cluster pruning
- Automatic topic discovery
- May reduce search quality

**Hybrid Embedding Strategies**
- Separate embeddings for content vs metadata
- Combine with different weights
- More control over relevance
- Increased storage and complexity

---

## 📦 Backlog (Unprioritized)

- Streaming embeddings for large texts
- Embedding diff/delta for incremental updates
- Cross-lingual search (query in English, match Japanese notes)
- Embedding quality metrics (intrinsic evaluation)
- Synthetic query generation for testing
- Embedding visualization (t-SNE, UMAP)

---

## ✅ Implemented

**Embedding Service MVP** (2025-11-21)
- Google Gemini integration
- Rate limiting (60ms delay)
- Batch processing
- Backfill script
- Bot and web integration

**Link Description Fix** (2025-12-12)
- Updated prepareNoteText() to include descriptions
- Re-ran backfill for 679 notes
- Search relevance improved significantly

---

## ❌ Rejected

**Real-time Embedding Updates**
- Considered re-embedding on every note edit
- Rejected: Too expensive (API costs), unnecessary (embeddings stable)
- Alternative: Only re-embed if content significantly changed

**Client-Side Embedding Generation**
- Considered running embeddings in browser
- Rejected: Model too large (hundreds of MB), slow on mobile
- Alternative: Keep server-side with caching

**Embedding All Link Metadata**
- Considered embedding og_image URLs
- Rejected: Images are visual, not semantic text
- Alternative: Only embed textual metadata (title, description)
