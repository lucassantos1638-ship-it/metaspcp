-- 1. Create scalar function for time calculation
CREATE OR REPLACE FUNCTION calcular_escala_tempo(
    p_empresa_id UUID,
    p_inicio TIMESTAMP,
    p_fim TIMESTAMP
) RETURNS JSONB AS $$
DECLARE
    v_escala_semanal JSONB;
    v_dia_semana TEXT;
    v_dia_config JSONB;
    v_entrada TIMESTAMP;
    v_saida_almoco TIMESTAMP;
    v_volta_almoco TIMESTAMP;
    v_saida TIMESTAMP;
    v_minutos_totais INTEGER := 0;
    v_minutos_normais INTEGER := 0;
    v_minutos_extras INTEGER := 0;
    
    v_inicio_base DATE;
    v_inter_start TIMESTAMP;
    v_inter_end TIMESTAMP;
BEGIN
    -- Validation
    IF p_inicio IS NULL OR p_fim IS NULL OR p_fim <= p_inicio THEN
        RETURN jsonb_build_object(
            'minutos_normais', 0,
            'minutos_extras', 0,
            'minutos_totais', 0
        );
    END IF;

    -- Calculate Totals (Wall Clock)
    v_minutos_totais := ROUND(EXTRACT(EPOCH FROM (p_fim - p_inicio)) / 60.0);

    -- Get Company Schedule
    SELECT escala_semanal INTO v_escala_semanal
    FROM empresas
    WHERE id = p_empresa_id;

    -- If no schedule, treat everything as normal
    IF v_escala_semanal IS NULL THEN
        RETURN jsonb_build_object(
            'minutos_normais', v_minutos_totais,
            'minutos_extras', 0,
            'minutos_totais', v_minutos_totais
        );
    END IF;

    -- Get Day of Week (based on start date)
    v_dia_semana := TRIM(LOWER(TO_CHAR(p_inicio, 'day')));
    v_dia_config := v_escala_semanal -> v_dia_semana;

    -- If day not configured or inactive, all time is EXTRA
    IF v_dia_config IS NULL OR (v_dia_config ->> 'ativo')::BOOLEAN IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'minutos_normais', 0,
            'minutos_extras', v_minutos_totais,
            'minutos_totais', v_minutos_totais
        );
    END IF;

    v_inicio_base := p_inicio::DATE;

    -- Period 1: Entrada -> Saida Almoco
    IF (v_dia_config ->> 'ativo_manha')::BOOLEAN IS NOT FALSE THEN
        BEGIN
            v_entrada := (v_inicio_base || ' ' || (v_dia_config ->> 'entrada'))::TIMESTAMP;
            v_saida_almoco := (v_inicio_base || ' ' || (v_dia_config ->> 'saida_almoco'))::TIMESTAMP;
            
            -- Intersection
            v_inter_start := GREATEST(p_inicio, v_entrada);
            v_inter_end := LEAST(p_fim, v_saida_almoco);
            
            IF v_inter_end > v_inter_start THEN
                v_minutos_normais := v_minutos_normais + ROUND(EXTRACT(EPOCH FROM (v_inter_end - v_inter_start)) / 60.0);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Ignore parsing errors
        END;
    END IF;

    -- Period 2: Volta Almoco -> Saida
    IF (v_dia_config ->> 'ativo_tarde')::BOOLEAN IS NOT FALSE THEN
        BEGIN
            v_volta_almoco := (v_inicio_base || ' ' || (v_dia_config ->> 'volta_almoco'))::TIMESTAMP;
            v_saida := (v_inicio_base || ' ' || (v_dia_config ->> 'saida'))::TIMESTAMP;
            
            -- Intersection
            v_inter_start := GREATEST(p_inicio, v_volta_almoco);
            v_inter_end := LEAST(p_fim, v_saida);
            
            IF v_inter_end > v_inter_start THEN
                v_minutos_normais := v_minutos_normais + ROUND(EXTRACT(EPOCH FROM (v_inter_end - v_inter_start)) / 60.0);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    -- Constraints
    IF v_minutos_normais > v_minutos_totais THEN
        v_minutos_normais := v_minutos_totais;
    END IF;
    
    v_minutos_extras := GREATEST(0, v_minutos_totais - v_minutos_normais);

    RETURN jsonb_build_object(
        'minutos_normais', v_minutos_normais,
        'minutos_extras', v_minutos_extras,
        'minutos_totais', v_minutos_totais
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Update View to use dynamic calculation
DROP VIEW IF EXISTS producoes_com_tempo;

CREATE OR REPLACE VIEW producoes_com_tempo AS
SELECT 
    p.id,
    p.colaborador_id,
    c.nome as colaborador_nome,
    c.custo_por_hora as colaborador_custo_hora,
    c.custo_hora_extra as colaborador_custo_extra,
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
    -- Old calculation for comparison or backward compat
    CASE
        WHEN status = 'em_aberto' THEN 
            ROUND((EXTRACT(EPOCH FROM (now() AT TIME ZONE 'America/Sao_Paulo' - (p.data_inicio + p.hora_inicio))) / (60)::NUMERIC))
        ELSE 
            calcular_tempo_produtivo(p.data_inicio, p.hora_inicio, COALESCE(p.segundos_inicio, 0), p.data_fim, p.hora_fim, COALESCE(p.segundos_fim, 0))
    END AS tempo_produtivo_minutos,
    -- Dynamic Normal/Extra Calculation
    CASE
        WHEN status = 'finalizado' THEN p.minutos_normais
        WHEN status = 'em_aberto' THEN 
            (calcular_escala_tempo(
                p.empresa_id, 
                (p.data_inicio + p.hora_inicio)::TIMESTAMP, 
                (now() AT TIME ZONE 'America/Sao_Paulo')::TIMESTAMP
            )->>'minutos_normais')::INTEGER
        ELSE 0
    END AS minutos_normais,
    CASE
        WHEN status = 'finalizado' THEN p.minutos_extras
        WHEN status = 'em_aberto' THEN 
            (calcular_escala_tempo(
                p.empresa_id, 
                (p.data_inicio + p.hora_inicio)::TIMESTAMP, 
                (now() AT TIME ZONE 'America/Sao_Paulo')::TIMESTAMP
            )->>'minutos_extras')::INTEGER
        ELSE 0
    END AS minutos_extras
FROM producoes p
LEFT JOIN colaboradores c ON c.id = p.colaborador_id;
