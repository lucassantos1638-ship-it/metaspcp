-- Migration to fix realtime overtime calculation
-- Mapeia corretamente os dias da semana para as chaves em PORTUGUÊS usadas no JSON

CREATE OR REPLACE FUNCTION calcular_escala_tempo(
    p_empresa_id UUID,
    p_inicio TIMESTAMP,
    p_fim TIMESTAMP
) RETURNS JSONB AS $$
DECLARE
    v_escala_semanal JSONB;
    v_dow INTEGER;
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

    -- Get Day of Week Index (0 = Domingo, 6 = Sabado)
    v_dow := EXTRACT(DOW FROM p_inicio);
    
    -- Mapear índice para chaves em PORTUGUÊS (como salvo no banco)
    CASE v_dow
        WHEN 0 THEN v_dia_semana := 'domingo';
        WHEN 1 THEN v_dia_semana := 'segunda';
        WHEN 2 THEN v_dia_semana := 'terca';
        WHEN 3 THEN v_dia_semana := 'quarta';
        WHEN 4 THEN v_dia_semana := 'quinta';
        WHEN 5 THEN v_dia_semana := 'sexta';
        WHEN 6 THEN v_dia_semana := 'sabado';
        ELSE v_dia_semana := NULL;
    END CASE;

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
