import { createClient } from '@supabase/supabase-js';
import { EmbeddingService } from '@telepocket/shared';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../web/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !GOOGLE_AI_API_KEY) {
    console.error('Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddingService = new EmbeddingService(GOOGLE_AI_API_KEY);

async function testMusicSearch() {
    console.log('🎵 Testing Music Video Search Quality\n');
    console.log('='.repeat(70));

    // Step 1: Find NightmareOwlMusic YouTube videos
    console.log('\n📺 Step 1: Finding NightmareOwlMusic videos...\n');

    // First, get notes with NightmareOwlMusic links
    const { data: allNotes, error: fetchError } = await supabase
        .from('z_notes')
        .select(`
            id,
            content,
            telegram_user_id,
            z_note_links!inner (
                id,
                url,
                title,
                description
            )
        `)
        .ilike('z_note_links.url', '%NightmareOwlMusic%')
        .limit(20);

    if (fetchError || !allNotes) {
        console.error('❌ Error fetching notes:', fetchError);
        process.exit(1);
    }

    // Filter for notes that have descriptions
    const musicNotes = allNotes.filter((note: any) => {
        const links = note.z_note_links || [];
        return links.length > 0 && links[0].description;
    });

    if (fetchError || !musicNotes || musicNotes.length === 0) {
        console.error('❌ Could not find NightmareOwlMusic videos:', fetchError);
        console.log('💡 Suggestion: Send a NightmareOwlMusic YouTube video link to the bot first');
        process.exit(1);
    }

    console.log(`Found ${musicNotes.length} NightmareOwlMusic videos\n`);

    // Pick the first music video for testing that actually has links
    const testNote = musicNotes.find((note: any) => {
        const links = note.z_note_links || [];
        return links.length > 0 && links[0].title && links[0].description;
    });

    if (!testNote) {
        console.error('❌ No videos found with complete link data');
        process.exit(1);
    }

    const links = testNote.z_note_links || [];
    const link = links[0];

    console.log('Selected test video:');
    console.log(`  ID: ${testNote.id}`);
    console.log(`  Content: "${testNote.content.substring(0, 80)}..."`);
    console.log(`  Title: ${link.title}`);
    console.log(`  Description: ${link.description?.substring(0, 100)}...`);
    console.log(`  URL: ${link.url}`);

    // Step 2: Show OLD embedding (without description)
    console.log('\n' + '='.repeat(70));
    console.log('📊 Step 2: Comparing OLD vs NEW embedding preparation\n');

    // Simulate old code (without description)
    const oldText = `${testNote.content}\nLinks: ${link.title} (${link.url})`;
    console.log('OLD prepared text (without description):');
    console.log('-'.repeat(70));
    console.log(oldText);
    console.log('-'.repeat(70));

    // New code (with description)
    const newText = embeddingService.prepareNoteText({
        content: testNote.content,
        links: links.map((l: any) => ({
            title: l.title,
            description: l.description,
            url: l.url
        }))
    });
    console.log('\nNEW prepared text (with description):');
    console.log('-'.repeat(70));
    console.log(newText);
    console.log('-'.repeat(70));

    const descriptionAdded = newText.length - oldText.length;
    console.log(`\n✅ Added ${descriptionAdded} characters of context from description`);

    // Step 3: Generate NEW embedding and update database
    console.log('\n' + '='.repeat(70));
    console.log('⚙️  Step 3: Generating NEW embedding and updating database...\n');

    const newEmbedding = await embeddingService.generateEmbedding(newText);
    console.log(`✅ Generated embedding: ${newEmbedding.length} dimensions`);

    const { error: updateError } = await supabase
        .from('z_notes')
        .update({ embedding: newEmbedding })
        .eq('id', testNote.id);

    if (updateError) {
        console.error('❌ Failed to update note:', updateError);
        process.exit(1);
    }
    console.log('✅ Database updated with new embedding');

    // Step 4: Test search with music-related queries
    console.log('\n' + '='.repeat(70));
    console.log('🔍 Step 4: Testing search with music-related queries...\n');

    const testQueries = [
        'music',
        'work bgm',
        'background music',
        'study music',
        'lofi',
        'electronic music',
        'relaxing music',
        'chill beats'
    ];

    const searchResults: { [key: string]: { found: boolean; score: number; rank: number } } = {};

    for (const query of testQueries) {
        console.log(`\nSearching for: "${query}"...`);

        const queryEmbedding = await embeddingService.generateEmbedding(query);

        const { data: results, error: searchError } = await supabase
            .rpc('search_notes_hybrid', {
                query_text: query,
                query_embedding: queryEmbedding,
                match_threshold: 0.3,
                page_size: 10,
                category_filter: null,
                user_id: testNote.telegram_user_id
            });

        if (searchError) {
            console.error(`  ❌ Search failed:`, searchError.message);
            searchResults[query] = { found: false, score: 0, rank: -1 };
            continue;
        }

        const foundIndex = results?.findIndex((r: any) => r.id === testNote.id);

        if (foundIndex !== undefined && foundIndex >= 0) {
            const result = results[foundIndex];
            const score = result.semantic_score || result.relevance_score || 0;
            searchResults[query] = { found: true, score, rank: foundIndex + 1 };
            console.log(`  ✅ Found at position #${foundIndex + 1} (semantic score: ${score.toFixed(3)}, type: ${result.search_type})`);
        } else {
            searchResults[query] = { found: false, score: 0, rank: -1 };
            console.log(`  ❌ Not found in top 10 results`);
        }
    }

    // Step 5: Summary and analysis
    console.log('\n' + '='.repeat(70));
    console.log('📈 Step 5: Search Quality Analysis\n');

    const foundCount = Object.values(searchResults).filter(r => r.found).length;
    const avgScore = Object.values(searchResults)
        .filter(r => r.found)
        .reduce((sum, r) => sum + r.score, 0) / (foundCount || 1);

    console.log(`Test Results:`);
    console.log(`  - Queries tested: ${testQueries.length}`);
    console.log(`  - Queries that found the video: ${foundCount}/${testQueries.length} (${Math.round(foundCount / testQueries.length * 100)}%)`);
    console.log(`  - Average semantic score: ${avgScore.toFixed(3)}`);

    console.log(`\nDetailed Results:`);
    Object.entries(searchResults).forEach(([query, result]) => {
        if (result.found) {
            console.log(`  ✅ "${query}": Rank #${result.rank}, Score ${result.score.toFixed(3)}`);
        } else {
            console.log(`  ❌ "${query}": Not found`);
        }
    });

    console.log('\n' + '='.repeat(70));

    if (foundCount >= testQueries.length * 0.7) {
        console.log('✅ PASS: Search quality is good (≥70% queries found the video)');
        console.log('💡 Ready to run full backfill script');
    } else if (foundCount >= testQueries.length * 0.5) {
        console.log('⚠️  MARGINAL: Search quality is moderate (50-70% queries found)');
        console.log('💡 Consider testing with more videos before full backfill');
    } else {
        console.log('❌ FAIL: Search quality is poor (<50% queries found)');
        console.log('💡 May need to investigate further or adjust match threshold');
    }

    console.log('='.repeat(70));
}

testMusicSearch().catch(console.error);
