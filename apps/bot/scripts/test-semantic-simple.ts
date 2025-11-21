#!/usr/bin/env tsx
/**
 * Simple semantic search test
 *
 * Pre-requisites:
 * 1. Create a test note with content: "I need to learn machine learning and deep learning"
 * 2. Make sure it has an embedding (run backfill if needed)
 *
 * This test will:
 * 1. Find the note and verify it has an embedding
 * 2. Search with keyword "machine" (should match)
 * 3. Search with semantic query "AI tutorial" (should match semantically)
 *
 * Run: pnpm tsx apps/bot/scripts/test-semantic-simple.ts
 */

import { createClient } from '@supabase/supabase-js';
import { EmbeddingService } from '@telepocket/shared';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from apps/web/.env.local
dotenv.config({ path: path.resolve(__dirname, '../../web/.env.local') });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const TEST_USER_ID = process.env.TELEGRAM_USER_ID;

// Test data - HARD CODED
const TEST_NOTE_CONTENT = "I need to learn machine learning and deep learning";
const KEYWORD_QUERY = "machine"; // Word from the note
const SEMANTIC_QUERY = "AI tutorial"; // Semantic concept, not exact words

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GOOGLE_AI_API_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('- NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) console.error('- SUPABASE_SECRET_KEY');
  if (!GOOGLE_AI_API_KEY) console.error('- GOOGLE_AI_API_KEY');
  process.exit(1);
}

