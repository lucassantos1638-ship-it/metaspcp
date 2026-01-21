-- Adicionar coluna status à tabela producoes
ALTER TABLE producoes 
ADD COLUMN status TEXT NOT NULL DEFAULT 'em_aberto';

-- Adicionar constraint para validar valores de status
ALTER TABLE producoes
ADD CONSTRAINT producoes_status_check 
CHECK (status IN ('em_aberto', 'finalizado'));

-- Adicionar coluna observacao
ALTER TABLE producoes
ADD COLUMN observacao TEXT;

-- Tornar campos de finalização opcionais (nullable)
ALTER TABLE producoes 
ALTER COLUMN quantidade_produzida DROP NOT NULL;

ALTER TABLE producoes 
ALTER COLUMN data_fim DROP NOT NULL;

ALTER TABLE producoes 
ALTER COLUMN hora_fim DROP NOT NULL;

-- Atualizar registros existentes para status 'finalizado'
UPDATE producoes 
SET status = 'finalizado'
WHERE data_fim IS NOT NULL AND hora_fim IS NOT NULL;

-- Criar índices para melhor performance
CREATE INDEX idx_producoes_status ON producoes(status);
CREATE INDEX idx_producoes_colaborador_status ON producoes(colaborador_id, status);

-- Dropar views dependentes em cascata e recriar
DROP VIEW IF EXISTS producoes_com_tempo CASCADE;

-- Recriar a view producoes_com_tempo para considerar apenas produções finalizadas
CREATE VIEW producoes_com_tempo AS
SELECT 
  id,
  colaborador_id,
  lote_id,
  etapa_id,
  subetapa_id,
  quantidade_produzida,
  data_inicio,
  hora_inicio,
  data_fim,
  hora_fim,
  created_at,
  segundos_inicio,
  segundos_fim,
  status,
  observacao,
  calcular_tempo_produtivo(
    data_inicio, 
    hora_inicio, 
    COALESCE(segundos_inicio, 0), 
    data_fim, 
    hora_fim, 
    COALESCE(segundos_fim, 0)
  ) AS tempo_produtivo_minutos
FROM producoes
WHERE status = 'finalizado' 
  AND data_fim IS NOT NULL 
  AND hora_fim IS NOT NULL;

-- Recriar view colaborador_desempenho
CREATE VIEW colaborador_desempenho AS
SELECT
  p.etapa_id,
  p.colaborador_id,
  MIN(p.data_inicio) AS primeira_producao,
  MAX(p.data_inicio) AS ultima_producao,
  COUNT(p.id) AS num_producoes,
  s.nome AS subetapa_nome,
  AVG(pct.tempo_produtivo_minutos / NULLIF(p.quantidade_produzida, 0)) AS tempo_medio_por_peca_minutos,
  e.nome AS etapa_nome,
  p.subetapa_id,
  c.nome AS colaborador_nome
FROM producoes p
JOIN producoes_com_tempo pct ON pct.id = p.id
JOIN colaboradores c ON c.id = p.colaborador_id
JOIN etapas e ON e.id = p.etapa_id
LEFT JOIN subetapas s ON s.id = p.subetapa_id
WHERE p.status = 'finalizado'
GROUP BY p.etapa_id, p.colaborador_id, p.subetapa_id, e.nome, s.nome, c.nome;

-- Recriar view produto_metricas
CREATE VIEW produto_metricas AS
SELECT
  l.produto_id,
  p.etapa_id,
  p.subetapa_id,
  COUNT(DISTINCT l.id) AS num_lotes_analisados,
  SUM(pct.tempo_produtivo_minutos) AS tempo_total_minutos,
  SUM(p.quantidade_produzida) AS quantidade_total,
  AVG(pct.tempo_produtivo_minutos / NULLIF(p.quantidade_produzida, 0)) AS tempo_medio_por_peca_minutos,
  e.custo_por_hora,
  (AVG(pct.tempo_produtivo_minutos / NULLIF(p.quantidade_produzida, 0)) / 60) * e.custo_por_hora AS custo_medio_por_peca,
  s.nome AS subetapa_nome,
  e.nome AS etapa_nome
FROM lotes l
JOIN producoes p ON p.lote_id = l.id
JOIN producoes_com_tempo pct ON pct.id = p.id
JOIN etapas e ON e.id = p.etapa_id
LEFT JOIN subetapas s ON s.id = p.subetapa_id
WHERE l.finalizado = true AND p.status = 'finalizado'
GROUP BY l.produto_id, p.etapa_id, p.subetapa_id, e.nome, s.nome, e.custo_por_hora;

-- Recriar view progresso_produtos_previsao
CREATE VIEW progresso_produtos_previsao AS
SELECT
  l.previsao_id,
  l.produto_id,
  pr.nome AS produto_nome,
  COUNT(DISTINCT l.id) AS num_lotes,
  SUM(l.quantidade_total) AS quantidade_total_lotes,
  COALESCE(SUM(p.quantidade_produzida), 0) AS quantidade_produzida,
  COALESCE(SUM(pct.tempo_produtivo_minutos), 0) / 60 AS horas_trabalhadas,
  CASE
    WHEN SUM(l.quantidade_total) > 0 THEN
      (COALESCE(SUM(p.quantidade_produzida), 0) * 100.0) / SUM(l.quantidade_total)
    ELSE 0
  END AS percentual_conclusao
FROM lotes l
JOIN produtos pr ON pr.id = l.produto_id
LEFT JOIN producoes p ON p.lote_id = l.id AND p.status = 'finalizado'
LEFT JOIN producoes_com_tempo pct ON pct.id = p.id
WHERE l.previsao_id IS NOT NULL
GROUP BY l.previsao_id, l.produto_id, pr.nome;