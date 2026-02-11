-- Drop legacy trigger and function that causes premature finalization
DROP TRIGGER IF EXISTS trigger_verificar_finalizacao ON public.producoes;
DROP FUNCTION IF EXISTS public.verificar_finalizacao_lote();

-- Update the main status verification function to be stricter
CREATE OR REPLACE FUNCTION public.verificar_status_lote()
RETURNS trigger AS $$
DECLARE
  v_produto_id UUID;
  v_empresa_id UUID;
  v_tem_config BOOLEAN;
  v_total_required INTEGER;
  v_total_finished INTEGER;
  v_quantidade_total INTEGER;
BEGIN
  -- Get Lot Info
  SELECT produto_id, empresa_id, quantidade_total 
  INTO v_produto_id, v_empresa_id, v_quantidade_total
  FROM lotes WHERE id = NEW.lote_id;

  -- CRITICAL FIX: If quantity is 0, it cannot be finished.
  IF v_quantidade_total <= 0 THEN
    UPDATE lotes SET finalizado = false WHERE id = NEW.lote_id AND finalizado = true;
    RETURN NEW;
  END IF;

  -- Check if Product has configuration
  SELECT EXISTS (SELECT 1 FROM produto_etapas WHERE produto_id = v_produto_id)
  INTO v_tem_config;

  IF v_tem_config THEN
    -- Count required stages (unique stages from configuration)
    SELECT count(DISTINCT etapa_id) INTO v_total_required
    FROM produto_etapas
    WHERE produto_id = v_produto_id;

    -- Count finished stages for this lot that match requirements
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
  -- Only finalize if we have actually finished all required stages AND quantity is > 0 (checked above)
  IF v_total_finished >= v_total_required AND v_total_required > 0 THEN
    UPDATE lotes SET finalizado = true WHERE id = NEW.lote_id;
  ELSE
    UPDATE lotes SET finalizado = false WHERE id = NEW.lote_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
