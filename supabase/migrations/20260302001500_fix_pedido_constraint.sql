-- Relaxar a constraint `check_atividade_or_producao` para permitir Atividade de Pedido (pedido_id) sem etapa_id
ALTER TABLE public.producoes DROP CONSTRAINT IF EXISTS check_atividade_or_producao;

ALTER TABLE public.producoes ADD CONSTRAINT check_atividade_or_producao 
CHECK (
  (lote_id IS NOT NULL AND etapa_id IS NOT NULL) OR 
  (atividade_id IS NOT NULL) OR
  (pedido_id IS NOT NULL) OR
  (lote_id IS NOT NULL AND terceirizado = true AND entidade_id IS NOT NULL AND servico_id IS NOT NULL)
);
