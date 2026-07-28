import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function debug() {
  const dataInicio = '2026-03-01'; // Example dates
  const dataFim = '2026-04-22';
  
  const { data: prodsRange, error: err1 } = await supabase
    .from("producoes_com_tempo")
    .select("lote_id, data_fim, etapa_id, subetapa_id")
    .gte("data_fim", dataInicio)
    .lte("data_fim", dataFim);
    
  console.log("Prods no periodo:", prodsRange?.length);
  if (!prodsRange || prodsRange.length === 0) return;

  const activeLoteIds = [...new Set(prodsRange.map(p => p.lote_id))];
  console.log("Lotes ativos:", activeLoteIds.length);

  const { data: lotes } = await supabase
    .from("lotes")
    .select(`id, numero_lote, produto_id`)
    .in("id", activeLoteIds);

  console.log("Lotes validos:", lotes?.length);
  
  const validLoteIds = lotes?.map(l => l.id) || [];
  const produtoIds = [...new Set(lotes?.map(l => l.produto_id).filter(Boolean))];
  
  const { data: rotas } = await supabase
    .from("produto_etapas")
    .select("produto_id, etapa_id, subetapa_id, ordem")
    .in("produto_id", produtoIds);
    
  console.log("Rotas (produto_etapas):", rotas?.length);
  
  const lastSteps: Record<string, any> = {};
  produtoIds.forEach(pid => {
     const rotasProd = rotas?.filter(e => e.produto_id === pid) || [];
     if (rotasProd.length > 0) {
        rotasProd.sort((a, b) => b.ordem - a.ordem);
        lastSteps[pid] = { etapa_id: rotasProd[0].etapa_id, subetapa_id: rotasProd[0].subetapa_id };
     }
  });
  
  console.log("Last steps:", lastSteps);

  // let's check one lot
  if (lotes && lotes.length > 0) {
      const l = lotes[0];
      const p = prodsRange.filter(pr => pr.lote_id === l.id);
      const last = lastSteps[l.produto_id];
      console.log(`Lote ${l.numero_lote} tem ${p.length} producoes. Last step:`, last);
      const ls = p.filter(pr => pr.etapa_id === last?.etapa_id && (pr.subetapa_id || null) === (last?.subetapa_id || null));
      console.log(`Producoes do last step no periodo:`, ls.length);
  }
}
debug();
