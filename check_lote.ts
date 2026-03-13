import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Checking Lote 2843...');
    const { data: lotes, error: errLot } = await supabase
        .from('lotes')
        .select('id, numero_lote, quantidade_total, produto_id')
        .eq('numero_lote', '2843');

    if (errLot) {
        console.error('Error fetching lotes:', errLot);
        return;
    }

    console.log('Lotes found:', lotes);

    if (lotes && lotes.length > 0) {
        const loteId = lotes[0].id;
        const { data: producoes, error: errProd } = await supabase
            .from('producoes')
            .select('id, etapa_id, subetapa_id, quantidade_produzida, status')
            .eq('lote_id', loteId);

        console.log('Producoes for lote 2843:', producoes);
        if (errProd) {
            console.error('Error fetching producoes:', errProd);
        }
    }
}

check();
