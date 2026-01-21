-- Add columns for overtime calculation
ALTER TABLE producoes
ADD COLUMN IF NOT EXISTS minutos_normais INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS minutos_extras INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS encerrado_automaticamente BOOLEAN DEFAULT FALSE;

-- Create or Replace Function to Calculate Overtime
CREATE OR REPLACE FUNCTION calcular_horas_extras()
RETURNS TRIGGER AS $$
DECLARE
    v_escala_semanal JSONB;
    v_dia_semana TEXT;
    v_dia_config JSONB;
    v_data_inicio TIMESTAMP;
    v_data_fim TIMESTAMP;
    v_entrada TIMESTAMP;
    v_saida_almoco TIMESTAMP;
    v_volta_almoco TIMESTAMP;
    v_saida TIMESTAMP;
    v_minutos_totais INTEGER;
    v_minutos_normais INTEGER := 0;
    v_minutos_extras INTEGER := 0;
    
    -- Helper to calculate intersection in minutes between [Start, End] and [RefStart, RefEnd]
    v_inter_start TIMESTAMP;
    v_inter_end TIMESTAMP;
BEGIN
    -- Only run if finished
    IF NEW.data_fim IS NULL OR NEW.hora_fim IS NULL OR NEW.data_inicio IS NULL OR NEW.hora_inicio IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get Company Schedule
    SELECT escala_semanal INTO v_escala_semanal
    FROM empresas
    WHERE id = NEW.empresa_id;

    -- If no schedule, everything is normal (or extra? assume normal if not configured to avoid scare)
    -- Actually user said: "if not scheduled, it is extra".
    -- But if config is empty, better be safe. Let's assume everything is normal if no config, 
    -- BUT if config exists and day is missing/inactive, then extra.
    IF v_escala_semanal IS NULL THEN
        -- No config, treat as normal hours? Or zero calculation?
        -- Let's calculate total minutes as normal for now to avoid creating infinite extras for unconfigured companies.
        v_data_inicio := (NEW.data_inicio || ' ' || NEW.hora_inicio)::TIMESTAMP;
        v_data_fim := (NEW.data_fim || ' ' || NEW.hora_fim)::TIMESTAMP;
        NEW.minutos_normais := EXTRACT(EPOCH FROM (v_data_fim - v_data_inicio)) / 60;
        NEW.minutos_extras := 0;
        RETURN NEW;
    END IF;

    -- Set timestamps
    v_data_inicio := (NEW.data_inicio || ' ' || NEW.hora_inicio)::TIMESTAMP;
    v_data_fim := (NEW.data_fim || ' ' || NEW.hora_fim)::TIMESTAMP;
    
    -- Calculate total duration
    v_minutos_totais := EXTRACT(EPOCH FROM (v_data_fim - v_data_inicio)) / 60;
    
    -- Determine day of week key (segunda, terca...)
    -- extract(isodow) 1=Monday, 7=Sunday
    CASE EXTRACT(ISODOW FROM NEW.data_inicio)
        WHEN 1 THEN v_dia_semana := 'segunda';
        WHEN 2 THEN v_dia_semana := 'terca';
        WHEN 3 THEN v_dia_semana := 'quarta';
        WHEN 4 THEN v_dia_semana := 'quinta';
        WHEN 5 THEN v_dia_semana := 'sexta';
        WHEN 6 THEN v_dia_semana := 'sabado';
        WHEN 7 THEN v_dia_semana := 'domingo';
    END CASE;

    v_dia_config := v_escala_semanal -> v_dia_semana;

    -- If day not found or inactive, ALL EXTRA
    IF v_dia_config IS NULL OR (v_dia_config ->> 'ativo')::BOOLEAN = FALSE THEN
        NEW.minutos_extras := v_minutos_totais;
        NEW.minutos_normais := 0;
        RETURN NEW;
    END IF;

    -- Calculate Normal Intersections
    -- Period 1: Entrada -> Saida Almoco (Check ativo_manha)
    IF (v_dia_config ->> 'ativo_manha')::BOOLEAN IS NOT FALSE THEN
        BEGIN
            v_entrada := (NEW.data_inicio || ' ' || (v_dia_config ->> 'entrada'))::TIMESTAMP;
            v_saida_almoco := (NEW.data_inicio || ' ' || (v_dia_config ->> 'saida_almoco'))::TIMESTAMP;
            
            -- Intersection
            v_inter_start := GREATEST(v_data_inicio, v_entrada);
            v_inter_end := LEAST(v_data_fim, v_saida_almoco);
            
            IF v_inter_end > v_inter_start THEN
                v_minutos_normais := v_minutos_normais + (EXTRACT(EPOCH FROM (v_inter_end - v_inter_start)) / 60);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore parsing errors, assume 0 normal minutes for this part
        END;
    END IF;

    -- Period 2: Volta Almoco -> Saida (Check ativo_tarde)
    IF (v_dia_config ->> 'ativo_tarde')::BOOLEAN IS NOT FALSE THEN
        BEGIN
            v_volta_almoco := (NEW.data_inicio || ' ' || (v_dia_config ->> 'volta_almoco'))::TIMESTAMP;
            v_saida := (NEW.data_inicio || ' ' || (v_dia_config ->> 'saida'))::TIMESTAMP;
            
            -- Intersection
            v_inter_start := GREATEST(v_data_inicio, v_volta_almoco);
            v_inter_end := LEAST(v_data_fim, v_saida);
            
            IF v_inter_end > v_inter_start THEN
                v_minutos_normais := v_minutos_normais + (EXTRACT(EPOCH FROM (v_inter_end - v_inter_start)) / 60);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore parsing errors
        END;
    END IF;

    -- Final Calculations
    -- Floating point adjust
    v_minutos_normais := FLOOR(v_minutos_normais);
    
    -- Constraint: Normal cannot exceed Total
    IF v_minutos_normais > v_minutos_totais THEN
        v_minutos_normais := v_minutos_totais;
    END IF;
    
    NEW.minutos_normais := v_minutos_normais;
    NEW.minutos_extras := GREATEST(0, v_minutos_totais - v_minutos_normais);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_calcular_horas_extras ON producoes;
CREATE TRIGGER trigger_calcular_horas_extras
BEFORE INSERT OR UPDATE OF data_fim, hora_fim
ON producoes
FOR EACH ROW
EXECUTE FUNCTION calcular_horas_extras();
