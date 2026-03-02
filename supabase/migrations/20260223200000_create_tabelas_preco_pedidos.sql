-- Tabela de Preços
CREATE TABLE public.tabelas_preco (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT tabelas_preco_pkey PRIMARY KEY (id)
);

-- Itens da Tabela de Preços (vínculo Produto -> Preço)
CREATE TABLE public.tabelas_preco_itens (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tabela_preco_id UUID NOT NULL REFERENCES public.tabelas_preco(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    preco NUMERIC(15,2) NOT NULL DEFAULT 0,
    CONSTRAINT tabelas_preco_itens_pkey PRIMARY KEY (id),
    CONSTRAINT tabelas_preco_itens_unica UNIQUE (tabela_preco_id, produto_id)
);

-- Pedidos
CREATE TABLE public.pedidos (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES public.entidade(id),
    tabela_preco_id UUID NOT NULL REFERENCES public.tabelas_preco(id),
    tipo_venda TEXT NOT NULL DEFAULT 'VENDA',
    movimenta_estoque BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'orcamento', -- orcamento, faturado, cancelado
    observacao TEXT,
    data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT pedidos_pkey PRIMARY KEY (id)
);

-- Itens do Pedido
CREATE TABLE public.pedido_itens (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produtos(id),
    quantidade NUMERIC(15,3) NOT NULL DEFAULT 1,
    preco_unitario NUMERIC(15,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(15,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
    CONSTRAINT pedido_itens_pkey PRIMARY KEY (id)
);

-- RLS para tabelas_preco
ALTER TABLE public.tabelas_preco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users based on empresa_id" ON public.tabelas_preco FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- RLS para tabelas_preco_itens
ALTER TABLE public.tabelas_preco_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users based on tabelas_preco empresa_id" ON public.tabelas_preco_itens FOR ALL USING (
  tabela_preco_id IN (
    SELECT id FROM public.tabelas_preco WHERE empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  )
);

-- RLS para pedidos
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users based on empresa_id" ON public.pedidos FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
);

-- RLS para pedido_itens
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users based on pedidos empresa_id" ON public.pedido_itens FOR ALL USING (
  pedido_id IN (
    SELECT id FROM public.pedidos WHERE empresa_id IN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
  )
);
