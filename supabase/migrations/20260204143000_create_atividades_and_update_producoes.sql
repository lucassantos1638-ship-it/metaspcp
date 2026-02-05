-- Create atividades table
CREATE TABLE IF NOT EXISTS public.atividades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    empresa_id UUID NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_atividades_empresa_id ON public.atividades(empresa_id);

-- Enable RLS
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

-- Create policies for atividades
CREATE POLICY "Enable read access for all users of the same company"
ON public.atividades FOR SELECT
TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Enable insert access for all users of the same company"
ON public.atividades FOR INSERT
TO authenticated
WITH CHECK (empresa_id = (SELECT empresa_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Enable update access for all users of the same company"
ON public.atividades FOR UPDATE
TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Enable delete access for all users of the same company"
ON public.atividades FOR DELETE
TO authenticated
USING (empresa_id = (SELECT empresa_id FROM public.users WHERE id = auth.uid()));

-- Modify producoes table
ALTER TABLE public.producoes 
ADD COLUMN IF NOT EXISTS atividade_id UUID REFERENCES public.atividades(id);

-- Make lote_id and etapa_id nullable
ALTER TABLE public.producoes ALTER COLUMN lote_id DROP NOT NULL;
ALTER TABLE public.producoes ALTER COLUMN etapa_id DROP NOT NULL;

-- Add constraint to ensure either (lote_id and etapa_id) OR (atividade_id) is present
-- We can't strictly enforce this if existing data might temporarily violate during migration, 
-- but logically it should be one or the other.
-- For flexibility, let's add a check constraint that at least one "type" is present.
ALTER TABLE public.producoes ADD CONSTRAINT check_atividade_or_producao 
CHECK (
  (lote_id IS NOT NULL AND etapa_id IS NOT NULL) OR 
  (atividade_id IS NOT NULL)
);
