const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].replace(/\"/g, '').trim();
const key = env.split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY')).split('=')[1].replace(/\"/g, '').trim();

async function run() {
  const res0 = await fetch(url + "/rest/v1/etapas?nome=ilike.*acabamento*", { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const etapas = await res0.json();
  console.log("Acabamento etapas:", etapas.length);
  etapas.forEach(e => console.log(e.id, e.nome, e.empresa_id));
  
  const res1 = await fetch(url + "/rest/v1/subetapas?nome=ilike.*embalagem*", { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const subetapas = await res1.json();
  console.log("\nEmbalagem subetapas:", subetapas.length);
  subetapas.forEach(s => console.log(s.id, s.nome, s.etapa_id, s.empresa_id));
}
run().catch(console.error);
