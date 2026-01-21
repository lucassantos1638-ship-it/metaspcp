CREATE TABLE public.metas (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL,
    etapa_id uuid REFERENCES public.etapas(id) ON DELETE CASCADE,
    subetapa_id uuid REFERENCES public.subetapas(id) ON DELETE CASCADE,
    meta integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT metas_etapa_or_subetapa_check CHECK (
        (etapa_id IS NOT NULL AND subetapa_id IS NULL) OR 
        (etapa_id IS NULL AND subetapa_id IS NOT NULL)
    ),
    CONSTRAINT metas_empresa_etapa_unique UNIQUE (empresa_id, etapa_id),
    CONSTRAINT metas_empresa_subetapa_unique UNIQUE (empresa_id, subetapa_id)
);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Metas: SELECT por empresa" ON metas FOR SELECT USING (true);
CREATE POLICY "Metas: Modificações permitidas" ON metas FOR ALL USING (true) WITH CHECK (true);
