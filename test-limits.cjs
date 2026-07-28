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

  let allProds = [];
  const chunkSize = 50;
  for (let i = 0; i < loteIds.length; i += chunkSize) {
    const chunk = loteIds.slice(i, i + chunkSize);
    const data = await fetchSupabase(`/rest/v1/producoes_com_tempo?select=lote_id&lote_id=in.(${chunk.join(',')})`);
    console.log(`Chunk ${i/chunkSize} returned ${data.length} rows`);
    allProds.push(...data);
  }
}
run().catch(console.error);
