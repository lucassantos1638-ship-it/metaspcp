
import { createClient } from '@supabase/supabase-js';

// Hardcoded for reliability during this test
const supabaseUrl = "https://ucsfqmrfakhopaqxbudh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjc2ZxbXJmYWtob3BhcXhidWRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU5OTE4MCwiZXhwIjoyMDg0MTc1MTgwfQ.GPjivqFvJoaOGxqaDvwPjdKd4FzNl8XYB8MzCGzxCX0";

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function tryRpc(name) {
    console.log(`Trying RPC: ${name}...`);
    // Try with just a simple SELECT 1
    const { data, error } = await supabase.rpc(name, { query: 'SELECT 1' });

    if (error) {
        console.log(`Error on ${name} (query param):`, error.message);
        // Try different param name 'sql'
        const { data: d2, error: e2 } = await supabase.rpc(name, { sql: 'SELECT 1' });
        if (e2) {
            console.log(`Error on ${name} (sql param):`, e2.message);
            return false;
        }
        console.log(`Success ${name} with param 'sql'!`);
        return 'sql';
    }
    console.log(`Success ${name} with param 'query'!`);
    return 'query';
}

async function run() {
    const candidates = ['exec_sql', 'run_sql', 'exec', 'query', 'pg_query', 'execute_sql', 'exec_query'];

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
        
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'atividades' AND policyname = 'Enable read access for all users of the same company') THEN
                CREATE POLICY "Enable read access for all users of the same company" ON public.atividades FOR SELECT TO authenticated USING (empresa_id = (SELECT empresa_id FROM public.users WHERE id = auth.uid()));
            END IF;
            
             IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'atividades' AND policyname = 'Enable insert access for all users of the same company') THEN
                CREATE POLICY "Enable insert access for all users of the same company" ON public.atividades FOR INSERT TO authenticated WITH CHECK (empresa_id = (SELECT empresa_id FROM public.users WHERE id = auth.uid()));
            END IF;
            
             IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'atividades' AND policyname = 'Enable update access for all users of the same company') THEN
                CREATE POLICY "Enable update access for all users of the same company" ON public.atividades FOR UPDATE TO authenticated USING (empresa_id = (SELECT empresa_id FROM public.users WHERE id = auth.uid()));
            END IF;
            
             IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'atividades' AND policyname = 'Enable delete access for all users of the same company') THEN
                CREATE POLICY "Enable delete access for all users of the same company" ON public.atividades FOR DELETE TO authenticated USING (empresa_id = (SELECT empresa_id FROM public.users WHERE id = auth.uid()));
            END IF;
        END
        $$;

        ALTER TABLE public.producoes ADD COLUMN IF NOT EXISTS atividade_id UUID REFERENCES public.atividades(id);
        ALTER TABLE public.producoes ALTER COLUMN lote_id DROP NOT NULL;
        ALTER TABLE public.producoes ALTER COLUMN etapa_id DROP NOT NULL;
        
        -- Safe constraint addition
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_atividade_or_producao') THEN
                ALTER TABLE public.producoes ADD CONSTRAINT check_atividade_or_producao CHECK ((lote_id IS NOT NULL AND etapa_id IS NOT NULL) OR (atividade_id IS NOT NULL));
            END IF;
        END
        $$;
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
