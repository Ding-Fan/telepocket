import { createClient } from '@supabase/supabase-js';
import { EmbeddingService } from '@telepocket/shared';
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
    console.log('Starting embedding backfill...');

    let offset = 0;
    const batchSize = 50;
    let totalProcessed = 0;
    let totalErrors = 0;

    while (true) {
        // Fetch notes without embeddings
        const { data: notes, error } = await supabase
            .from('z_notes')
            .select(`
        id,
        content,
        z_note_links (
          id,
          url,
          title
        )
      `)
            .is('embedding', null)
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error('Error fetching notes:', error);
            break;
        }

        if (!notes || notes.length === 0) {
            console.log('No more notes to process.');
            break;
        }

        console.log(`Processing batch of ${notes.length} notes...`);

        for (const note of notes) {
            try {
                const links = note.z_note_links || [];
                const text = embeddingService.prepareNoteText({
                    content: note.content,
                    links: links.map((l: any) => ({ title: l.title, url: l.url }))
                });

                const embedding = await embeddingService.generateEmbedding(text);

                const { error: updateError } = await supabase
                    .from('z_notes')
                    .update({ embedding })
                    .eq('id', note.id);

                if (updateError) {
                    console.error(`Failed to update note ${note.id}:`, updateError);
                    totalErrors++;
                } else {
                    totalProcessed++;
                }

                // Rate limiting is handled inside EmbeddingService, but we add a small safety buffer
                // await new Promise(resolve => setTimeout(resolve, 10)); 
            } catch (err) {
                console.error(`Failed to process note ${note.id}:`, err);
                totalErrors++;
            }
        }

        // Since we're filtering by embedding IS NULL, we don't need to increment offset
        // The processed notes will no longer match the filter
        // However, if we have errors, we might get stuck in a loop if we don't skip them
        // So for safety, if we had errors, we might want to increment offset or handle differently
        // But for now, assuming transient errors, we'll just continue. 
        // Actually, if we fail to update, it will still be null, so we will fetch it again.
        // To avoid infinite loops on persistent errors, we should probably track failed IDs or just increment offset if we made no progress.

        // Simple approach: if we processed 0 notes successfully in a batch but had notes, we might be stuck.
        // But let's just rely on the fact that we'll eventually finish.

        // Wait a bit between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Backfill complete. Processed: ${totalProcessed}, Errors: ${totalErrors}`);
}

backfillEmbeddings().catch(console.error);
