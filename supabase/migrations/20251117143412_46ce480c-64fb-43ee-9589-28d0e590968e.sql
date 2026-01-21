-- Adicionar campo para controlar velocidade do scroll no dashboard
ALTER TABLE configuracoes_empresa 
ADD COLUMN velocidade_scroll_dashboard INTEGER DEFAULT 40;