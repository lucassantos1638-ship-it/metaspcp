-- Adicionar coluna empresa_id nas tabelas principais
ALTER TABLE projecoes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE vendas_perdidas ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

-- Backfill dos dados existentes baseado no usuario_id
-- Assumindo que a tabela usuarios tem empresa_id e o id bate com usuario_id das tabelas
UPDATE projecoes p
SET empresa_id = u.empresa_id
FROM usuarios u
WHERE p.usuario_id = u.id
AND p.empresa_id IS NULL;

UPDATE vendas_perdidas v
SET empresa_id = u.empresa_id
FROM usuarios u
WHERE v.usuario_id = u.id
AND v.empresa_id IS NULL;

-- Tornar a coluna obrigatória após backfill (opcional, mas recomendado se todos tiverem empresa)
-- ALTER TABLE projecoes ALTER COLUMN empresa_id SET NOT NULL;
-- ALTER TABLE vendas_perdidas ALTER COLUMN empresa_id SET NOT NULL;

-- Habilitar RLS
ALTER TABLE projecoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas_perdidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE projecao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas_perdidas_itens ENABLE ROW LEVEL SECURITY;

-- Criar Políticas de Segurança (RLS)

-- PROJECOES
DROP POLICY IF EXISTS "Usuários podem ver projeções da sua empresa" ON projecoes;
CREATE POLICY "Usuários podem ver projeções da sua empresa"
ON projecoes FOR SELECT
USING (
  empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Usuários podem criar projeções para sua empresa" ON projecoes;
CREATE POLICY "Usuários podem criar projeções para sua empresa"
ON projecoes FOR INSERT
WITH CHECK (
  empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Usuários podem atualizar projeções da sua empresa" ON projecoes;
CREATE POLICY "Usuários podem atualizar projeções da sua empresa"
ON projecoes FOR UPDATE
USING (
  empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Usuários podem deletar projeções da sua empresa" ON projecoes;
CREATE POLICY "Usuários podem deletar projeções da sua empresa"
ON projecoes FOR DELETE
USING (
  empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

-- PROJECAO_ITENS (Baseado na projeção pai)
DROP POLICY IF EXISTS "Acesso itens projeção via pai" ON projecao_itens;
CREATE POLICY "Acesso itens projeção via pai"
ON projecao_itens FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projecoes p
    WHERE p.id = projecao_itens.projecao_id
    AND p.empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  )
);

-- VENDAS PERDIDAS
DROP POLICY IF EXISTS "Usuários podem ver vendas perdidas da sua empresa" ON vendas_perdidas;
CREATE POLICY "Usuários podem ver vendas perdidas da sua empresa"
ON vendas_perdidas FOR SELECT
USING (
  empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Usuários podem criar vendas perdidas para sua empresa" ON vendas_perdidas;
CREATE POLICY "Usuários podem criar vendas perdidas para sua empresa"
ON vendas_perdidas FOR INSERT
WITH CHECK (
  empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Usuários podem atualizar vendas perdidas da sua empresa" ON vendas_perdidas;
CREATE POLICY "Usuários podem atualizar vendas perdidas da sua empresa"
ON vendas_perdidas FOR UPDATE
USING (
  empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Usuários podem deletar vendas perdidas da sua empresa" ON vendas_perdidas;
CREATE POLICY "Usuários podem deletar vendas perdidas da sua empresa"
ON vendas_perdidas FOR DELETE
USING (
  empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
);

-- VENDAS_PERDIDAS_ITENS (Baseado na venda pai)
DROP POLICY IF EXISTS "Acesso itens venda perdida via pai" ON vendas_perdidas_itens;
CREATE POLICY "Acesso itens venda perdida via pai"
ON vendas_perdidas_itens FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM vendas_perdidas v
    WHERE v.id = vendas_perdidas_itens.venda_perdida_id
    AND v.empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  )
);
