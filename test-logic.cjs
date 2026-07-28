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

  console.log("Lote IDs fetched:", loteIds.length);
  const lotes = await fetchSupabase(`/rest/v1/lotes?select=id,numero_lote,quantidade_total,produto_id,produto:produtos(nome)&id=in.(${loteIds.join(',')})&empresa_id=eq.${empresaId}`);
  
  const lote2821 = lotes.find(l => l.numero_lote === '2821');
  if (!lote2821) {
      console.log("Lote 2821 is NOT in validLotes!");
      console.log("Lote 2821 ID was in loteIds?", loteIds.includes('bba3a68d-8bb0-47b2-850c-e274c43ba780'));
  } else {
      console.log("Lote 2821 IS in validLotes");
      const prodsDoLoteNoPeriodo = prodsEmbalagem.filter(p => p.lote_id === lote2821.id);
      console.log("prodsDoLoteNoPeriodo:", prodsDoLoteNoPeriodo.length);
  }
}
run().catch(console.error);
