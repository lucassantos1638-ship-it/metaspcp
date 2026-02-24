-- Recriar a view producoes_com_tempo para incluir os novos campos de terceirização
DROP VIEW IF EXISTS public.producoes_com_tempo;

CREATE OR REPLACE VIEW public.producoes_com_tempo AS
SELECT 
    p.id,
    p.colaborador_id,
    c.nome as colaborador_nome,
    c.custo_por_hora as colaborador_custo_hora,
    c.custo_hora_extra as colaborador_custo_extra,
    p.lote_id,
    p.etapa_id,
    p.subetapa_id,
    p.atividade_id,
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
    p.terceirizado,
    p.entidade_id,
    p.servico_id,
    p.quantidade_enviada,
    p.quantidade_devolvida,
    -- Old calculation for comparison or backward compat
    CASE
        WHEN p.status = 'em_aberto' THEN 
            ROUND((EXTRACT(EPOCH FROM (now() AT TIME ZONE 'America/Sao_Paulo' - (p.data_inicio + p.hora_inicio))) / (60)::NUMERIC))
        ELSE 
            public.calcular_tempo_produtivo(p.data_inicio, p.hora_inicio, COALESCE(p.segundos_inicio, 0), p.data_fim, p.hora_fim, COALESCE(p.segundos_fim, 0))
    END AS tempo_produtivo_minutos,
    -- Dynamic Normal/Extra Calculation
    CASE
        WHEN p.status = 'finalizado' THEN p.minutos_normais
        WHEN p.status = 'em_aberto' THEN 
            (public.calcular_escala_tempo(
                p.empresa_id, 
                (p.data_inicio + p.hora_inicio)::TIMESTAMP, 
                (now() AT TIME ZONE 'America/Sao_Paulo')::TIMESTAMP
            )->>'minutos_normais')::INTEGER
        ELSE 0
    END AS minutos_normais,
    CASE
        WHEN p.status = 'finalizado' THEN p.minutos_extras
        WHEN p.status = 'em_aberto' THEN 
            (public.calcular_escala_tempo(
                p.empresa_id, 
                (p.data_inicio + p.hora_inicio)::TIMESTAMP, 
                (now() AT TIME ZONE 'America/Sao_Paulo')::TIMESTAMP
            )->>'minutos_extras')::INTEGER
        ELSE 0
    END AS minutos_extras
FROM public.producoes p
LEFT JOIN public.colaboradores c ON c.id = p.colaborador_id;
