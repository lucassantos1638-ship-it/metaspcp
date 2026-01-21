CREATE OR REPLACE VIEW produto_metricas AS
WITH ultimos_lotes AS (
    SELECT id, produto_id, quantidade_total
    FROM (
        SELECT id, produto_id, quantidade_total,
               ROW_NUMBER() OVER (PARTITION BY produto_id ORDER BY created_at DESC) as rn
        FROM lotes
        WHERE finalizado = true
    ) sub
    WHERE rn <= 3
),
custos_producao AS (
    SELECT 
        p.lote_id,
        p.etapa_id,
        p.subetapa_id,
        -- Calculate Cost:
        -- If separated minutes exist (new records), use them with respective rates.
        -- If not (old records), use total duration * normal rate.
        CASE 
            WHEN p.minutos_normais IS NOT NULL THEN
                (
                    (p.minutos_normais / 60.0) * COALESCE(c.custo_por_hora, 0) +
                    (p.minutos_extras / 60.0) * COALESCE(c.custo_hora_extra, c.custo_por_hora, 0)
                )
            ELSE
                (EXTRACT(EPOCH FROM (p.hora_fim - p.hora_inicio)) / 3600.0) * COALESCE(c.custo_por_hora, 0)
        END as custo_total_entrada,
        
        -- Calculate Total Minutes:
        CASE
            WHEN p.minutos_normais IS NOT NULL THEN
                (p.minutos_normais + p.minutos_extras)
            ELSE
                (EXTRACT(EPOCH FROM (p.hora_fim - p.hora_inicio)) / 60.0)
        END as minutos_totais

    FROM producoes p
    LEFT JOIN colaboradores c ON p.colaborador_id = c.id
    WHERE p.data_fim IS NOT NULL -- Only finished productions
),
metricas_agregadas AS (
    SELECT
        ul.produto_id,
        cp.etapa_id,
        cp.subetapa_id,
        SUM(cp.minutos_totais) as soma_minutos,
        SUM(cp.custo_total_entrada) as soma_custo,
        SUM(ul.quantidade_total) as soma_qtd_lotes,
        COUNT(DISTINCT ul.id) as num_lotes
    FROM ultimos_lotes ul
    JOIN custos_producao cp ON cp.lote_id = ul.id
    GROUP BY ul.produto_id, cp.etapa_id, cp.subetapa_id
)
SELECT 
    pe.produto_id,
    pe.etapa_id,
    e.nome AS etapa_nome,
    pe.subetapa_id,
    s.nome AS subetapa_nome,
    -- Tempo Médio por Peça (Minutos)
    COALESCE(
        ROUND((ma.soma_minutos / NULLIF(ma.soma_qtd_lotes, 0))::numeric, 2),
        0
    ) AS tempo_medio_por_peca_minutos,
    -- Custo Médio por Peça (Moeda)
    COALESCE(
        ROUND((ma.soma_custo / NULLIF(ma.soma_qtd_lotes, 0))::numeric, 4),
        0
    ) AS custo_medio_por_peca,
    COALESCE(ma.num_lotes, 0) AS num_lotes_analisados
FROM produto_etapas pe
JOIN etapas e ON e.id = pe.etapa_id
LEFT JOIN subetapas s ON s.id = pe.subetapa_id
LEFT JOIN metricas_agregadas ma ON ma.produto_id = pe.produto_id 
                               AND ma.etapa_id = pe.etapa_id 
                               AND (ma.subetapa_id IS NOT DISTINCT FROM pe.subetapa_id);
