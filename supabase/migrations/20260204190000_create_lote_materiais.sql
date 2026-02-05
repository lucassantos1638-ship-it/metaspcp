-- Add conversion fields to materiais
ALTER TABLE public.materiais 
ADD COLUMN IF NOT EXISTS tem_conversao_pacote boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fator_conversao_pacote numeric(10,4) DEFAULT 1.0;

-- Create table for Produto Materiais (BOM)
CREATE TABLE IF NOT EXISTS public.produto_materiais (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id uuid REFERENCES public.empresas(id) NOT NULL,
    produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE NOT NULL,
    material_id uuid REFERENCES public.materiais(id) ON DELETE RESTRICT NOT NULL,
    consumo_padrao numeric(10,4) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for Produto Materiais
CREATE INDEX IF NOT EXISTS idx_produto_materiais_produto ON public.produto_materiais(produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_materiais_empresa ON public.produto_materiais(empresa_id);

-- RLS for Produto Materiais
ALTER TABLE public.produto_materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produto Materiais: Acesso por empresa" ON public.produto_materiais
    FOR ALL
    USING (empresa_id = public.get_current_empresa_id())
    WITH CHECK (empresa_id = public.get_current_empresa_id());


-- Create table for Lote Consumo Materiais
CREATE TABLE IF NOT EXISTS public.lote_consumo (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id uuid REFERENCES public.empresas(id) NOT NULL,
    lote_id uuid REFERENCES public.lotes(id) ON DELETE CASCADE NOT NULL,
    material_id uuid REFERENCES public.materiais(id) ON DELETE RESTRICT NOT NULL,
    cor_id uuid REFERENCES public.materiais_cores(id),
    
    quantidade_informada numeric(10,4) NOT NULL DEFAULT 0,
    unidade_informada text NOT NULL DEFAULT 'PADRAO', -- 'PADRAO' (receita) ou 'PACOTE'
    fator_conversao numeric(10,4) DEFAULT 1.0, -- Snapshot do fator no momento do lançamento
    quantidade_real numeric(10,4) GENERATED ALWAYS AS (quantidade_informada * fator_conversao) STORED,
    
    finalizado boolean DEFAULT false,
    observacao text,
    
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for Lote Consumo
CREATE INDEX IF NOT EXISTS idx_lote_consumo_lote ON public.lote_consumo(lote_id);
CREATE INDEX IF NOT EXISTS idx_lote_consumo_empresa ON public.lote_consumo(empresa_id);

-- RLS for Lote Consumo
ALTER TABLE public.lote_consumo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lote Consumo: Acesso por empresa" ON public.lote_consumo
    FOR ALL
    USING (empresa_id = public.get_current_empresa_id())
    WITH CHECK (empresa_id = public.get_current_empresa_id());

-- Validar integridade da cor
-- (Opcional: garantir que cor_id pertence ao material_id, mas deixaremos pro app por enquanto)