if (!TEST_USER_ID) {
  console.error('❌ Missing TELEGRAM_USER_ID in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const embeddingService = new EmbeddingService(GOOGLE_AI_API_KEY);

async function main() {
  console.log('🧪 Simple Semantic Search Test\n');
  console.log('=' .repeat(70));

  // Step 1: Find the test note
  console.log('\n📝 Step 1: Finding test note...');
  console.log(`   Looking for note with content: "${TEST_NOTE_CONTENT}"`);

  const { data: notes, error: findError } = await supabase
    .from('z_notes')
    .select('id, content, embedding, telegram_user_id')
    .eq('telegram_user_id', parseInt(TEST_USER_ID!))
    .eq('status', 'active')
    .ilike('content', `%${TEST_NOTE_CONTENT}%`)
    .limit(1);

  if (findError) {
    console.error(`   ❌ Error finding note: ${findError.message}`);
    process.exit(1);
  }

  if (!notes || notes.length === 0) {
    console.log(`   ❌ Test note not found!`);
    console.log(`
   Please create a test note first:
   1. Send this to your Telegram bot: "${TEST_NOTE_CONTENT}"
   2. Or insert directly:
      INSERT INTO z_notes (telegram_user_id, content, status, category)
      VALUES (${TEST_USER_ID}, '${TEST_NOTE_CONTENT}', 'active', 'todo');
   3. Run backfill script to generate embedding
   `);
    process.exit(1);
  }

  const testNote = notes[0];
  console.log(`   ✅ Note found!`);
  console.log(`      ID: ${testNote.id}`);
  console.log(`      Content: "${testNote.content}"`);
  console.log(`      Has embedding: ${testNote.embedding ? 'YES' : 'NO'}`);

  if (!testNote.embedding) {
    console.log(`   ❌ Note has no embedding!`);
    console.log(`
   Please run backfill script to generate embedding:
   pnpm tsx apps/bot/scripts/backfill-embeddings.ts
   `);
    process.exit(1);
  }

  const embeddingArray = testNote.embedding;
  console.log(`      Embedding type: ${typeof embeddingArray}`);
  console.log(`      Embedding is array: ${Array.isArray(embeddingArray)}`);

  if (typeof embeddingArray === 'string') {
    console.log(`      Embedding length (as string): ${embeddingArray.length}`);
    console.log(`      Embedding preview: ${embeddingArray.substring(0, 100)}...`);
  } else if (Array.isArray(embeddingArray)) {
    console.log(`      Embedding dimensions: ${embeddingArray.length}`);
    console.log(`      Embedding sample: [${embeddingArray.slice(0, 3).map((v: number) => v.toFixed(4)).join(', ')}...]`);
  } else {
    console.log(`      Embedding value:`, embeddingArray);
  }

  // Step 2: Keyword search test
  console.log('\n🔍 Step 2: Keyword Search Test');
  console.log(`   Query: "${KEYWORD_QUERY}" (should find the note)`);

  try {
    const keywordEmbedding = await embeddingService.generateEmbedding(KEYWORD_QUERY);

    const { data: keywordResults, error: keywordError } = await supabase.rpc('search_notes_hybrid', {
      query_embedding: keywordEmbedding,
      query_text: KEYWORD_QUERY,
      user_id: parseInt(TEST_USER_ID!),
      match_threshold: 0.5,
      page_size: 10
    });

    if (keywordError) {
      console.log(`   ❌ Search failed: ${keywordError.message}`);
    } else {
      console.log(`   ✅ Search returned ${keywordResults?.length || 0} results`);

      if (keywordResults && keywordResults.length > 0) {
        const foundTestNote = keywordResults.find((r: any) => r.id === testNote.id);

        if (foundTestNote) {
          console.log(`   ✅ Test note FOUND in results!`);
          console.log(`      Position: ${keywordResults.indexOf(foundTestNote) + 1} of ${keywordResults.length}`);
          console.log(`      Relevance score: ${foundTestNote.relevance_score?.toFixed(4)}`);
          console.log(`      Search type: ${foundTestNote.search_type}`);
        } else {
          console.log(`   ❌ Test note NOT found in results`);
          console.log(`   Top 3 results:`);
          keywordResults.slice(0, 3).forEach((r: any, i: number) => {
            const content = r.content || r.note_content || '';
            console.log(`      ${i + 1}. [${r.search_type}] ${content.substring(0, 50)}... (score: ${r.relevance_score?.toFixed(4)})`);
          });
        }
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${(error as Error).message}`);
  }

  // Step 3: Semantic search test
  console.log('\n🤖 Step 3: Semantic Search Test');
  console.log(`   Query: "${SEMANTIC_QUERY}" (semantic match, no exact words)`);

  try {
    const semanticEmbedding = await embeddingService.generateEmbedding(SEMANTIC_QUERY);

    const { data: semanticResults, error: semanticError } = await supabase.rpc('search_notes_hybrid', {
      query_embedding: semanticEmbedding,
      query_text: SEMANTIC_QUERY,
      user_id: parseInt(TEST_USER_ID!),
      match_threshold: 0.5,
      page_size: 10
    });

    if (semanticError) {
      console.log(`   ❌ Search failed: ${semanticError.message}`);
    } else {
      console.log(`   ✅ Search returned ${semanticResults?.length || 0} results`);

      if (semanticResults && semanticResults.length > 0) {
        const foundTestNote = semanticResults.find((r: any) => r.id === testNote.id);

        if (foundTestNote) {
          console.log(`   ✅ Test note FOUND in results!`);
          console.log(`      Position: ${semanticResults.indexOf(foundTestNote) + 1} of ${semanticResults.length}`);
          console.log(`      Relevance score: ${foundTestNote.relevance_score?.toFixed(4)}`);
          console.log(`      Search type: ${foundTestNote.search_type}`);
          console.log(`
   ✨ This proves semantic search works!
      Query "${SEMANTIC_QUERY}" doesn't contain "machine" or "learning"
      but it found the note because of semantic similarity.
          `);
        } else {
          console.log(`   ⚠️  Test note NOT found in results`);
          console.log(`   This might mean:`);
          console.log(`   - Semantic similarity too low (note content not similar enough)`);
          console.log(`   - Other notes have higher relevance`);
          console.log(`
   Top 3 results:`);
          semanticResults.slice(0, 3).forEach((r: any, i: number) => {
            const content = r.content || r.note_content || '';
            console.log(`      ${i + 1}. [${r.search_type}] ${content.substring(0, 50)}... (score: ${r.relevance_score?.toFixed(4)})`);
          });
        }
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${(error as Error).message}`);
  }

  // Step 4: Compare embeddings (calculate similarity manually)
  console.log('\n📊 Step 4: Manual Embedding Similarity Check');

  try {
    const semanticEmbedding = await embeddingService.generateEmbedding(SEMANTIC_QUERY);

    // Parse embedding if it's a string
    let noteEmbedding: number[];
    if (typeof testNote.embedding === 'string') {
      noteEmbedding = JSON.parse(testNote.embedding);
    } else {
      noteEmbedding = testNote.embedding;
    }

    // Calculate cosine similarity manually
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < 768; i++) {
      dotProduct += noteEmbedding[i] * semanticEmbedding[i];
      normA += noteEmbedding[i] * noteEmbedding[i];
      normB += semanticEmbedding[i] * semanticEmbedding[i];
    }

    const cosineSimilarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

    console.log(`   Query: "${SEMANTIC_QUERY}"`);
    console.log(`   Note: "${testNote.content}"`);
    console.log(`   Cosine similarity: ${cosineSimilarity.toFixed(4)}`);
    console.log(`
   Interpretation:
   - > 0.8: Very similar
   - 0.6-0.8: Similar
   - 0.4-0.6: Somewhat related
   - < 0.4: Not very related
   `);
  } catch (error) {
    console.log(`   ❌ Error: ${(error as Error).message}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Test Complete!\n');
}

main().catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});
