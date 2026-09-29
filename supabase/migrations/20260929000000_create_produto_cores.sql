-- ==========================================
-- 1. DROP Tabela Antiga se existir
-- ==========================================
DROP TABLE IF EXISTS public.produto_cores;

-- ==========================================
-- 2. Tabela de Cores do Produto
-- ==========================================
CREATE TABLE IF NOT EXISTS public.produto_cores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    codigo TEXT,
    descricao TEXT NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Active RLS
ALTER TABLE public.produto_cores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresas podem ver as cores de seus produtos" 
    ON public.produto_cores 
    FOR SELECT 
    USING (empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE POLICY "Empresas podem criar cores para seus produtos" 
    ON public.produto_cores 
    FOR INSERT 
    WITH CHECK (empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE POLICY "Empresas podem editar suas cores" 
    ON public.produto_cores 
    FOR UPDATE 
    USING (empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

CREATE POLICY "Empresas podem excluir suas cores" 
    ON public.produto_cores 
    FOR DELETE 
    USING (empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()));

-- Criar trigger para updated_at se não existir
DROP TRIGGER IF EXISTS set_produto_cores_updated_at ON public.produto_cores;
CREATE TRIGGER set_produto_cores_updated_at
BEFORE UPDATE ON public.produto_cores
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
