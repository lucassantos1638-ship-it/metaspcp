const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].replace(/\"/g, '').trim();
const key = env.split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY')).split('=')[1].replace(/\"/g, '').trim();

async function run() {
  const res0 = await fetch(url + "/rest/v1/etapas?nome=ilike.*acabamento*", { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const etapas = await res0.json();
  const etapaAcabamentoId = etapas[0].id;
  console.log("Acabamento id:", etapaAcabamentoId);
  
  const res1 = await fetch(url + "/rest/v1/subetapas?nome=ilike.*embalagem*&etapa_id=eq." + etapaAcabamentoId, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const subetapas = await res1.json();
  console.log("Embalagens in acabamento:", subetapas);
}
run().catch(console.error);
