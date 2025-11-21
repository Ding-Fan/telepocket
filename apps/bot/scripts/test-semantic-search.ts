#!/usr/bin/env tsx
/**
 * Minimal test to verify semantic search implementation
 * Tests each component step-by-step to identify issues
 *
 * Run: pnpm tsx apps/bot/scripts/test-semantic-search.ts
 */

import { createClient } from '@supabase/supabase-js';
import { embeddingService } from '@telepocket/shared';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from apps/web/.env.local
dotenv.config({ path: path.resolve(__dirname, '../../web/.env.local') });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
const TEST_USER_ID = process.env.TELEGRAM_USER_ID; // Your Telegram user ID for testing

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('- NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) console.error('- SUPABASE_SECRET_KEY');
  process.exit(1);
}

if (!TEST_USER_ID) {
  console.error('❌ Missing TELEGRAM_USER_ID in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: [] as Array<{ name: string; status: 'PASS' | 'FAIL'; message?: string }>
};

function logTest(name: string, passed: boolean, message?: string) {
  results.tests.push({ name, status: passed ? 'PASS' : 'FAIL', message });
  if (passed) {
    console.log(`✅ ${name}`);
    results.passed++;
  } else {
    console.log(`❌ ${name}${message ? `: ${message}` : ''}`);
    results.failed++;
  }
}

async function test1_DatabaseSetup() {
  console.log('\n🔍 Test 1: Database Setup\n');

  // Check pgvector extension
  const { data: extensions, error: extError } = await supabase
    .from('pg_extension')
    .select('extname')
    .eq('extname', 'vector')
    .single();

  logTest(
    'T1.1: pgvector extension enabled',
    !extError && extensions?.extname === 'vector',
    extError?.message
  );

  // Check embedding column exists
  const { data: notes, error: colError } = await supabase
    .from('z_notes')
    .select('id, embedding')
    .limit(1);

  logTest(
    'T1.2: embedding column exists in z_notes',
    !colError,
    colError?.message
  );

  // Check if any notes have embeddings
  const { data: embeddedNotes, error: embError } = await supabase
    .from('z_notes')
    .select('id, embedding')
    .not('embedding', 'is', null)
    .limit(1);

  logTest(
    'T1.3: At least one note has embedding',
    !embError && embeddedNotes && embeddedNotes.length > 0,
    embError?.message || 'No notes with embeddings found'
  );

  // Count notes with embeddings
  const { count, error: countError } = await supabase
    .from('z_notes')
    .select('id', { count: 'exact', head: true })
    .not('embedding', 'is', null);

  console.log(`   📊 Notes with embeddings: ${count || 0}`);
}

async function test2_EmbeddingService() {
  console.log('\n🔍 Test 2: Embedding Service\n');

  try {
    // Test single embedding generation
    const testText = 'This is a test note about machine learning';
    const embedding = await embeddingService.generateEmbedding(testText);

    logTest(
      'T2.1: generateEmbedding() returns array',
      Array.isArray(embedding),
      `Got type: ${typeof embedding}`
    );

    logTest(
      'T2.2: Embedding has 768 dimensions',
      embedding.length === 768,
      `Got ${embedding.length} dimensions`
    );

    logTest(
      'T2.3: Embedding contains numbers',
      embedding.every(v => typeof v === 'number' && !isNaN(v)),
      'Some values are not valid numbers'
    );

    // Test prepareNoteText
    const noteData = {
      content: 'Test note content',
      links: [
        { url: 'https://example.com', title: 'Example Site' }
      ]
    };
    const preparedText = embeddingService.prepareNoteText(noteData);

    logTest(
      'T2.4: prepareNoteText() includes content',
      preparedText.includes('Test note content'),
      'Content not found in prepared text'
    );

    logTest(
      'T2.5: prepareNoteText() includes link metadata',
      preparedText.includes('Example Site') || preparedText.includes('example.com'),
      'Link metadata not found in prepared text'
    );

  } catch (error) {
    logTest('T2.1: generateEmbedding() returns array', false, (error as Error).message);
    logTest('T2.2: Embedding has 768 dimensions', false, 'Previous test failed');
    logTest('T2.3: Embedding contains numbers', false, 'Previous test failed');
    logTest('T2.4: prepareNoteText() includes content', false, 'Previous test failed');
    logTest('T2.5: prepareNoteText() includes link metadata', false, 'Previous test failed');
  }
}

async function test3_SemanticSearchRPC() {
  console.log('\n🔍 Test 3: Semantic Search RPC Function\n');

  try {
    // Generate test query embedding
    const queryEmbedding = await embeddingService.generateEmbedding('machine learning tutorial');

    // Test semantic search RPC
    const { data, error } = await supabase.rpc('search_notes_semantic', {
      query_embedding: queryEmbedding,
      user_id: parseInt(TEST_USER_ID!),
      match_threshold: 0.5,
      page_size: 5
    });

    logTest(
      'T3.1: search_notes_semantic RPC exists',
      !error || !error.message.includes('function') && !error.message.includes('does not exist'),
      error?.message
    );

    if (!error) {
      logTest(
        'T3.2: RPC returns array',
        Array.isArray(data),
        `Got type: ${typeof data}`
      );

      if (Array.isArray(data) && data.length > 0) {
        const firstResult = data[0];
        logTest(
          'T3.3: Results have required fields',
          firstResult.note_id && firstResult.note_content && firstResult.relevance_score !== undefined,
          `Missing fields in result: ${JSON.stringify(Object.keys(firstResult))}`
        );

        console.log(`   📊 Semantic search returned ${data.length} results`);
        console.log(`   📊 Top result score: ${firstResult.relevance_score?.toFixed(3)}`);
      } else {
        console.log('   ⚠️  No results returned (might be expected if no matching notes)');
      }
    }

  } catch (error) {
    logTest('T3.1: search_notes_semantic RPC exists', false, (error as Error).message);
    logTest('T3.2: RPC returns array', false, 'Previous test failed');
    logTest('T3.3: Results have required fields', false, 'Previous test failed');
  }
}

async function test4_HybridSearchRPC() {
  console.log('\n🔍 Test 4: Hybrid Search RPC Function\n');

  try {
    // Generate test query embedding
    const queryText = 'todo task';
    const queryEmbedding = await embeddingService.generateEmbedding(queryText);

    // Test hybrid search RPC
    const { data, error } = await supabase.rpc('search_notes_hybrid', {
      query_embedding: queryEmbedding,
      query_text: queryText,
      user_id: parseInt(TEST_USER_ID!),
      page_num: 1,
      page_size: 10
    });

    logTest(
      'T4.1: search_notes_hybrid RPC exists',
      !error || !error.message.includes('function') && !error.message.includes('does not exist'),
      error?.message
    );

    if (!error) {
      logTest(
        'T4.2: RPC returns array',
        Array.isArray(data),
        `Got type: ${typeof data}`
      );

      if (Array.isArray(data) && data.length > 0) {
        const firstResult = data[0];
        logTest(
          'T4.3: Results have search_type field',
          firstResult.search_type !== undefined,
          `Missing search_type. Fields: ${JSON.stringify(Object.keys(firstResult))}`
        );

        logTest(
          'T4.4: Results have combined relevance_score',
          firstResult.relevance_score !== undefined && firstResult.relevance_score >= 0,
          `Invalid score: ${firstResult.relevance_score}`
        );

        console.log(`   📊 Hybrid search returned ${data.length} results`);
        console.log(`   📊 Top result score: ${firstResult.relevance_score?.toFixed(3)}`);
        console.log(`   📊 Top result type: ${firstResult.search_type}`);

        // Check distribution of search types
        const types = data.map((r: any) => r.search_type);
        const typeCount = types.reduce((acc: any, t: string) => {
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {});
        console.log(`   📊 Search type distribution:`, typeCount);
      } else {
        console.log('   ⚠️  No results returned (might be expected)');
      }
    }

  } catch (error) {
    logTest('T4.1: search_notes_hybrid RPC exists', false, (error as Error).message);
    logTest('T4.2: RPC returns array', false, 'Previous test failed');
    logTest('T4.3: Results have search_type field', false, 'Previous test failed');
    logTest('T4.4: Results have combined relevance_score', false, 'Previous test failed');
  }
}

async function test5_EndToEndSearch() {
  console.log('\n🔍 Test 5: End-to-End Search Scenarios\n');

  const testQueries = [
    { query: 'latest todo', expectedCategory: 'todo' },
    { query: 'machine learning', expectedType: 'semantic' },
    { query: 'help find job', expectedType: 'semantic' }
  ];

  for (const { query, expectedCategory, expectedType } of testQueries) {
    try {
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      const { data, error } = await supabase.rpc('search_notes_hybrid', {
        query_embedding: queryEmbedding,
        query_text: query,
        user_id: parseInt(TEST_USER_ID!),
        page_num: 1,
        page_size: 5
      });

      if (!error && data && data.length > 0) {
        console.log(`   ✅ Query "${query}": ${data.length} results`);
        console.log(`      Top result: ${data[0].note_content.substring(0, 60)}...`);
        console.log(`      Score: ${data[0].relevance_score?.toFixed(3)}, Type: ${data[0].search_type}`);
      } else {
        console.log(`   ⚠️  Query "${query}": No results${error ? ` (${error.message})` : ''}`);
      }
    } catch (error) {
      console.log(`   ❌ Query "${query}": ${(error as Error).message}`);
    }
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Semantic Search Test Suite');
  console.log('=' .repeat(60));

  await test1_DatabaseSetup();
  await test2_EmbeddingService();
  await test3_SemanticSearchRPC();
  await test4_HybridSearchRPC();
  await test5_EndToEndSearch();

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  // Show failed tests
  const failedTests = results.tests.filter(t => t.status === 'FAIL');
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(t => {
      console.log(`   • ${t.name}${t.message ? `: ${t.message}` : ''}`);
    });
  }

  process.exit(failedTests.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
