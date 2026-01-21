-- Recriar a view produto_metricas com cálculo correto usando cast para numeric
DROP VIEW IF EXISTS produto_metricas CASCADE;

CREATE VIEW produto_metricas AS
SELECT 
  l.produto_id,
  p.etapa_id,
  p.subetapa_id,
  COUNT(DISTINCT l.id) AS num_lotes_analisados,
  SUM(pct.tempo_produtivo_minutos) AS tempo_total_minutos,
  SUM(p.quantidade_produzida) AS quantidade_total,
  -- CORREÇÃO: Cast para numeric antes da divisão para ter valores decimais
  AVG(pct.tempo_produtivo_minutos::numeric / NULLIF(p.quantidade_produzida, 0)) AS tempo_medio_por_peca_minutos,
  e.custo_por_hora,
  -- CORREÇÃO: Cast para numeric antes da divisão para custo correto
  AVG((pct.tempo_produtivo_minutos::numeric / NULLIF(p.quantidade_produzida, 0)) / 60 * e.custo_por_hora) AS custo_medio_por_peca,
  s.nome AS subetapa_nome,
  e.nome AS etapa_nome
FROM lotes l
JOIN producoes p ON p.lote_id = l.id
JOIN producoes_com_tempo pct ON pct.id = p.id
JOIN etapas e ON e.id = p.etapa_id
LEFT JOIN subetapas s ON s.id = p.subetapa_id
WHERE l.finalizado = true 
  AND p.status = 'finalizado'
GROUP BY l.produto_id, p.etapa_id, p.subetapa_id, e.nome, s.nome, e.custo_por_hora;