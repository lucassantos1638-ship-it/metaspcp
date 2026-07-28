import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/etapas?select=id,nome,ordem&order=ordem.asc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const data = await res.json();
  console.log("ETAPAS:", data);
}
run();
