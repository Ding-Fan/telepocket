import { createClient } from '@supabase/supabase-js';
import { EmbeddingService } from '@telepocket/shared';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../web/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddingService = new EmbeddingService(GOOGLE_AI_API_KEY);

async function testAmbientMusicSearch() {
    console.log('🎵 Testing Ambient Music Search Quality\n');
    console.log('='.repeat(70));

    // Use the ambient rain/fireplace video
    const linkId = '9f54f5d6-0079-46d0-9765-064c01fb5f57';

    console.log('\n📺 Step 1: Loading test video...\n');

    const { data: link, error: linkError } = await supabase
        .from('z_note_links')
        .select('*')
        .eq('id', linkId)
        .single();

    if (linkError || !link) {
        console.error('❌ Could not find link:', linkError);
        process.exit(1);
    }

    const { data: note, error: noteError } = await supabase
        .from('z_notes')
        .select('*')
        .eq('id', link.note_id)
        .single();

    if (noteError || !note) {
        console.error('❌ Could not find note:', noteError);
        process.exit(1);
    }

    console.log('Test video:');
    console.log(`  Title: ${link.title}`);
    console.log(`  Description: ${link.description?.substring(0, 120)}...`);
    console.log(`  Note ID: ${note.id}`);

    // Step 2: Compare OLD vs NEW
    console.log('\n' + '='.repeat(70));
    console.log('📊 Step 2: Comparing OLD vs NEW embeddings\n');

    const oldText = `${note.content}\nLinks: ${link.title} (${link.url})`;
    console.log('OLD (NO description):');
    console.log(oldText.substring(0, 200));
    console.log('...\n');

    const newText = embeddingService.prepareNoteText({
        content: note.content,
        links: [{
            title: link.title,
            description: link.description,
            url: link.url
        }]
    });

    console.log('NEW (WITH description):');
    console.log(newText.substring(0, 400));
    console.log('...\n');

    console.log(`✅ Added ${newText.length - oldText.length} characters of context`);

    // Step 3: Generate NEW embedding
    console.log('\n' + '='.repeat(70));
    console.log('⚙️  Step 3: Generating NEW embedding...\n');

    const newEmbedding = await embeddingService.generateEmbedding(newText);
    console.log(`✅ Generated: ${newEmbedding.length} dimensions`);

    const { error: updateError } = await supabase
        .from('z_notes')
        .update({ embedding: newEmbedding })
        .eq('id', note.id);

    if (updateError) {
        console.error('❌ Update failed:', updateError);
        process.exit(1);
    }
    console.log('✅ Database updated');

    // Step 4: Test search
    console.log('\n' + '='.repeat(70));
    console.log('🔍 Step 4: Testing search queries...\n');

    const queries = [
        'rain sounds',
        'relaxing music',
        'study music',
        'sleep music',
        'ambient sounds',
        'fireplace',
        'asmr',
        'background music'
    ];

    let foundCount = 0;
    const results: Array<{ query: string; found: boolean; rank?: number; score?: number }> = [];

    for (const query of queries) {
        const qEmbed = await embeddingService.generateEmbedding(query);

        const { data: searchResults, error: searchError } = await supabase
            .rpc('search_notes_hybrid', {
                query_text: query,
                query_embedding: qEmbed,
                match_threshold: 0.3,
                page_size: 10,
                category_filter: null,
                user_id: note.telegram_user_id
            });

        if (searchError) {
            console.log(`  ❌ "${query}": Error - ${searchError.message}`);
            results.push({ query, found: false });
            continue;
        }

        const foundIndex = searchResults?.findIndex((r: any) => r.id === note.id);
        if (foundIndex !== undefined && foundIndex >= 0) {
            const result = searchResults[foundIndex];
            const score = result.semantic_score || result.relevance_score || 0;
            const rank = foundIndex + 1;
            console.log(`  ✅ "${query}": Rank #${rank}, Score ${score.toFixed(3)}, Type: ${result.search_type}`);
            results.push({ query, found: true, rank, score });
            foundCount++;
        } else {
            console.log(`  ❌ "${query}": Not in top 10`);
            results.push({ query, found: false });
        }
    }

    // Step 5: Summary
    console.log('\n' + '='.repeat(70));
    console.log('📈 Search Quality Analysis\n');

    const successRate = Math.round((foundCount / queries.length) * 100);
    const avgScore = results
        .filter(r => r.found && r.score)
        .reduce((sum, r) => sum + (r.score || 0), 0) / (foundCount || 1);

    console.log(`Test Results:`);
    console.log(`  - Queries tested: ${queries.length}`);
    console.log(`  - Found video: ${foundCount}/${queries.length} (${successRate}%)`);
    console.log(`  - Average score: ${avgScore.toFixed(3)}`);

    console.log(`\nDetailed Results:`);
    results.forEach(r => {
        if (r.found) {
            console.log(`  ✅ "${r.query}": Rank #${r.rank}, Score ${r.score?.toFixed(3)}`);
        } else {
            console.log(`  ❌ "${r.query}": Not found`);
        }
    });

    console.log('\n' + '='.repeat(70));

    if (successRate >= 70) {
        console.log('✅ PASS: Search quality is EXCELLENT (≥70%)');
        console.log('💡 Description embedding is working! Safe to run full backfill.');
    } else if (successRate >= 50) {
        console.log('⚠️  MARGINAL: Search quality is OK (50-70%)');
        console.log('💡 Consider testing with more videos before full backfill.');
    } else {
        console.log('❌ FAIL: Search quality is poor (<50%)');
        console.log('💡 May need to investigate further.');
    }

    console.log('='.repeat(70));
}

testAmbientMusicSearch().catch(console.error);
