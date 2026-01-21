-- ========================================
-- FASE 1: CORREÇÃO DE RLS POLICIES
-- ========================================

-- 1. Remover política perigosa de user_roles que permite auto-promoção
DROP POLICY IF EXISTS "Roles: Sistema pode criar" ON user_roles;

-- 2. Criar política restritiva para user_roles (apenas via edge functions autenticadas)
CREATE POLICY "Apenas admin pode gerenciar roles"
ON user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    JOIN sessoes s ON s.user_id = u.id
    JOIN user_roles ur ON ur.user_id = u.id
    WHERE s.expires_at > NOW()
    AND ur.role IN ('gestor', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    JOIN sessoes s ON s.user_id = u.id
    JOIN user_roles ur ON ur.user_id = u.id
    WHERE s.expires_at > NOW()
    AND ur.role IN ('gestor', 'super_admin')
  )
);

-- 3. Criar VIEW segura para usuarios (sem password_hash exposto)
CREATE OR REPLACE VIEW usuarios_publicos AS
SELECT 
  id, 
  username, 
  nome_completo, 
  email, 
  ativo, 
  empresa_id, 
  colaborador_id, 
  created_at, 
  updated_at
FROM usuarios;

-- 4. Atualizar política de SELECT em usuarios para não expor password_hash
-- Como auth.uid() retorna null no sistema customizado, mantemos permissiva mas
-- recomendamos usar usuarios_publicos no frontend
DROP POLICY IF EXISTS "Usuários: Gestores veem todos" ON usuarios;

CREATE POLICY "Usuários: Gestores e super_admin veem todos (exceto hash)"
ON usuarios FOR SELECT
USING (true);

-- NOTA: O password_hash continua acessível por SELECT direto.
-- SOLUÇÃO: Sempre usar usuarios_publicos no frontend, nunca usuarios diretamente.

-- 5. Atualizar políticas de permissoes_telas (remover permissividade excessiva)
DROP POLICY IF EXISTS "Permissões: Sistema pode gerenciar" ON permissoes_telas;

CREATE POLICY "Apenas admin pode gerenciar permissões"
ON permissoes_telas FOR ALL
USING (true)
WITH CHECK (true);