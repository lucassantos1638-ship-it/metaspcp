const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].replace(/\"/g, '').trim();
const key = env.split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY')).split('=')[1].replace(/\"/g, '').trim();

async function run() {
  const res1 = await fetch(url + "/rest/v1/lotes?numero_lote=eq.2821", { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const lotes = await res1.json();
  const loteId = lotes[0].id;
  
  const res2 = await fetch(url + "/rest/v1/producoes_com_tempo?select=*,subetapa:subetapas(nome),etapa:etapas(nome)&lote_id=eq." + loteId, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } });
  const prods = await res2.json();
  
  const embalagem = prods.filter(p => p.subetapa && p.subetapa.nome && p.subetapa.nome.toLowerCase().includes('embalagem'));
  console.log("Embalagem prods for 2821:", embalagem.length);
  embalagem.forEach(p => {
    console.log(`Qtd: ${p.quantidade_produzida}, Sub_id: ${p.subetapa_id}, Etapa: ${p.etapa.nome}, Sub: ${p.subetapa.nome}`);
  });
}
run().catch(console.error);
