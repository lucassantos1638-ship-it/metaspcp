import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function test() {
  const { data: e } = await supabase.from('etapas').select('*').limit(2);
  const { data: s } = await supabase.from('subetapas').select('*').limit(2);
  console.log('Etapas:', e);
  console.log('Subetapas:', s);
}
test();
