-- 1. Criar tabela empresas
CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  email_contato TEXT NOT NULL,
  telefone TEXT,
  plano_ativo TEXT DEFAULT 'mensal' CHECK (plano_ativo IN ('mensal', 'anual', 'vitalicio')),
  data_renovacao_plano DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para empresas (apenas super admin por enquanto)
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin vê todas empresas"
  ON empresas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
  );

CREATE POLICY "Super admin pode criar empresas"
  ON empresas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
  );

CREATE POLICY "Super admin pode atualizar empresas"
  ON empresas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'super_admin'::"app_role"
    )
  );

-- 2. Atualizar tabela usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE;

-- 3. Atualizar configuracoes_empresa
ALTER TABLE configuracoes_empresa
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

-- 4. Criar empresa padrão para dados existentes
INSERT INTO empresas (id, nome, email_contato, plano_ativo, ativo)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Empresa Principal',
  'contato@empresa.com',
  'mensal',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 5. Vincular usuários existentes à empresa padrão
UPDATE usuarios
SET empresa_id = '00000000-0000-0000-0000-000000000001'
WHERE empresa_id IS NULL;

-- 6. Vincular configurações à empresa padrão
UPDATE configuracoes_empresa
SET empresa_id = '00000000-0000-0000-0000-000000000001'
WHERE empresa_id IS NULL;

-- 7. Criar empresa para administração
INSERT INTO empresas (id, nome, email_contato, plano_ativo, ativo)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Meta PCP - Administração',
  'admin@metapcp.com',
  'vitalicio',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 8. Criar usuário super admin (senha: super123)
INSERT INTO usuarios (id, username, password_hash, nome_completo, email, empresa_id, ativo)
VALUES (
  '10000000-0000-0000-0000-000000000000',
  'superadmin',
  '9b3bb88cd6b7055b44f3d8e6f5e49f058c8a1c0f859c0e4c89e63a5e7e7e3c7b',
  'Super Administrador',
  'admin@metapcp.com',
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;

-- 9. Adicionar role super_admin
INSERT INTO user_roles (user_id, role)
VALUES ('10000000-0000-0000-0000-000000000000', 'super_admin'::"app_role")
ON CONFLICT (user_id, role) DO NOTHING;

-- 10. Agora adicionar política para gestores verem suas empresas
CREATE POLICY "Gestores veem sua empresa"
  ON empresas FOR SELECT
  USING (
    id IN (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );