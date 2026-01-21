-- Function to Auto-Close Activities
CREATE OR REPLACE FUNCTION fechar_atividades_automaticamente()
RETURNS void AS $$
DECLARE
    r_empresa RECORD;
    v_escala_semanal JSONB;
    v_dia_semana TEXT;
    v_dia_config JSONB;
    v_saida_hoje TIME;
    v_data_atual DATE := CURRENT_DATE;
    v_hora_atual TIME := CURRENT_TIME;
BEGIN
    -- Loop through all companies (or only those with open productions)
    FOR r_empresa IN SELECT id, escala_semanal FROM empresas WHERE escala_semanal IS NOT NULL LOOP
        
        -- Determine day of week for Today
        CASE EXTRACT(ISODOW FROM v_data_atual)
            WHEN 1 THEN v_dia_semana := 'segunda';
            WHEN 2 THEN v_dia_semana := 'terca';
            WHEN 3 THEN v_dia_semana := 'quarta';
            WHEN 4 THEN v_dia_semana := 'quinta';
            WHEN 5 THEN v_dia_semana := 'sexta';
            WHEN 6 THEN v_dia_semana := 'sabado';
            WHEN 7 THEN v_dia_semana := 'domingo';
        END CASE;

        v_dia_config := r_empresa.escala_semanal -> v_dia_semana;

        -- If today is active and has a configured exit time
        IF v_dia_config IS NOT NULL AND (v_dia_config ->> 'ativo')::BOOLEAN IS TRUE AND (v_dia_config ->> 'saida') IS NOT NULL THEN
            
            v_saida_hoje := (v_dia_config ->> 'saida')::TIME;

            -- If current time is past the exit time (plus 30 minutes tolerance to avoid closing too early if cron drifts)
            -- Actually, simpler: If it's effectively past closing time.
            -- Let's say if we run this check, we look for anything that is open AND (current time > exit time).
            IF v_hora_atual > v_saida_hoje THEN
                
                -- Close active productions for this company
                UPDATE producoes
                SET 
                    data_fim = v_data_atual,
                    hora_fim = v_saida_hoje,
                    encerrado_automaticamente = TRUE
                WHERE 
                    empresa_id = r_empresa.id
                    AND data_fim IS NULL
                    AND data_inicio = v_data_atual; -- Only close today's activities. Older ones might need manual intervention or a more aggressive script.
                    
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
