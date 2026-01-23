-- Create vendas_perdidas table
create table public.vendas_perdidas (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  cliente_nome text not null,
  data_referencia timestamp with time zone not null,
  usuario_id uuid not null default auth.uid (),
  usuario_nome text null,
  tabela_preco text not null default 'cpf'::text,
  constraint vendas_perdidas_pkey primary key (id),
  constraint vendas_perdidas_usuario_id_fkey foreign key (usuario_id) references auth.users (id)
) tablespace pg_default;

-- Create vendas_perdidas_itens table
create table public.vendas_perdidas_itens (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  venda_perdida_id uuid not null,
  produto_id uuid not null,
  quantidade numeric not null,
  valor_unitario numeric not null,
  constraint vendas_perdidas_itens_pkey primary key (id),
  constraint vendas_perdidas_itens_venda_perdida_id_fkey foreign key (venda_perdida_id) references vendas_perdidas (id) on delete cascade,
  constraint vendas_perdidas_itens_produto_id_fkey foreign key (produto_id) references produtos (id)
) tablespace pg_default;

-- Enable RLS
alter table public.vendas_perdidas enable row level security;
alter table public.vendas_perdidas_itens enable row level security;

-- Policies for vendas_perdidas
create policy "Enable all access for authenticated users" on public.vendas_perdidas
  as permissive for all
  to authenticated
  using (true)
  with check (true);

-- Policies for vendas_perdidas_itens
create policy "Enable all access for authenticated users" on public.vendas_perdidas_itens
  as permissive for all
  to authenticated
  using (true)
  with check (true);
