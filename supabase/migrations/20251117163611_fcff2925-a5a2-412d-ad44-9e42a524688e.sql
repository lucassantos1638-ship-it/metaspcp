-- Atualizar o valor padrão da coluna velocidade_scroll_dashboard
ALTER TABLE configuracoes_empresa 
ALTER COLUMN velocidade_scroll_dashboard SET DEFAULT 80;

-- Atualizar registros existentes que ainda estão com 40 para o novo padrão
UPDATE configuracoes_empresa 
SET velocidade_scroll_dashboard = 80 
WHERE velocidade_scroll_dashboard = 40;