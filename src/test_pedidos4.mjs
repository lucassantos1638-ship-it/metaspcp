import 'dotenv/config.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("Checking producoes...");
    const { data: prodData, error: prodErr } = await supabase
        .from('producoes')
        .select('pedido_id')
        .not('pedido_id', 'is', null);

    if (prodErr) {
        console.error('Error producoes:', prodErr);
        return;
    }
    console.log(`Producoes com pedido:`, prodData ? prodData.length : 0);
    if (!prodData || prodData.length === 0) return;

    const uniquePedidoIds = Array.from(new Set(prodData.map(p => p.pedido_id).filter(Boolean)));
    console.log("Unique Pedido IDs:", uniquePedidoIds);

    const { data, error } = await supabase
        .from('pedidos')
        .select('id, numero, entidade(nome)')
        .in('id', uniquePedidoIds);

    if (error) {
        console.error('Error pedidos:', error);
    } else {
        console.log("Pedidos fetched:", data ? data.length : 0);
        console.log("Data:", data);
    }
}

run();
