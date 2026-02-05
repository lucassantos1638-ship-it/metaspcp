
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function tryRpc(name) {
    console.log(`Trying RPC: ${name}...`);
    const { data, error } = await supabase.rpc(name, { query: 'SELECT 1' });
    if (error) {
        // Try different param name
        const { data: d2, error: e2 } = await supabase.rpc(name, { sql: 'SELECT 1' });
        if (e2) {
            console.log(`Failed ${name}:`, error.message);
            return false;
        }
        console.log(`Success ${name} with param 'sql'!`);
        return 'sql';
    }
    console.log(`Success ${name} with param 'query'!`);
    return 'query';
}

async function run() {
    const candidates = ['exec_sql', 'run_sql', 'exec', 'query', 'pg_query', 'execute_sql'];
    for (const name of candidates) {
        const paramName = await tryRpc(name);
        if (paramName) {
            console.log(`FOUND RPC: ${name}, param: ${paramName}`);

            // Now try to run the migration
            const migration = `
        CREATE TABLE IF NOT EXISTS public.atividades (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            nome TEXT NOT NULL,
            empresa_id UUID NOT NULL,
            ativo BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_atividades_empresa_id ON public.atividades(empresa_id);
        ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.producoes ADD COLUMN IF NOT EXISTS atividade_id UUID REFERENCES public.atividades(id);
        ALTER TABLE public.producoes ALTER COLUMN lote_id DROP NOT NULL;
        ALTER TABLE public.producoes ALTER COLUMN etapa_id DROP NOT NULL;
        ALTER TABLE public.producoes ADD CONSTRAINT check_atividade_or_producao CHECK ((lote_id IS NOT NULL AND etapa_id IS NOT NULL) OR (atividade_id IS NOT NULL));
        `;

            console.log('Running migration...');
            const { error } = await supabase.rpc(name, { [paramName]: migration });
            if (error) console.error('Migration failed:', error);
            else console.log('Migration succeeded!');

            return;
        }
    }
    console.log('No suitable RPC found.');
}

run();
