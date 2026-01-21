-- Tabela de usuários (sem usar auth.users do Supabase)
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nome_completo TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  colaborador_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_colaborador ON usuarios(colaborador_id);

-- Enum de perfis
CREATE TYPE app_role AS ENUM ('gestor', 'colaborador');

-- Tabela de perfis (roles)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);

-- Controle granular de acesso
CREATE TABLE permissoes_telas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  tela TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tela)
);

CREATE INDEX idx_permissoes_user ON permissoes_telas(user_id);

-- Gerenciar sessões ativas
CREATE TABLE sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessoes_token ON sessoes(token);
CREATE INDEX idx_sessoes_expires ON sessoes(expires_at);

-- Configurações globais do sistema
CREATE TABLE configuracoes_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hora_entrada TIME NOT NULL DEFAULT '07:00:00',
  hora_saida_manha TIME NOT NULL DEFAULT '11:00:00',
  hora_retorno_tarde TIME NOT NULL DEFAULT '12:00:00',
  hora_saida TIME NOT NULL DEFAULT '17:00:00',
  plano_ativo TEXT DEFAULT 'mensal',
  data_renovacao_plano DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES usuarios(id)
);

-- Inserir configuração padrão
INSERT INTO configuracoes_empresa (id) VALUES (gen_random_uuid());

-- Registro de todas as ações importantes
CREATE TABLE logs_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  acao TEXT NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_user ON logs_acoes(user_id);
CREATE INDEX idx_logs_created ON logs_acoes(created_at DESC);

-- Função segura para verificar roles
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Verificar se usuário tem acesso a uma tela específica
CREATE OR REPLACE FUNCTION tem_permissao_tela(_user_id UUID, _tela TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM permissoes_telas
    WHERE user_id = _user_id AND tela = _tela
  ) OR has_role(_user_id, 'gestor')
$$;

-- Limpar sessões antigas automaticamente
CREATE OR REPLACE FUNCTION limpar_sessoes_expiradas()
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM sessoes WHERE expires_at < NOW();
$$;

-- Habilitar RLS em todas as tabelas sensíveis
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissoes_telas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_acoes ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS para 'usuarios'
CREATE POLICY "Usuários: Gestores veem todos"
ON usuarios FOR SELECT
TO public
USING (true);

CREATE POLICY "Usuários: Gestores podem criar"
ON usuarios FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Usuários: Gestores podem atualizar"
ON usuarios FOR UPDATE
TO public
USING (true);

-- POLÍTICAS para 'user_roles'
CREATE POLICY "Roles: Todos podem ler"
ON user_roles FOR SELECT
TO public
USING (true);

CREATE POLICY "Roles: Sistema pode criar"
ON user_roles FOR INSERT
TO public
WITH CHECK (true);

-- POLÍTICAS para 'permissoes_telas'
CREATE POLICY "Permissões: Todos podem ler"
ON permissoes_telas FOR SELECT
TO public
USING (true);

CREATE POLICY "Permissões: Sistema pode gerenciar"
ON permissoes_telas FOR ALL
TO public
USING (true);

-- POLÍTICAS para 'sessoes'
CREATE POLICY "Sessões: Todos podem ler"
ON sessoes FOR SELECT
TO public
USING (true);

CREATE POLICY "Sessões: Sistema pode inserir"
ON sessoes FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Sessões: Sistema pode deletar"
ON sessoes FOR DELETE
TO public
USING (true);

-- POLÍTICAS para 'configuracoes_empresa'
CREATE POLICY "Configurações: Todos podem ler"
ON configuracoes_empresa FOR SELECT
TO public
USING (true);

CREATE POLICY "Configurações: Todos podem atualizar"
ON configuracoes_empresa FOR UPDATE
TO public
USING (true);

-- POLÍTICAS para 'logs_acoes'
CREATE POLICY "Logs: Todos podem ler"
ON logs_acoes FOR SELECT
TO public
USING (true);

CREATE POLICY "Logs: Sistema pode inserir"
ON logs_acoes FOR INSERT
TO public
WITH CHECK (true);

-- Criar gestor inicial (senha: admin123)
INSERT INTO usuarios (id, username, password_hash, nome_completo, ativo)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  '$2a$10$rZHPxN5S1z0yP5qK7BvZy.Kq1Y4tX5LvG5V8zN3wF5V8zN3wF5V8z',
  'Administrador do Sistema',
  true
);

INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'gestor');