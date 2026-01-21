-- Create table for production forecast (headers)
create table if not exists pedidos_previsao (
  id uuid default gen_random_uuid() primary key,
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_nome text not null,
  data_entrega_desejada date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create table for forecast items (products)
create table if not exists pedidos_previsao_itens (
  id uuid default gen_random_uuid() primary key,
  pedido_previsao_id uuid not null references pedidos_previsao(id) on delete cascade,
  produto_id uuid not null references productos(id) on delete cascade,
  quantidade integer not null check (quantidade > 0),
  tempo_unitario_minutos numeric not null default 0, -- Snapshot of unit time at creation
  created_at timestamptz default now()
);

-- Enable RLS
alter table pedidos_previsao enable row level security;
alter table pedidos_previsao_itens enable row level security;

-- Policies for pedidos_previsao
create policy "Users can view forecasts from their company"
  on pedidos_previsao for select
  using (empresa_id = (select empresa_id from usuarios where id = auth.uid()));

create policy "Users can insert forecasts for their company"
  on pedidos_previsao for insert
  with check (empresa_id = (select empresa_id from usuarios where id = auth.uid()));

create policy "Users can update forecasts from their company"
  on pedidos_previsao for update
  using (empresa_id = (select empresa_id from usuarios where id = auth.uid()));

create policy "Users can delete forecasts from their company"
  on pedidos_previsao for delete
  using (empresa_id = (select empresa_id from usuarios where id = auth.uid()));

-- Policies for pedidos_previsao_itens
create policy "Users can view forecast items from their company"
  on pedidos_previsao_itens for select
  using (
    exists (
      select 1 from pedidos_previsao
      where pedidos_previsao.id = pedidos_previsao_itens.pedido_previsao_id
      and pedidos_previsao.empresa_id = (select empresa_id from usuarios where id = auth.uid())
    )
  );

create policy "Users can insert forecast items for their company"
  on pedidos_previsao_itens for insert
  with check (
    exists (
      select 1 from pedidos_previsao
      where pedidos_previsao.id = pedidos_previsao_itens.pedido_previsao_id
      and pedidos_previsao.empresa_id = (select empresa_id from usuarios where id = auth.uid())
    )
  );

create policy "Users can delete forecast items from their company"
  on pedidos_previsao_itens for delete
  using (
    exists (
      select 1 from pedidos_previsao
      where pedidos_previsao.id = pedidos_previsao_itens.pedido_previsao_id
      and pedidos_previsao.empresa_id = (select empresa_id from usuarios where id = auth.uid())
    )
  );
