import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Or service role if needed

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data, error } = await supabase.from('produto_cores').select('*').limit(1);
  console.log("produto_cores:", { data, error });
  
  const { data: d2, error: e2 } = await supabase.from('produtos').select('*').limit(1);
  if (d2 && d2.length > 0) {
    console.log("produtos columns:", Object.keys(d2[0]));
  }
}

check();
