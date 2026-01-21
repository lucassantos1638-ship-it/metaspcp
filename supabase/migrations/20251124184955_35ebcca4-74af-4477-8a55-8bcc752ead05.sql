-- Adicionar enum para status de assinatura
CREATE TYPE public.status_assinatura AS ENUM ('trial', 'ativa', 'cancelada', 'vencida');

-- Adicionar novos campos na tabela empresas
ALTER TABLE public.empresas
ADD COLUMN cpf TEXT,
ADD COLUMN status_assinatura status_assinatura DEFAULT 'ativa',
ADD COLUMN data_inicio_trial DATE,
ADD COLUMN data_fim_trial DATE,
ADD COLUMN forma_pagamento TEXT,
ADD COLUMN subscription_id TEXT;

-- Atualizar empresas existentes para status 'ativa' (já estão usando o sistema)
UPDATE public.empresas 
SET status_assinatura = 'ativa'
WHERE status_assinatura IS NULL;

-- Criar índices para melhorar performance
CREATE INDEX idx_empresas_status ON public.empresas(status_assinatura);
CREATE INDEX idx_empresas_trial ON public.empresas(data_fim_trial) WHERE status_assinatura = 'trial';

-- Adicionar unique constraint para CPF (apenas se preenchido)
CREATE UNIQUE INDEX idx_empresas_cpf_unique ON public.empresas(cpf) WHERE cpf IS NOT NULL;

-- Atualizar RLS policy para permitir inserção pública durante registro
CREATE POLICY "Empresas podem se auto-cadastrar"
ON public.empresas
FOR INSERT
TO anon
WITH CHECK (true);

-- Permitir que anon leia empresas durante registro (apenas para validação)
CREATE POLICY "Anon pode validar empresas no registro"
ON public.empresas
FOR SELECT
TO anon
USING (true);

-- Permitir que anon atualize empresas durante checkout
CREATE POLICY "Anon pode atualizar no checkout"
ON public.empresas
FOR UPDATE
TO anon
USING (true);