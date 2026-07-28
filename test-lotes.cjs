const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].replace(/\"/g, '').trim();
const key = env.split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY')).split('=')[1].replace(/\"/g, '').trim();

async function run() {
  const res1 = await fetch(url + "/rest/v1/lotes?numero_lote=in.(2858,2821)", { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const lotes = await res1.json();
  lotes.forEach(l => console.log(`Lote ${l.numero_lote}: produto_id = ${l.produto_id}`));
}
run().catch(console.error);
