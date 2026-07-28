const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].replace(/\"/g, '').trim();
const key = env.split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY')).split('=')[1].replace(/\"/g, '').trim();

async function run() {
  const empresaId = '3c0cc958-b4e2-4d8c-973f-4e9a36e1c66b';
  const dataInicio = '2026-03-01';
  const dataFim = '2026-03-31';

  const fetchSupabase = async (path) => {
    const res = await fetch(url + path, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const etapaAcabamento = (await fetchSupabase(`/rest/v1/etapas?empresa_id=eq.${empresaId}&nome=ilike.*acabamento*&limit=1`))[0];
  const subEmbalagem = (await fetchSupabase(`/rest/v1/subetapas?empresa_id=eq.${empresaId}&nome=ilike.*embalagem*&etapa_id=eq.${etapaAcabamento.id}&limit=1`))[0];
  const embalagemId = subEmbalagem.id;

  const prodsEmbalagem = await fetchSupabase(`/rest/v1/producoes_com_tempo?select=lote_id,quantidade_produzida,data_fim&subetapa_id=eq.${embalagemId}&data_fim=gte.${dataInicio}&data_fim=lte.${dataFim}`);
  const loteIds = [...new Set(prodsEmbalagem.map(p => p.lote_id).filter(Boolean))];

  const lotes = await fetchSupabase(`/rest/v1/lotes?select=id,numero_lote,quantidade_total,produto_id,produto:produtos(nome)&id=in.(${loteIds.join(',')})&empresa_id=eq.${empresaId}`);
  
  let allProds = [];
  const chunkSize = 50;
  for (let i = 0; i < loteIds.length; i += chunkSize) {
    const chunk = loteIds.slice(i, i + chunkSize);
    const data = await fetchSupabase(`/rest/v1/producoes_com_tempo?select=*,etapa:etapas(nome,ordem),subetapa:subetapas(nome)&lote_id=in.(${chunk.join(',')})`);
    allProds.push(...data);
  }

  const agrupamento = {};

  lotes.forEach(lote => {
     const prodId = lote.produto_id;
     if (!prodId) return;

     const prodsDoLoteNoPeriodo = prodsEmbalagem.filter(p => p.lote_id === lote.id);
     if (prodsDoLoteNoPeriodo.length === 0) return;

     const producoesDoLote = allProds.filter(p => p.lote_id === lote.id);

     const todasEmbalagemDoLote = producoesDoLote.filter(p => p.subetapa_id === embalagemId);
     const qtdFabricada = todasEmbalagemDoLote.reduce((s, p) => s + (Number(p.quantidade_produzida) || 0), 0);
     
     if (qtdFabricada === 0) return;
     
     if (lote.numero_lote === '2821') {
         console.log("2821 reached here! qtdFabricada =", qtdFabricada);
     }
     
     if (!agrupamento[prodId]) {
       agrupamento[prodId] = {
         produto: lote.produto,
         lotes: [],
       };
     }
     agrupamento[prodId].lotes.push({
       numeroLote: lote.numero_lote,
       fabricado: qtdFabricada
     });
  });

  const final = Object.values(agrupamento).map(item => item);
  console.log("2821 in final output:", final.some(g => g.lotes.some(l => l.numeroLote === '2821')));
}
run().catch(console.error);
