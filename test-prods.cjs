const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].replace(/\"/g, '').trim();
const key = env.split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY')).split('=')[1].replace(/\"/g, '').trim();

async function run() {
  const embalagemId = '0e829255-2a5d-4de8-9e0c-0b3ed92a8915';
  const dataInicio = '2026-03-01';
  const dataFim = '2026-03-31T23:59:59.999Z';
  
  const res = await fetch(`${url}/rest/v1/producoes_com_tempo?subetapa_id=eq.${embalagemId}&data_fim=gte.${dataInicio}&data_fim=lte.${dataFim}&select=lote_id,quantidade_produzida`, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const prods = await res.json();
  
  const lotes2821 = prods.filter(p => p.lote_id === 'bba3a68d-8bb0-47b2-850c-e274c43ba780'); // Assuming this is 2821 id
  // Let's just find lot 2821 id first
  const res1 = await fetch(url + "/rest/v1/lotes?numero_lote=eq.2821", { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const lotes = await res1.json();
  const loteId = lotes[0].id;
  
  const lotesFound = prods.filter(p => p.lote_id === loteId);
  console.log("Prods for 2821 in period:", lotesFound.length);
}
run().catch(console.error);
