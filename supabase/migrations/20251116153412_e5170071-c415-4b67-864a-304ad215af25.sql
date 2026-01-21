-- Inserir etapas básicas de produção
INSERT INTO public.etapas (nome, ordem, custo_por_hora) VALUES
  ('Corte', 1, 15.00),
  ('Costura', 2, 20.00),
  ('Acabamento', 3, 18.00),
  ('Embalagem', 4, 12.00)
ON CONFLICT DO NOTHING;

-- Inserir colaboradores de exemplo
INSERT INTO public.colaboradores (nome, funcao) VALUES
  ('João Silva', 'Cortador'),
  ('Maria Santos', 'Costureira'),
  ('Pedro Oliveira', 'Acabamento'),
  ('Ana Costa', 'Embalagem')
ON CONFLICT DO NOTHING;

-- Inserir um produto de exemplo
INSERT INTO public.produtos (nome, sku, descricao, ativo) VALUES
  ('Camisa Básica', 'CAM-001', 'Camisa básica de algodão', true)
ON CONFLICT DO NOTHING;