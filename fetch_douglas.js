const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Find lote 2820
  const { data: lote, error: loteError } = await supabase
    .from('lotes')
    .select('id')
    .eq('numero_lote', '2820')
    .single();

  if (loteError) {
    console.error("Erro fetching lote:", loteError);
    return;
  }

  // Fetch producoes_com_tempo for this lote and Douglas
  const { data: producoes, error: prodError } = await supabase
    .from('producoes_com_tempo')
    .select('*')
    .eq('lote_id', lote.id)
    .ilike('colaborador_nome', '%douglas%');

  if (prodError) {
    console.error("Erro fetching producoes:", prodError);
    return;
  }

  console.log(JSON.stringify(producoes, null, 2));
}

run();
