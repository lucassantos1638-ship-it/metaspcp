import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function debug() {
  const { data: etapas } = await supabase
    .from("etapas")
    .select("id, ordem, nome")
    .order("ordem", { ascending: false })
    .limit(1);

  if (!etapas || etapas.length === 0) {
      console.log("No etapas!");
      return;
  }
  const ultimaEtapa = etapas[0];
  console.log("Ultima etapa:", ultimaEtapa);

  const { data: subetapas } = await supabase
    .from("subetapas")
    .select("id, created_at, nome")
    .eq("etapa_id", ultimaEtapa.id)
    .order("created_at", { ascending: false })
    .limit(1);

  console.log("Ultima subetapa:", subetapas);

  const lastStep = {
     etapa_id: ultimaEtapa.id,
     subetapa_id: subetapas && subetapas.length > 0 ? subetapas[0].id : null
  };
  console.log("LastStep resolved:", lastStep);

  // find any productions for this step
  const { data: p } = await supabase.from('producoes').select('id, quantidade_produzida, lote_id').eq('etapa_id', lastStep.etapa_id).limit(10);
  console.log("Producoes last etapa:", p?.length);
  
  if (lastStep.subetapa_id) {
    const { data: psub } = await supabase.from('producoes').select('id, quantidade_produzida, lote_id').eq('subetapa_id', lastStep.subetapa_id).limit(10);
    console.log("Producoes last subetapa:", psub?.length);
  }
}
debug();
