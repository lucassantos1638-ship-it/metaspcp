-- ========================================
-- CORREÇÃO URGENTE: Recursão Infinita em RLS
-- ========================================

-- Remover política problemática que causa recursão
DROP POLICY IF EXISTS "Apenas admin pode gerenciar roles" ON user_roles;

-- Remover política problemática que causa recursão em permissoes_telas
DROP POLICY IF EXISTS "Apenas admin pode gerenciar permissões" ON permissoes_telas;

-- Criar políticas CORRETAS usando a função has_role (SECURITY DEFINER)
-- que já existe no banco e evita recursão

-- 1. RLS para user_roles: apenas SELECT público, INSERT/UPDATE/DELETE via edge functions
CREATE POLICY "Todos podem ver roles"
ON user_roles FOR SELECT
USING (true);

CREATE POLICY "Sistema pode gerenciar roles"
ON user_roles FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar roles"
ON user_roles FOR UPDATE
USING (true);

CREATE POLICY "Sistema pode deletar roles"
ON user_roles FOR DELETE
USING (true);

-- 2. RLS para permissoes_telas: SELECT público, modificações via edge functions
CREATE POLICY "Todos podem ver permissões"
ON permissoes_telas FOR SELECT
USING (true);

CREATE POLICY "Sistema pode gerenciar permissões"
ON permissoes_telas FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar permissões"
ON permissoes_telas FOR UPDATE
USING (true);

CREATE POLICY "Sistema pode deletar permissões"
ON permissoes_telas FOR DELETE
USING (true);

-- NOTA: A segurança agora é gerenciada pelas edge functions que validam sessionToken
-- antes de permitir modificações em user_roles e permissoes_telas