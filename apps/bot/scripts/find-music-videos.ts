import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../web/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error('Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function findMusicVideos() {
    console.log('🔍 Searching for NightmareOwlMusic videos...\n');

    const { data: notes, error } = await supabase
        .from('z_notes')
        .select(`
            id,
            content,
            telegram_user_id,
            z_note_links (
                id,
                url,
                title,
                description
            )
        `)
        .ilike('z_note_links.url', '%youtube.com/@NightmareOwlMusic%')
        .limit(10);

    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    if (!notes || notes.length === 0) {
        console.log('❌ No notes found with NightmareOwlMusic');
        console.log('\nTrying broader YouTube search...\n');

        const { data: ytNotes, error: ytError } = await supabase
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
            .ilike('z_note_links.url', '%youtube.com%')
            .not('z_note_links.description', 'is', null)
            .limit(20);

        if (ytError || !ytNotes || ytNotes.length === 0) {
            console.log('❌ No YouTube videos with descriptions found');
            process.exit(1);
        }

        console.log(`Found ${ytNotes.length} YouTube videos:\n`);

        ytNotes.forEach((note: any, index: number) => {
            const links = note.z_note_links || [];
            if (links.length > 0) {
                const link = links[0];
                console.log(`${index + 1}. ${link.title}`);
                console.log(`   URL: ${link.url}`);
                console.log(`   Description: ${link.description?.substring(0, 80)}...`);
                console.log(`   Note ID: ${note.id}\n`);
            }
        });

        process.exit(0);
    }

    console.log(`✅ Found ${notes.length} NightmareOwlMusic videos:\n`);

    notes.forEach((note: any, index: number) => {
        const links = note.z_note_links || [];
        if (links.length > 0) {
            const link = links[0];
            console.log(`${index + 1}. ${link.title}`);
            console.log(`   URL: ${link.url}`);
            console.log(`   Description: ${link.description?.substring(0, 100)}...`);
            console.log(`   Note ID: ${note.id}\n`);
        }
    });
}

findMusicVideos().catch(console.error);
