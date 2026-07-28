
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMPRESA_ID = '3c0cc958-b4e2-4d8c-973f-4e9a36e1c66b';
const DATA_INICIO = '2026-03-01';
const DATA_FIM = '2026-04-22';

async function query(table, select = '*', extra = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}&${extra}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  return res.json();
}

async function run() {
  const prodsRange = await query('producoes_com_tempo', 'lote_id,etapa_id,subetapa_id,data_fim', `empresa_id=eq.${EMPRESA_ID}&data_fim=gte.${DATA_INICIO}&data_fim=lte.${DATA_FIM}`);
  console.log("Prods range:", prodsRange.length);

  const activeLoteIds = [...new Set(prodsRange.map(p => p.lote_id).filter(Boolean))].slice(0, 5);
  console.log("Active Lote Ids:", activeLoteIds.length);

  const lotes = await query('lotes', 'id,numero_lote,produto_id', `id=in.(${activeLoteIds.join(',')})`);
  console.log("Lotes returned:", lotes.length || lotes);

  const validLotes = lotes;
  console.log("Valid lotes:", validLotes.length);

  const allProds = await query('producoes_com_tempo', 'lote_id,etapa_id,subetapa_id,quantidade_produzida,tempo_produtivo_minutos,data_fim', `lote_id=in.(${validLotes.map(l=>l.id).join(',')})`);
  console.log("All prods length:", allProds.length);

  const produtoIds = [...new Set(validLotes.map(l => l.produto_id).filter(Boolean))];
  const rotas = await query('produto_etapas', 'produto_id,etapa_id,subetapa_id,ordem', `produto_id=in.(${produtoIds.join(',')})`);
  
  const lastSteps = {};
  produtoIds.forEach(pid => {
    const rotasProd = rotas.filter(e => e.produto_id === pid) || [];
    if (rotasProd.length > 0) {
      rotasProd.sort((a, b) => b.ordem - a.ordem);
      lastSteps[pid] = { etapa_id: rotasProd[0].etapa_id, subetapa_id: rotasProd[0].subetapa_id };
    }
  });

  console.log("LastSteps:", lastSteps);

  const agrupamento = {};

  validLotes.forEach(lote => {
    const prodId = lote.produto_id;
    if (!prodId) return;

    const lastStep = lastSteps[prodId];
    if (!lastStep) {
      console.log(`Lote ${lote.numero_lote}: sem lastStep`);
      return;
    }

    const prodDoLote = allProds.filter(p => p.lote_id === lote.id);
    const lastStepProds = prodDoLote.filter(p => p.etapa_id === lastStep.etapa_id && (p.subetapa_id || null) === (lastStep.subetapa_id || null));
    
    const lastStepProdsInRange = lastStepProds.filter(p => {
      if (!p.data_fim) return false;
      const dataFimProd = p.data_fim.split('T')[0];
      return dataFimProd >= DATA_INICIO && dataFimProd <= DATA_FIM;
    });

    console.log(`Lote ${lote.numero_lote}: total prods=${prodDoLote.length}, lastStepProds=${lastStepProds.length}, inRange=${lastStepProdsInRange.length}`);

    if (lastStepProdsInRange.length === 0) return;

    if (!agrupamento[prodId]) agrupamento[prodId] = { lotes: [] };
    agrupamento[prodId].lotes.push(lote);
  });

  console.log("Agrupamento keys:", Object.keys(agrupamento));
}
run();
