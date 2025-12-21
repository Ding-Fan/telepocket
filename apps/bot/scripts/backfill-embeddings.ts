import { createClient } from '@supabase/supabase-js';
import { EmbeddingService, NoteWithId } from '@telepocket/shared';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from apps/web/.env.local
dotenv.config({ path: path.resolve(__dirname, '../../web/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !GOOGLE_AI_API_KEY) {
    console.error('Missing required environment variables:');
    if (!SUPABASE_URL) console.error('- NEXT_PUBLIC_SUPABASE_URL');
    if (!SUPABASE_SECRET_KEY) console.error('- SUPABASE_SECRET_KEY');
    if (!GOOGLE_AI_API_KEY) console.error('- GOOGLE_AI_API_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddingService = new EmbeddingService(GOOGLE_AI_API_KEY);

async function backfillEmbeddings() {
    console.log('Starting embedding backfill...\n');

    // First, get total count of notes without embeddings
    const { count: totalCount, error: countError } = await supabase
        .from('z_notes')
        .select('id', { count: 'exact', head: true })
        .is('embedding', null);

    if (countError) {
        console.error('Error counting notes:', countError);
        process.exit(1);
    }

    console.log(`Found ${totalCount} notes to process\n`);

    let offset = 0;
    const batchSize = 20;
    let totalSuccessful = 0;
    let totalFailed = 0;

    while (offset < (totalCount || 0)) {
        // Fetch batch of notes without embeddings
        const { data: notes, error } = await supabase
            .from('z_notes')
            .select(`
                id,
                content,
                z_note_links (
                    id,
                    url,
                    title,
                    description
                )
            `)
            .is('embedding', null)
            .range(offset, offset + batchSize - 1)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching notes:', error);
            break;
        }

        if (!notes || notes.length === 0) {
            console.log('No more notes to process.');
            break;
        }

        console.log(`\n📦 Processing batch ${Math.floor(offset / batchSize) + 1} (${notes.length} notes)...`);

        // Transform to NoteWithId format
        const notesWithLinks: NoteWithId[] = notes.map((note: any) => ({
            id: note.id,
            content: note.content,
            links: (note.z_note_links || []).map((l: any) => ({
                url: l.url,
                title: l.title,
                description: l.description
            }))
        }));

        // Use batch update method
        const { successful, failed, results } = await embeddingService.batchUpdateNoteEmbeddings(
            supabase,
            notesWithLinks
        );

        totalSuccessful += successful;
        totalFailed += failed;

        // Log individual results
        for (const result of results) {
            if (result.error) {
                console.log(`  ❌ Note ${result.id}: ${result.error}`);
            } else {
                console.log(`  ✅ Note ${result.id}: Embedded successfully`);
            }
        }

        offset += batchSize;

        // Progress summary after each batch
        const totalProcessed = totalSuccessful + totalFailed;
        console.log(`\n📊 Progress: ${totalProcessed}/${totalCount} | ✅ ${totalSuccessful} successful | ❌ ${totalFailed} errors`);

        // Wait 1 second between batches
        if (offset < (totalCount || 0)) {
            console.log('⏳ Waiting 1 second before next batch...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✨ Backfill complete!');
    console.log('='.repeat(80));
    console.log(`Total processed: ${totalSuccessful + totalFailed}`);
    console.log(`Successful updates: ${totalSuccessful}`);
    console.log(`Errors: ${totalFailed}`);
    console.log(`Success rate: ${(totalSuccessful + totalFailed) > 0 ? ((totalSuccessful / (totalSuccessful + totalFailed)) * 100).toFixed(1) : 0}%`);
    console.log('='.repeat(80));
}

backfillEmbeddings().catch(console.error);
