-- Add column to track if a lot was manually reopened
ALTER TABLE public.lotes 
ADD COLUMN IF NOT EXISTS manually_reopened BOOLEAN DEFAULT false;

-- Update the status verification function to respect the manual flag
CREATE OR REPLACE FUNCTION public.verificar_status_lote()
RETURNS trigger AS $$
DECLARE
  v_produto_id UUID;
  v_empresa_id UUID;
  v_tem_config BOOLEAN;
  v_total_required INTEGER;
  v_total_finished INTEGER;
  v_quantidade_total INTEGER;
  v_manually_reopened BOOLEAN;
  v_lote_finalizado BOOLEAN;
BEGIN
  -- Get Lot Info
  SELECT produto_id, empresa_id, quantidade_total, manually_reopened, finalizado
  INTO v_produto_id, v_empresa_id, v_quantidade_total, v_manually_reopened, v_lote_finalizado
  FROM lotes WHERE id = NEW.lote_id;

  -- IF Quantity is 0, un-finish it (unless it was already false, to avoid loops if needed, but safe here)
  IF v_quantidade_total <= 0 THEN
    -- Force un-finish if it was finished
    IF v_lote_finalizado THEN
        UPDATE lotes SET finalizado = false WHERE id = NEW.lote_id;
    END IF;
    RETURN NEW;
  END IF;
  
  -- IF Manually Reopened, DO NOT AUTO-FINISH
  -- We only allow auto-UNfinish if checking requirements, but here we just want to block auto-finish.
  -- Actually, the user wants "ele finaliza sozinho se lançar a quantidade correspodente, mas as reabrir ele só e finalizado se clicar no botão de finalizar"
  -- So if manually_reopened is true, we SKIP the "finalizado = true" update.
  -- We can still verify if it should be un-finished?? 
  -- The user said: "ele não finaliza sozinho" (it doesn't finish alone).
  
  -- Strategy: Calculate `v_should_be_finished`. 
  -- If `v_should_be_finished` is true AND `v_manually_reopened` is true -> DO NOTHING (keep it open).
  -- If `v_should_be_finished` is true AND `v_manually_reopened` is false -> UPDATE finalizado = true.
  -- If `v_should_be_finished` is false -> UPDATE finalizado = false (keep it open or reopen it).

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

  -- Check if it SHOULD be finished based on logic
  IF v_total_finished >= v_total_required AND v_total_required > 0 THEN
     -- It qualifies for finishing.
     -- ONLY finish if NOT manual_reopen
     IF NOT v_manually_reopened THEN
        UPDATE lotes SET finalizado = true WHERE id = NEW.lote_id AND finalizado = false;
     END IF;
     -- If manually_reopened is true, we do nothing (it stays open until user clicks button).
  ELSE
     -- It does NOT qualify for finishing (e.g. user removed a production).
     -- Allow un-finishing? Yes, usually.
     UPDATE lotes SET finalizado = false WHERE id = NEW.lote_id AND finalizado = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
