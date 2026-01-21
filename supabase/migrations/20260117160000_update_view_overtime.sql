CREATE OR REPLACE VIEW producoes_com_tempo AS
SELECT 
    p.id,
    p.colaborador_id,
    p.lote_id,
    p.etapa_id,
    p.subetapa_id,
    p.quantidade_produzida,
    p.data_inicio,
    p.hora_inicio,
    p.data_fim,
    p.hora_fim,
    p.created_at,
    p.segundos_inicio,
    p.segundos_fim,
    p.observacao,
    p.empresa_id,
    p.status,
    CASE
        WHEN p.status = 'em_aberto' THEN 
            ROUND(EXTRACT(EPOCH FROM (now() AT TIME ZONE 'America/Sao_Paulo' - (p.data_inicio + p.hora_inicio))) / 60)
        ELSE 
            calcular_tempo_produtivo(p.data_inicio, p.hora_inicio, COALESCE(p.segundos_inicio, 0), p.data_fim, p.hora_fim, COALESCE(p.segundos_fim, 0))
    END AS tempo_produtivo_minutos,
    p.minutos_normais,
    p.minutos_extras
FROM producoes p;
