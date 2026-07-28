import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ucsfqmrfakhopaqxbudh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc2ZxbXJmYWtob3BhcXhidWRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU5OTE4MCwiZXhwIjoyMDg0MTc1MTgwfQ.GPjivqFvJoaOGxqaDvwPjdKd4FzNl8XYB8MzCGzxCX0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: lote, error: loteError } = await supabase
    .from('lotes')
    .select('id')
    .eq('numero_lote', '2820')
    .single();

  if (loteError) {
    console.error("Erro fetching lote:", loteError);
    return;
  }

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
