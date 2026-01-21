-- Migration to Audit and Shield Multi-Tenancy (Blindagem)

-- Helper function to get current user's empresa_id safely
-- We assume auth.uid() maps to a user in public.usuarios
CREATE OR REPLACE FUNCTION public.get_current_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = auth.uid();
$$;

-- 1. LOTES
ALTER TABLE public.lotes 
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lotes: Accesso por empresa" ON public.lotes;
CREATE POLICY "Lotes: Accesso por empresa" ON public.lotes
  FOR ALL
  USING (
    empresa_id IS NULL 
    OR 
    empresa_id = public.get_current_empresa_id()
  )
  WITH CHECK (
    empresa_id = public.get_current_empresa_id()
  );

-- 2. PRODUCOES
ALTER TABLE public.producoes 
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.producoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Producoes: Accesso por empresa" ON public.producoes;
CREATE POLICY "Producoes: Accesso por empresa" ON public.producoes
  FOR ALL
  USING (
    empresa_id IS NULL 
    OR 
    empresa_id = public.get_current_empresa_id()
  )
  WITH CHECK (
    empresa_id = public.get_current_empresa_id()
  );

-- 3. COLABORADORES
ALTER TABLE public.colaboradores 
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Colaboradores: Accesso por empresa" ON public.colaboradores;
CREATE POLICY "Colaboradores: Accesso por empresa" ON public.colaboradores
  FOR ALL
  USING (
    empresa_id IS NULL 
    OR 
    empresa_id = public.get_current_empresa_id()
  )
  WITH CHECK (
    empresa_id = public.get_current_empresa_id()
  );

-- 4. PRODUTOS
ALTER TABLE public.produtos 
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Produtos: Accesso por empresa" ON public.produtos;
CREATE POLICY "Produtos: Accesso por empresa" ON public.produtos
  FOR ALL
  USING (
    empresa_id IS NULL 
    OR 
    empresa_id = public.get_current_empresa_id()
  )
  WITH CHECK (
    empresa_id = public.get_current_empresa_id()
  );

-- 5. ETAPAS
ALTER TABLE public.etapas 
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.etapas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Etapas: Accesso por empresa" ON public.etapas;
CREATE POLICY "Etapas: Accesso por empresa" ON public.etapas
  FOR ALL
  USING (
    empresa_id IS NULL 
    OR 
    empresa_id = public.get_current_empresa_id()
  )
  WITH CHECK (
    empresa_id = public.get_current_empresa_id()
  );

-- 6. SUBETAPAS
ALTER TABLE public.subetapas 
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.subetapas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subetapas: Accesso por empresa" ON public.subetapas;
CREATE POLICY "Subetapas: Accesso por empresa" ON public.subetapas
  FOR ALL
  USING (
    empresa_id IS NULL 
    OR 
    empresa_id = public.get_current_empresa_id()
  )
  WITH CHECK (
    empresa_id = public.get_current_empresa_id()
  );

-- 7. PREVISOES (Forecast)
ALTER TABLE public.previsoes_producao
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id);
ALTER TABLE public.previsoes_producao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Previsoes: Accesso por empresa" ON public.previsoes_producao;
CREATE POLICY "Previsoes: Accesso por empresa" ON public.previsoes_producao
  FOR ALL
  USING (
    empresa_id IS NULL 
    OR 
    empresa_id = public.get_current_empresa_id()
  )
  WITH CHECK (
    empresa_id = public.get_current_empresa_id()
  );
