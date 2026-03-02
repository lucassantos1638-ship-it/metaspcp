import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/pedidos?select=id,numero,entidade:entidades(nome)&limit=2`;
const url2 = `${process.env.VITE_SUPABASE_URL}/rest/v1/pedidos?select=id,numero,entidade(nome)&limit=2`;

async function test(queryUrl) {
    console.log(`Testing URL: ${queryUrl.substring(0, 80)}...`);
    const res = await fetch(queryUrl, {
        headers: {
            'apikey': process.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
        }
    });
    if (!res.ok) {
        console.error(`Error ${res.status}:`, await res.text());
    } else {
        const data = await res.json();
        console.log(`Success! Got ${data.length} items`);
    }
}

async function run() {
    await test(url);
    await test(url2);
}
run();
