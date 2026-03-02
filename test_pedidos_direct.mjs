import fs from 'fs';

let envFile = '';
try {
    envFile = fs.readFileSync('.env.local', 'utf8');
} catch (e) {
    envFile = fs.readFileSync('.env', 'utf8');
}

const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

async function test() {
    console.log("Fetching url:", `${url}/rest/v1/pedidos?select=id,numero,entidade(nome)&limit=10`);
    try {
        const res = await fetch(`${url}/rest/v1/pedidos?select=id,numero,entidade(nome)&limit=10`, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

test();
