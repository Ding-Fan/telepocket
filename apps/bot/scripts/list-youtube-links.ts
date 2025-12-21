import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../web/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function listYouTubeLinks() {
  console.log('📺 YouTube links with descriptions:\n');

  const { data, error } = await supabase
    .from('z_note_links')
    .select('id, url, title, description')
    .not('description', 'is', null)
    .ilike('url', '%youtube%')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ No YouTube links with descriptions found');
    return;
  }

  data.forEach((link, i) => {
    console.log(`${i+1}. ${link.title}`);
    console.log(`   URL: ${link.url}`);
    console.log(`   Desc: ${link.description?.substring(0, 80)}...`);
    console.log(`   ID: ${link.id}\n`);
  });

  console.log(`\nTotal: ${data.length} YouTube links with descriptions`);
}

listYouTubeLinks();
