import { createClient } from '@supabase/supabase-js';
import { metadataFetcher } from '@telepocket/shared/dist/metadataFetcher';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from apps/bot/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing required environment variables:');
    if (!SUPABASE_URL) console.error('- SUPABASE_URL');
    if (!SUPABASE_ANON_KEY) console.error('- SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function backfillYouTubeMetadata() {
    console.log('Starting YouTube metadata backfill...\n');

    // First, get total count of YouTube links
    const { count: totalCount, error: countError } = await supabase
        .from('z_note_links')
        .select('id', { count: 'exact', head: true })
        .or('url.ilike.%youtube.com%,url.ilike.%youtu.be%');

    if (countError) {
        console.error('Error counting YouTube links:', countError);
        process.exit(1);
    }

    console.log(`Found ${totalCount} YouTube links to process\n`);

    let offset = 0;
    const batchSize = 20;
    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalErrors = 0;

    while (offset < (totalCount || 0)) {
        // Fetch batch of YouTube links
        const { data: links, error } = await supabase
            .from('z_note_links')
            .select('id, url, title, description, og_image')
            .or('url.ilike.%youtube.com%,url.ilike.%youtu.be%')
            .range(offset, offset + batchSize - 1)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching links:', error);
            break;
        }

        if (!links || links.length === 0) {
            console.log('No more links to process.');
            break;
        }

        console.log(`\n📦 Processing batch ${Math.floor(offset / batchSize) + 1} (${links.length} links)...`);

        for (const link of links) {
            try {
                console.log(`  Fetching metadata for: ${link.url}`);

                const metadata = await metadataFetcher.fetchMetadata(link.url);

                // Update the link with new metadata
                const { error: updateError } = await supabase
                    .from('z_note_links')
                    .update({
                        title: metadata.title || null,
                        description: metadata.description || null,
                        og_image: metadata.og_image || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', link.id);

                if (updateError) {
                    console.error(`  ❌ Failed to update link ${link.id}:`, updateError.message);
                    totalErrors++;
                } else {
                    const hasMetadata = metadata.title || metadata.description || metadata.og_image;
                    if (hasMetadata) {
                        console.log(`  ✅ Updated successfully`);
                        if (metadata.title) console.log(`     Title: ${metadata.title.substring(0, 60)}${metadata.title.length > 60 ? '...' : ''}`);
                    } else {
                        console.log(`  ⚠️  No metadata found (updated with nulls)`);
                    }
                    totalSuccessful++;
                }

                totalProcessed++;
            } catch (err) {
                console.error(`  ❌ Failed to process link ${link.id}:`, err instanceof Error ? err.message : 'Unknown error');
                totalErrors++;
                totalProcessed++;
            }
        }

        offset += batchSize;

        // Progress summary after each batch
        console.log(`\n📊 Progress: ${totalProcessed}/${totalCount} | ✅ ${totalSuccessful} successful | ❌ ${totalErrors} errors`);

        // Wait 2 seconds between batches to avoid rate limiting
        if (offset < (totalCount || 0)) {
            console.log('⏳ Waiting 2 seconds before next batch...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✨ Backfill complete!');
    console.log('='.repeat(80));
    console.log(`Total processed: ${totalProcessed}`);
    console.log(`Successful updates: ${totalSuccessful}`);
    console.log(`Errors: ${totalErrors}`);
    console.log(`Success rate: ${totalProcessed > 0 ? ((totalSuccessful / totalProcessed) * 100).toFixed(1) : 0}%`);
    console.log('='.repeat(80));
}

backfillYouTubeMetadata().catch(console.error);
