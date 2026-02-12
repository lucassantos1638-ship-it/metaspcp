-- Consolidated Fix for Meta PCP
-- 1. Ensures 'manually_reopened' column exists
-- 2. Removes ALL triggers from 'lotes' to fix reopening crashes
-- 3. Updates 'verificar_status_lote' with strict sub-stage quantity logic
-- 4. Re-applies the trigger on 'producoes'

-- STEP 1: Ensure Column Exists
ALTER TABLE public.lotes 
ADD COLUMN IF NOT EXISTS manually_reopened BOOLEAN DEFAULT false;

-- STEP 2: Drop ALL Triggers on 'lotes' (Nuclear Option to fix crash)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'lotes' 
        AND trigger_schema = 'public'
    ) LOOP
        RAISE NOTICE 'Dropping trigger on lotes: %', r.trigger_name;
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.lotes';
    END LOOP;
END $$;

-- STEP 3: Strict Function Logic (Sub-stage Aware)
CREATE OR REPLACE FUNCTION public.verificar_status_lote()
RETURNS trigger AS $$
DECLARE
  v_produto_id UUID;
  v_empresa_id UUID;
  v_tem_config BOOLEAN;
  v_quantidade_lote INTEGER;
  v_manually_reopened BOOLEAN;
  v_lote_finalizado BOOLEAN;
  v_stage_pending BOOLEAN := false;
BEGIN
  -- Get Lot Info from the LOT ID associated with the production
  -- NEW.lote_id comes from PRODUCOES table
  SELECT produto_id, empresa_id, quantidade_total, manually_reopened, finalizado
  INTO v_produto_id, v_empresa_id, v_quantidade_lote, v_manually_reopened, v_lote_finalizado
  FROM lotes WHERE id = NEW.lote_id;

  -- Safety Check: If Lot Qty <= 0, we can't auto-close properly.
  IF COALESCE(v_quantidade_lote, 0) <= 0 THEN
    -- If it was somehow finished, unfinish it? Or just leave it.
    -- Let's unfinish to be safe if it's currently marked finished.
    IF v_lote_finalizado THEN
        UPDATE lotes SET finalizado = false WHERE id = NEW.lote_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Determine Configuration Presence
  SELECT EXISTS (SELECT 1 FROM produto_etapas WHERE produto_id = v_produto_id)
  INTO v_tem_config;

  IF v_tem_config THEN
    -- STRICT CHECK: Loop through ALL configured (Etapa+Subetapa) items for this product.
    -- If ANY item has (Total Produced < Lot Quantity), then v_stage_pending = TRUE.
    
    SELECT EXISTS (
      SELECT 1
      FROM produto_etapas pe
      -- Join with productions for this specific lot, matching Etapa AND Subetapa
      LEFT JOIN (
        SELECT etapa_id, subetapa_id, SUM(quantidade_produzida) as total_prod
        FROM producoes
        WHERE lote_id = NEW.lote_id AND status = 'finalizado'
        GROUP BY etapa_id, subetapa_id
      ) p ON p.etapa_id = pe.etapa_id 
         AND (p.subetapa_id IS NOT DISTINCT FROM pe.subetapa_id)
      
      WHERE pe.produto_id = v_produto_id
      -- The condition for "Pending":
      -- If required (implicit) and produced quantity is less than lot quantity
      AND (COALESCE(p.total_prod, 0) < v_quantidade_lote)
    ) INTO v_stage_pending;
    
  ELSE
    -- Legacy Mode (No Product Config): Check Company Stages
    SELECT EXISTS (
      SELECT 1
      FROM etapas e
      LEFT JOIN (
        SELECT etapa_id, SUM(quantidade_produzida) as total_prod
        FROM producoes
        WHERE lote_id = NEW.lote_id AND status = 'finalizado'
        GROUP BY etapa_id
      ) p ON p.etapa_id = e.id
      WHERE e.empresa_id = v_empresa_id
      AND (COALESCE(p.total_prod, 0) < v_quantidade_lote)
    ) INTO v_stage_pending;
  END IF;

  -- STEP 4: Update Lot Status based on findings
  IF v_stage_pending THEN
    -- If we found ANY pending stage, the lot MUST be Open.
    IF v_lote_finalizado THEN
       UPDATE lotes SET finalizado = false WHERE id = NEW.lote_id;
    END IF;
  ELSE
    -- No pending stages found. All requirements met.
    -- Proceed to Finalize ONLY if NOT manually reopened.
    IF NOT COALESCE(v_manually_reopened, false) THEN
        IF NOT v_lote_finalizado THEN
            UPDATE lotes SET finalizado = true WHERE id = NEW.lote_id;
        END IF;
    END IF;
    -- If manually_reopened is true, we leave it alone (Open).
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 5: Re-Attach Trigger to Producoes
DROP TRIGGER IF EXISTS trigger_verificar_status_lote ON public.producoes;
DROP TRIGGER IF EXISTS trigger_verificar_finalizacao ON public.producoes; -- Drop legacy name too just in case

CREATE TRIGGER trigger_verificar_status_lote
AFTER INSERT OR UPDATE OR DELETE ON public.producoes
FOR EACH ROW EXECUTE FUNCTION public.verificar_status_lote();
