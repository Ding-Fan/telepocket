import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../web/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

(async () => {
  const { count: withEmbedding } = await supabase
    .from('z_notes')
    .select('id', { count: 'exact', head: true })
    .not('embedding', 'is', null);

  const { count: withoutEmbedding } = await supabase
    .from('z_notes')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null);

  const { count: total } = await supabase
    .from('z_notes')
    .select('id', { count: 'exact', head: true });

  console.log('📊 Embedding Status:');
  console.log(`   ✅ Notes WITH embeddings: ${withEmbedding}`);
  console.log(`   ⏳ Notes WITHOUT embeddings: ${withoutEmbedding}`);
  console.log(`   📝 Total notes: ${total}`);
  console.log('');
  console.log(`Backfill will process ${withoutEmbedding} note(s)`);
})();
