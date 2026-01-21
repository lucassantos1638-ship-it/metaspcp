-- Function to check if Lot should be finalized based on Product Stages
CREATE OR REPLACE FUNCTION public.verificar_status_lote()
RETURNS trigger AS $$
DECLARE
  v_produto_id UUID;
  v_empresa_id UUID;
  v_tem_config BOOLEAN;
  v_total_required INTEGER;
  v_total_finished INTEGER;
BEGIN
  -- Get Lot Info
  SELECT produto_id, empresa_id INTO v_produto_id, v_empresa_id
  FROM lotes WHERE id = NEW.lote_id;

  -- Check if Product has configuration
  SELECT EXISTS (SELECT 1 FROM produto_etapas WHERE produto_id = v_produto_id)
  INTO v_tem_config;

  IF v_tem_config THEN
    -- Count required stages (unique stages from configuration)
    SELECT count(DISTINCT etapa_id) INTO v_total_required
    FROM produto_etapas
    WHERE produto_id = v_produto_id;

    -- Count finished stages for this lot that match requirements
    -- We assume a stage is 'finished' if ANY production record for that stage is 'finalizado'
    -- OR if the sum of quantity produced meets the target?
    -- For now, relying on 'status = finalizado' which the user uses.
    SELECT count(DISTINCT p.etapa_id) INTO v_total_finished
    FROM producoes p
    WHERE p.lote_id = NEW.lote_id 
    AND p.status = 'finalizado'
    AND p.etapa_id IN (SELECT etapa_id FROM produto_etapas WHERE produto_id = v_produto_id);
    
  ELSE
    -- Legacy/Default: Count all stages of the company
    SELECT count(*) INTO v_total_required FROM etapas WHERE empresa_id = v_empresa_id;
    
    SELECT count(DISTINCT etapa_id) INTO v_total_finished
    FROM producoes
    WHERE lote_id = NEW.lote_id AND status = 'finalizado';
  END IF;

  -- Update Lot Status
  -- Only finalize if we have actually finished all required stages
  IF v_total_finished >= v_total_required AND v_total_required > 0 THEN
    UPDATE lotes SET finalizado = true WHERE id = NEW.lote_id;
  ELSE
    -- Optionally re-open if logic changes (e.g. stage added), but usually strictly -> true
    UPDATE lotes SET finalizado = false WHERE id = NEW.lote_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create Trigger on producoes table
DROP TRIGGER IF EXISTS trigger_verificar_status_lote ON producoes;
CREATE TRIGGER trigger_verificar_status_lote
AFTER INSERT OR UPDATE OF status ON producoes
FOR EACH ROW EXECUTE FUNCTION verificar_status_lote();
