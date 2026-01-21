-- Adicionar campo para escolher o estilo de exibição do dashboard
ALTER TABLE configuracoes_empresa 
ADD COLUMN estilo_lista_dashboard TEXT DEFAULT 'lista_rolante'
CHECK (estilo_lista_dashboard IN ('lista_rolante', 'grid_cards'));

-- Comentário explicativo
COMMENT ON COLUMN configuracoes_empresa.estilo_lista_dashboard IS 
  'Estilo de exibição dos colaboradores restantes no dashboard: lista_rolante (vertical) ou grid_cards (horizontal)';