-- ========================================
-- FASE 1: ADICIONAR EMPRESA_ID EM TODAS AS TABELAS
-- ========================================

-- 1. Colaboradores
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- 2. Etapas
ALTER TABLE etapas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- 3. Subetapas
ALTER TABLE subetapas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- 4. Produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- 5. Lotes
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- 6. Producoes
ALTER TABLE producoes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- 7. Metas
ALTER TABLE metas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- 8. Previsoes Producao
ALTER TABLE previsoes_producao ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- 9. Produto Etapas
ALTER TABLE produto_etapas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- 10. Previsao Ajustes
ALTER TABLE previsao_ajustes ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- 11. Previsao Imprevistos
ALTER TABLE previsao_imprevistos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE;

-- ========================================
-- FASE 2: CRIAR FUNÇÃO SECURITY DEFINER
-- ========================================

CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM usuarios WHERE id = auth.uid()
$$;

-- ========================================
-- FASE 3: REMOVER POLÍTICAS ANTIGAS
-- ========================================

-- Colaboradores
DROP POLICY IF EXISTS "Colaboradores: Todos autenticados podem ler" ON colaboradores;
DROP POLICY IF EXISTS "Colaboradores: Sistema pode inserir" ON colaboradores;
DROP POLICY IF EXISTS "Colaboradores: Sistema pode atualizar" ON colaboradores;
DROP POLICY IF EXISTS "Colaboradores: Sistema pode deletar" ON colaboradores;
DROP POLICY IF EXISTS "Multi-tenancy colaboradores" ON colaboradores;

-- Etapas
DROP POLICY IF EXISTS "Multi-tenancy etapas" ON etapas;

-- Subetapas
DROP POLICY IF EXISTS "Multi-tenancy subetapas" ON subetapas;

-- Produtos
DROP POLICY IF EXISTS "Multi-tenancy produtos" ON produtos;

-- Lotes
DROP POLICY IF EXISTS "Multi-tenancy lotes" ON lotes;

-- Producoes
DROP POLICY IF EXISTS "Multi-tenancy producoes" ON producoes;

-- Metas
DROP POLICY IF EXISTS "Multi-tenancy metas" ON metas;

-- Previsoes Producao
DROP POLICY IF EXISTS "Multi-tenancy previsoes_producao" ON previsoes_producao;

-- Produto Etapas
DROP POLICY IF EXISTS "Multi-tenancy produto_etapas" ON produto_etapas;

-- Previsao Ajustes
DROP POLICY IF EXISTS "Multi-tenancy previsao_ajustes" ON previsao_ajustes;

-- Previsao Imprevistos
DROP POLICY IF EXISTS "Multi-tenancy previsao_imprevistos" ON previsao_imprevistos;

-- ========================================
-- FASE 4: CRIAR NOVAS POLÍTICAS RLS
-- ========================================

-- Colaboradores
CREATE POLICY "Colaboradores: Isolamento por empresa" ON colaboradores
FOR ALL USING (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
);

-- Etapas
CREATE POLICY "Etapas: Isolamento por empresa" ON etapas
FOR ALL USING (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
);

-- Subetapas
CREATE POLICY "Subetapas: Isolamento por empresa" ON subetapas
FOR ALL USING (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
);

-- Produtos
CREATE POLICY "Produtos: Isolamento por empresa" ON produtos
FOR ALL USING (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
);

-- Lotes
CREATE POLICY "Lotes: Isolamento por empresa" ON lotes
FOR ALL USING (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
);

-- Producoes
CREATE POLICY "Producoes: Isolamento por empresa" ON producoes
FOR ALL USING (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
);

-- Metas
CREATE POLICY "Metas: Isolamento por empresa" ON metas
FOR ALL USING (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
);

-- Previsoes Producao
CREATE POLICY "Previsoes: Isolamento por empresa" ON previsoes_producao
FOR ALL USING (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
);

-- Produto Etapas
CREATE POLICY "Produto Etapas: Isolamento por empresa" ON produto_etapas
FOR ALL USING (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
);

-- Previsao Ajustes
CREATE POLICY "Previsao Ajustes: Isolamento por empresa" ON previsao_ajustes
FOR ALL USING (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
);

-- Previsao Imprevistos
CREATE POLICY "Previsao Imprevistos: Isolamento por empresa" ON previsao_imprevistos
FOR ALL USING (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  empresa_id = get_user_empresa_id() OR 
  has_role(auth.uid(), 'super_admin')
);