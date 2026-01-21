CREATE TABLE IF NOT EXISTS public.colaboradores (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    funcao text,
    custo_por_hora numeric DEFAULT 0,
    custo_hora_extra numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'colaboradores' AND column_name = 'custo_hora_extra') THEN
        ALTER TABLE public.colaboradores ADD COLUMN custo_hora_extra numeric DEFAULT 0;
    END IF;
END $$;
