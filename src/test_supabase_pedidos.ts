import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.VITE_SUPABASE_ANON_KEY as string
);

async function run() {
    console.log("Testing with entidade:entidades(nome)...");
    const { data: d1, error: e1 } = await supabase
        .from("pedidos")
        .select("id, numero, entidade:entidades(nome)");
    console.log("Result 1:", d1?.length, e1?.message);

    console.log("Testing with entidade(nome)...");
    const { data: d2, error: e2 } = await supabase
        .from("pedidos")
        .select("id, numero, entidade(nome)");
    console.log("Result 2:", d2?.length, e2?.message);
}
run();
