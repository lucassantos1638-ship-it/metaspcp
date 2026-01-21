CREATE TABLE public.configuracoes_empresa (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL,
    velocidade_scroll_dashboard integer DEFAULT 120,
    estilo_lista_dashboard text DEFAULT 'lista_rolante',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT configuracoes_empresa_empresa_id_unique UNIQUE (empresa_id)
);

ALTER TABLE public.configuracoes_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Configuracoes: SELECT por empresa" ON configuracoes_empresa FOR SELECT USING (true);
CREATE POLICY "Configuracoes: Modificações permitidas" ON configuracoes_empresa FOR ALL USING (true) WITH CHECK (true);
