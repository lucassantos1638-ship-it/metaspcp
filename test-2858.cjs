const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].replace(/\"/g, '').trim();
const key = env.split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY')).split('=')[1].replace(/\"/g, '').trim();

async function run() {
  // Find lot 2858
  const res1 = await fetch(url + "/rest/v1/lotes?numero_lote=eq.2858", { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const lotes = await res1.json();
  const loteId = lotes[0].id;
  
  const res2 = await fetch(url + "/rest/v1/producoes_com_tempo?lote_id=eq." + loteId, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const prods = await res2.json();
  
  console.log("Total prods:", prods.length);
  prods.forEach(p => {
    console.log(`Qtd: ${p.quantidade_produzida}, Data Fim: ${p.data_fim}, Etapa: ${p.etapa_id}, Sub: ${p.subetapa_id}, Status: ${p.status}`);
  });
}
run().catch(console.error);
