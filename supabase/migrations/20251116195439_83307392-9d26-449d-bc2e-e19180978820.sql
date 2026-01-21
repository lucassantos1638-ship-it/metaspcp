-- Criar view para progresso detalhado por produto e etapa
CREATE OR REPLACE VIEW progresso_produtos_etapas AS
SELECT 
  l.previsao_id,
  l.produto_id,
  pr.nome AS produto_nome,
  p.etapa_id,
  e.nome AS etapa_nome,
  e.ordem AS etapa_ordem,
  -- Quantidade total do lote (não muda por etapa)
  SUM(l.quantidade_total) AS quantidade_total_lotes,
  -- Quantidade produzida nesta etapa específica (limitada ao total do lote)
  LEAST(
    COALESCE(SUM(CASE WHEN p.status = 'finalizado' THEN p.quantidade_produzida ELSE 0 END), 0),
    SUM(l.quantidade_total)
  ) AS quantidade_produzida_etapa,
  -- Percentual desta etapa
  CASE
    WHEN SUM(l.quantidade_total) > 0 THEN 
      (LEAST(
        COALESCE(SUM(CASE WHEN p.status = 'finalizado' THEN p.quantidade_produzida ELSE 0 END), 0),
        SUM(l.quantidade_total)
      )::numeric * 100.0 / SUM(l.quantidade_total)::numeric)
    ELSE 0
  END AS percentual_etapa,
  -- Tempo trabalhado nesta etapa
  COALESCE(SUM(pct.tempo_produtivo_minutos), 0) / 60.0 AS horas_trabalhadas_etapa
FROM lotes l
JOIN produtos pr ON pr.id = l.produto_id
LEFT JOIN producoes p ON p.lote_id = l.id
LEFT JOIN etapas e ON e.id = p.etapa_id
LEFT JOIN producoes_com_tempo pct ON pct.id = p.id
WHERE l.previsao_id IS NOT NULL
GROUP BY l.previsao_id, l.produto_id, pr.nome, p.etapa_id, e.nome, e.ordem;

-- Criar view resumida com percentual geral por produto
CREATE OR REPLACE VIEW progresso_produtos_resumo AS
SELECT 
  previsao_id,
  produto_id,
  produto_nome,
  quantidade_total_lotes,
  -- Percentual geral = MÉDIA dos percentuais de todas as etapas
  ROUND(AVG(percentual_etapa), 1) AS percentual_geral,
  -- Soma das horas de todas as etapas
  SUM(horas_trabalhadas_etapa) AS horas_trabalhadas_total,
  -- Contagem de etapas
  COUNT(*) AS num_etapas
FROM progresso_produtos_etapas
GROUP BY previsao_id, produto_id, produto_nome, quantidade_total_lotes;