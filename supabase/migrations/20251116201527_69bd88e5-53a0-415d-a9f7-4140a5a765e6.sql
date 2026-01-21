-- Criar função que atualiza automaticamente o tempo previsto quando um lote é criado/atualizado
CREATE OR REPLACE FUNCTION atualizar_tempo_previsto_previsao()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcular o tempo previsto da previsão baseado nas métricas + quantidades dos lotes
  UPDATE previsoes_producao
  SET horas_totais_previstas = calcular_tempo_previsto(COALESCE(NEW.previsao_id, OLD.previsao_id))
  WHERE id = COALESCE(NEW.previsao_id, OLD.previsao_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger que executa quando lote é criado/atualizado
DROP TRIGGER IF EXISTS trigger_atualizar_tempo_previsto ON lotes;
CREATE TRIGGER trigger_atualizar_tempo_previsto
AFTER INSERT OR UPDATE ON lotes
FOR EACH ROW
EXECUTE FUNCTION atualizar_tempo_previsto_previsao();

-- Recalcular todas as previsões existentes
UPDATE previsoes_producao
SET horas_totais_previstas = calcular_tempo_previsto(id)
WHERE id IN (SELECT DISTINCT previsao_id FROM lotes WHERE previsao_id IS NOT NULL);