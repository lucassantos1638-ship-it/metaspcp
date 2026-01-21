-- Atualizar o valor padrão da coluna para 120s (mais confortável)
ALTER TABLE configuracoes_empresa 
ALTER COLUMN velocidade_scroll_dashboard SET DEFAULT 120;

-- Atualizar registros existentes que ainda estão com 80s para 120s
UPDATE configuracoes_empresa 
SET velocidade_scroll_dashboard = 120 
WHERE velocidade_scroll_dashboard = 80;