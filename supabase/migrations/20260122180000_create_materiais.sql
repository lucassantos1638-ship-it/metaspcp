-- Create table for Materiais
CREATE TABLE public.materiais (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid REFERENCES public.empresas(id),
    nome text NOT NULL,
    preco_custo numeric(10,2) DEFAULT 0.00,
    unidade_medida text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create table for Cores dos Materiais
CREATE TABLE public.materiais_cores (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid REFERENCES public.empresas(id),
    material_id uuid REFERENCES public.materiais(id) ON DELETE CASCADE,
    nome text NOT NULL,
    hex text, -- codigo hexadecimal da cor opcional
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_materiais_empresa_id ON public.materiais(empresa_id);
CREATE INDEX idx_materiais_ativo ON public.materiais(ativo);
CREATE INDEX idx_materiais_cores_material ON public.materiais_cores(material_id);

-- Enable RLS
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais_cores ENABLE ROW LEVEL SECURITY;

-- Policies for Materiais
CREATE POLICY "Materiais: Acesso por empresa" ON public.materiais
    FOR ALL
    USING (
        empresa_id = public.get_current_empresa_id()
    )
    WITH CHECK (
        empresa_id = public.get_current_empresa_id()
    );

-- Policies for Materiais Cores
CREATE POLICY "Materiais Cores: Acesso por empresa" ON public.materiais_cores
    FOR ALL
    USING (
        empresa_id = public.get_current_empresa_id()
    )
    WITH CHECK (
        empresa_id = public.get_current_empresa_id()
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_materiais_updated_at
    BEFORE UPDATE ON public.materiais
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();
