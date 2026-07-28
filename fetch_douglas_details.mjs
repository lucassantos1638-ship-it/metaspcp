import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://ucsfqmrfakhopaqxbudh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc2ZxbXJmYWtob3BhcXhidWRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU5OTE4MCwiZXhwIjoyMDg0MTc1MTgwfQ.GPjivqFvJoaOGxqaDvwPjdKd4FzNl8XYB8MzCGzxCX0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: lote } = await supabase
    .from('lotes')
    .select('id')
    .eq('numero_lote', '2820')
    .single();

  const { data: producoes } = await supabase
    .from('producoes_com_tempo')
    .select(`
      *,
      etapa:etapas(nome),
      subetapa:subetapas(nome)
    `)
    .eq('lote_id', lote.id)
    .ilike('colaborador_nome', '%douglas%');

  fs.writeFileSync('douglas_output_details.json', JSON.stringify(producoes, null, 2));
}

run();
