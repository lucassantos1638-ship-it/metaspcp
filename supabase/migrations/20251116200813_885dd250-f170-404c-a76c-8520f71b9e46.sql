-- Função para calcular tempo previsto baseado nas métricas reais
CREATE OR REPLACE FUNCTION calcular_tempo_previsto(p_previsao_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_tempo_total_horas NUMERIC DEFAULT 0;
BEGIN
  -- Calcular tempo total baseado nas métricas dos produtos + quantidades dos lotes
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN pm.tempo_medio_por_peca_minutos IS NOT NULL AND pm.tempo_medio_por_peca_minutos > 0 THEN
          (l.quantidade_total * pm.tempo_medio_por_peca_minutos / 60.0)
        ELSE 0
      END
    ), 0)
  INTO v_tempo_total_horas
  FROM lotes l
  JOIN produto_etapas pe ON pe.produto_id = l.produto_id
  LEFT JOIN produto_metricas pm ON pm.produto_id = l.produto_id AND pm.etapa_id = pe.etapa_id
  WHERE l.previsao_id = p_previsao_id;
  
  RETURN v_tempo_total_horas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para atualizar progresso real automaticamente
CREATE OR REPLACE FUNCTION atualizar_progresso_real()
RETURNS TRIGGER AS $$
DECLARE
  v_previsao_id UUID;
BEGIN
  -- Buscar a previsao_id do lote
  SELECT previsao_id INTO v_previsao_id
  FROM lotes
  WHERE id = NEW.lote_id;
  
  -- Se o lote não está vinculado a nenhuma previsão, não fazer nada
  IF v_previsao_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Atualizar progresso_real_horas da previsão quando uma produção for finalizada
  UPDATE previsoes_producao
  SET progresso_real_horas = (
    SELECT COALESCE(SUM(pct.tempo_produtivo_minutos / 60.0), 0)
    FROM lotes l
    LEFT JOIN producoes_com_tempo pct ON pct.lote_id = l.id
    WHERE l.previsao_id = v_previsao_id
      AND pct.status = 'finalizado'
  )
  WHERE id = v_previsao_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para atualizar progresso
DROP TRIGGER IF EXISTS trigger_atualizar_progresso_real ON producoes;
CREATE TRIGGER trigger_atualizar_progresso_real
AFTER INSERT OR UPDATE ON producoes
FOR EACH ROW
WHEN (NEW.status = 'finalizado')
EXECUTE FUNCTION atualizar_progresso_real();

-- Habilitar realtime nas tabelas relevantes
ALTER PUBLICATION supabase_realtime ADD TABLE producoes;
ALTER PUBLICATION supabase_realtime ADD TABLE lotes;
ALTER PUBLICATION supabase_realtime ADD TABLE previsoes_producao;