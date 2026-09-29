-- Create table estoque_terceiros
CREATE TABLE IF NOT EXISTS public.estoque_terceiros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    entidade_id UUID NOT NULL REFERENCES public.entidade(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materiais(id) ON DELETE CASCADE,
    cor TEXT NOT NULL,
    quantidade NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(entidade_id, material_id, cor)
);

-- Active RLS
ALTER TABLE public.estoque_terceiros ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Empresas podem ver seu próprio estoque de terceiros" 
    ON public.estoque_terceiros 
    FOR SELECT 
    USING (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem inserir seu próprio estoque de terceiros" 
    ON public.estoque_terceiros 
    FOR INSERT 
    WITH CHECK (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem atualizar seu próprio estoque de terceiros" 
    ON public.estoque_terceiros 
    FOR UPDATE 
    USING (empresa_id = public.get_current_empresa_id())
    WITH CHECK (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem deletar seu próprio estoque de terceiros" 
    ON public.estoque_terceiros 
    FOR DELETE 
    USING (empresa_id = public.get_current_empresa_id());

-- Create Trigger for updated_at
CREATE TRIGGER handle_updated_at_estoque_terceiros
    BEFORE UPDATE ON public.estoque_terceiros
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
