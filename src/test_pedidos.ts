import { supabase } from '@/integrations/supabase/client';

async function test() {
    const empresaId = 'eb08736f-b27b-48aa-b6bb-265147402636'; // ou ignorar empresaId no teste só p/ ver se algo retorna

    console.log("Fetching producoes...");
    const { data: prodData, error: prodErr } = await supabase
        .from('producoes')
        .select('pedido_id, empresa_id')
        .not('pedido_id', 'is', null);

    console.log('Producoes Error:', prodErr?.message);
    const validProds = prodData?.filter(p => p.pedido_id);
    console.log(`Producoes com pedido_id count = ${validProds?.length}`);

    if (validProds && validProds.length > 0) {
        const uniquePedidoIds = Array.from(new Set(validProds.map((p: any) => p.pedido_id)));
        console.log('uniquePedidoIds:', uniquePedidoIds);

        const { data, error } = await supabase
            .from('pedidos')
            .select('id, numero, entidade:entidades(nome)')
            .in('id', uniquePedidoIds);

        console.log('Pedidos Error:', error?.message);
        console.log('Pedidos fetched:', data);
    }
}

test();
