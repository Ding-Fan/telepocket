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
    console.log('🎵 Testing Music Video Search Quality (Simple Version)\n');
    console.log('='.repeat(70));

    // Step 1: Find NightmareOwlMusic links directly
    console.log('\n📺 Step 1: Finding NightmareOwlMusic links...\n');

    const { data: links, error: linksError } = await supabase
        .from('z_note_links')
        .select('id, note_id, url, title, description')
        .ilike('url', '%NightmareOwlMusic%')
        .not('description', 'is', null)
        .limit(5);

    if (linksError || !links || links.length === 0) {
        console.error('❌ Could not find NightmareOwlMusic links:', linksError);
        process.exit(1);
    }

    console.log(`Found ${links.length} NightmareOwlMusic links with descriptions\n`);

    // Pick first link
    const testLink = links[0];
    console.log('Selected test link:');
    console.log(`  Title: ${testLink.title}`);
    console.log(`  Description: ${testLink.description?.substring(0, 100)}...`);
    console.log(`  URL: ${testLink.url}`);
    console.log(`  Note ID: ${testLink.note_id}`);

    // Get the full note
    const { data: note, error: noteError } = await supabase
        .from('z_notes')
        .select('id, content, telegram_user_id')
        .eq('id', testLink.note_id)
        .single();

    if (noteError || !note) {
        console.error('❌ Could not find note:', noteError);
        process.exit(1);
    }

    console.log(`  Note content: "${note.content.substring(0, 80)}..."`);

    // Step 2: Compare OLD vs NEW embedding
    console.log('\n' + '='.repeat(70));
    console.log('📊 Step 2: Comparing OLD vs NEW embedding preparation\n');

    const oldText = `${note.content}\nLinks: ${testLink.title} (${testLink.url})`;
    console.log('OLD (without description):');
    console.log('-'.repeat(70));
    console.log(oldText.substring(0, 200) + '...');
    console.log('-'.repeat(70));

    const newText = embeddingService.prepareNoteText({
        content: note.content,
        links: [{
            title: testLink.title,
            description: testLink.description,
            url: testLink.url
        }]
    });

    console.log('\nNEW (with description):');
    console.log('-'.repeat(70));
    console.log(newText.substring(0, 400) + '...');
    console.log('-'.repeat(70));

    console.log(`\n✅ Added ${newText.length - oldText.length} characters from description`);

    // Step 3: Generate and save NEW embedding
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

    const queries = ['music', 'bgm', 'background music', 'work music', 'study music'];
    let foundCount = 0;

    for (const query of queries) {
        const qEmbed = await embeddingService.generateEmbedding(query);

        const { data: results, error: searchError } = await supabase
            .rpc('search_notes_hybrid', {
                query_text: query,
                query_embedding: qEmbed,
                match_threshold: 0.3,
                page_size: 10,
                category_filter: null,
                user_id: note.telegram_user_id
            });

        if (searchError) {
            console.log(`  ❌ "${query}": Search error - ${searchError.message}`);
            continue;
        }

        const found = results?.find((r: any) => r.id === note.id);
        if (found) {
            const score = found.semantic_score || found.relevance_score || 0;
            console.log(`  ✅ "${query}": Found at rank #${results.indexOf(found) + 1} (score: ${score.toFixed(3)})`);
            foundCount++;
        } else {
            console.log(`  ❌ "${query}": Not in top 10`);
        }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📈 Results Summary\n');
    console.log(`  Queries tested: ${queries.length}`);
    console.log(`  Found video: ${foundCount}/${queries.length} (${Math.round(foundCount / queries.length * 100)}%)`);

    if (foundCount >= queries.length * 0.7) {
        console.log('\n✅ PASS: Search quality is GOOD (≥70%)');
        console.log('💡 Safe to run full backfill');
    } else {
        console.log(`\n⚠️  MARGINAL: Only ${Math.round(foundCount / queries.length * 100)}% success rate`);
    }

    console.log('='.repeat(70));
}

testMusicSearch().catch(console.error);
