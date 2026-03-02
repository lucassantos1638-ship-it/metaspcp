import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.VITE_SUPABASE_ANON_KEY as string
);

async function test() {
    console.log("Buscando producoes com pedido_id...");
    const { data: prodData, error: prodErr } = await supabase
        .from('producoes')
        .select('pedido_id')
        .not('pedido_id', 'is', null);

    if (prodErr) {
        console.error('Erro Producoes:', prodErr);
        return;
    }

    console.log(`Encontradas ${prodData?.length || 0} producoes com pedido_id`);

    if (prodData && prodData.length > 0) {
        const uniquePedidoIds = Array.from(new Set(prodData.map(p => p.pedido_id).filter(Boolean)));
        console.log('IDs unicos:', uniquePedidoIds);

        const { data, error } = await supabase
            .from('pedidos')
            .select('id, numero')
            .in('id', uniquePedidoIds);

        console.log('Pedidos correspondentes encontrados:', data?.length);
    }
}
test();
