-- Create Create entidade table
CREATE TABLE IF NOT EXISTS public.entidade (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('cliente', 'fornecedor', 'terceirizado')),
    cpf_cnpj TEXT,
    telefone TEXT,
    endereco TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Active RLS
ALTER TABLE public.entidade ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Empresas podem ver suas próprias entidades" 
    ON public.entidade 
    FOR SELECT 
    USING (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem inserir suas próprias entidades" 
    ON public.entidade 
    FOR INSERT 
    WITH CHECK (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem atualizar suas próprias entidades" 
    ON public.entidade 
    FOR UPDATE 
    USING (empresa_id = public.get_current_empresa_id())
    WITH CHECK (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem deletar suas próprias entidades" 
    ON public.entidade 
    FOR DELETE 
    USING (empresa_id = public.get_current_empresa_id());

-- Create Trigger for updated_at
CREATE TRIGGER handle_updated_at_entidades
    BEFORE UPDATE ON public.entidade
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
