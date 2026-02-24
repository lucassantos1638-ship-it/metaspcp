-- Create entidade_servicos table
CREATE TABLE IF NOT EXISTS public.entidade_servicos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    entidade_id UUID NOT NULL REFERENCES public.entidade(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    valor NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Active RLS
ALTER TABLE public.entidade_servicos ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Empresas podem ver seus próprios serviços de entidade" 
    ON public.entidade_servicos 
    FOR SELECT 
    USING (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem inserir seus próprios serviços de entidade" 
    ON public.entidade_servicos 
    FOR INSERT 
    WITH CHECK (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem atualizar seus próprios serviços de entidade" 
    ON public.entidade_servicos 
    FOR UPDATE 
    USING (empresa_id = public.get_current_empresa_id())
    WITH CHECK (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem deletar seus próprios serviços de entidade" 
    ON public.entidade_servicos 
    FOR DELETE 
    USING (empresa_id = public.get_current_empresa_id());

-- Create Trigger for updated_at
CREATE TRIGGER handle_updated_at_entidade_servicos
    BEFORE UPDATE ON public.entidade_servicos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Alter producoes table
ALTER TABLE public.producoes
    ADD COLUMN IF NOT EXISTS terceirizado BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS entidade_id UUID REFERENCES public.entidade(id),
    ADD COLUMN IF NOT EXISTS servico_id UUID REFERENCES public.entidade_servicos(id),
    ADD COLUMN IF NOT EXISTS quantidade_enviada INTEGER,
    ADD COLUMN IF NOT EXISTS quantidade_devolvida INTEGER DEFAULT 0;

-- Make colaborador_id nullable just in case it was required
ALTER TABLE public.producoes ALTER COLUMN colaborador_id DROP NOT NULL;
