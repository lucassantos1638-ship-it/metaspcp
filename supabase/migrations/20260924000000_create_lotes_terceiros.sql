-- ==========================================
-- 1. DROP Tabela Antiga se existir
-- ==========================================
DROP TABLE IF EXISTS public.estoque_terceiros;

-- ==========================================
-- 2. Tabela de Lotes de Produção (Terceiros)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.lotes_terceiros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    codigo_lote TEXT NOT NULL,
    material_original_id UUID NOT NULL REFERENCES public.materiais(id),
    produto_atual_id UUID NOT NULL REFERENCES public.materiais(id),
    cor TEXT,
    quantidade_inicial NUMERIC(10,2) NOT NULL DEFAULT 0,
    unidade TEXT NOT NULL DEFAULT 'KG',
    entidade_fornecedor_id UUID REFERENCES public.entidade(id),
    data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    observacao TEXT,
    status TEXT NOT NULL DEFAULT 'ABERTO', -- ABERTO, EM_PRODUCAO, CONCLUIDO, CANCELADO
    usuario_criador_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Active RLS
ALTER TABLE public.lotes_terceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresas podem ver seus proprios lotes" 
    ON public.lotes_terceiros FOR SELECT 
    USING (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem inserir seus proprios lotes" 
    ON public.lotes_terceiros FOR INSERT 
    WITH CHECK (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem atualizar seus proprios lotes" 
    ON public.lotes_terceiros FOR UPDATE 
    USING (empresa_id = public.get_current_empresa_id())
    WITH CHECK (empresa_id = public.get_current_empresa_id());

CREATE TRIGGER handle_updated_at_lotes_terceiros
    BEFORE UPDATE ON public.lotes_terceiros
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==========================================
-- 3. Tabela de Movimentações de Estoque
-- ==========================================
CREATE TABLE IF NOT EXISTS public.movimentacoes_terceiros (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    lote_id UUID NOT NULL REFERENCES public.lotes_terceiros(id) ON DELETE CASCADE,
    tipo_movimentacao TEXT NOT NULL, -- ENTRADA, TRANSFERENCIA, RETORNO, PERDA, TRANSFORMACAO, ESTORNO
    entidade_origem_id UUID REFERENCES public.entidade(id),
    entidade_destino_id UUID REFERENCES public.entidade(id),
    material_origem_id UUID REFERENCES public.materiais(id),
    material_destino_id UUID REFERENCES public.materiais(id),
    cor TEXT,
    quantidade NUMERIC(10,2) NOT NULL,
    unidade TEXT NOT NULL DEFAULT 'KG',
    data_movimentacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    documento TEXT,
    observacao TEXT,
    movimentacao_estornada_id UUID REFERENCES public.movimentacoes_terceiros(id),
    usuario_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Active RLS
ALTER TABLE public.movimentacoes_terceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresas podem ver suas proprias movimentacoes" 
    ON public.movimentacoes_terceiros FOR SELECT 
    USING (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem inserir suas proprias movimentacoes" 
    ON public.movimentacoes_terceiros FOR INSERT 
    WITH CHECK (empresa_id = public.get_current_empresa_id());

CREATE POLICY "Empresas podem atualizar suas proprias movimentacoes" 
    ON public.movimentacoes_terceiros FOR UPDATE 
    USING (empresa_id = public.get_current_empresa_id())
    WITH CHECK (empresa_id = public.get_current_empresa_id());


-- ==========================================
-- 4. Função PL/pgSQL: get_saldo_terceiro
-- ==========================================
-- Retorna o saldo atual de um lote em uma entidade específica
CREATE OR REPLACE FUNCTION public.get_saldo_terceiro(
    p_lote_id UUID,
    p_entidade_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
    v_entradas NUMERIC;
    v_saidas NUMERIC;
    v_perdas NUMERIC;
BEGIN
    -- Soma das quantidades que ENTRARAM na entidade (ela foi destino) e que não foram estornadas
    SELECT COALESCE(SUM(quantidade), 0) INTO v_entradas
    FROM public.movimentacoes_terceiros
    WHERE lote_id = p_lote_id 
      AND entidade_destino_id = p_entidade_id
      AND tipo_movimentacao IN ('ENTRADA', 'TRANSFERENCIA')
      AND movimentacao_estornada_id IS NULL;

    -- Soma das quantidades que SAÍRAM da entidade (ela foi origem) e que não foram estornadas
    SELECT COALESCE(SUM(quantidade), 0) INTO v_saidas
    FROM public.movimentacoes_terceiros
    WHERE lote_id = p_lote_id 
      AND entidade_origem_id = p_entidade_id
      AND tipo_movimentacao IN ('TRANSFERENCIA', 'RETORNO')
      AND movimentacao_estornada_id IS NULL;
      
    -- Soma das perdas registradas na entidade (ela foi origem da perda)
    SELECT COALESCE(SUM(quantidade), 0) INTO v_perdas
    FROM public.movimentacoes_terceiros
    WHERE lote_id = p_lote_id 
      AND entidade_origem_id = p_entidade_id
      AND tipo_movimentacao = 'PERDA'
      AND movimentacao_estornada_id IS NULL;

    RETURN v_entradas - v_saidas - v_perdas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 5. Função PL/pgSQL: registrar_transferencia_terceiro (TRANSACTION)
-- ==========================================
-- Valida saldo antes de transferir
CREATE OR REPLACE FUNCTION public.registrar_transferencia_terceiro(
    p_empresa_id UUID,
    p_lote_id UUID,
    p_origem_id UUID,
    p_destino_id UUID,
    p_material_id UUID,
    p_cor TEXT,
    p_quantidade NUMERIC,
    p_observacao TEXT,
    p_usuario_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_saldo_atual NUMERIC;
    v_mov_id UUID;
BEGIN
    -- Verifica saldo
    v_saldo_atual := public.get_saldo_terceiro(p_lote_id, p_origem_id);
    
    IF v_saldo_atual < p_quantidade THEN
        RAISE EXCEPTION 'Saldo insuficiente (%.2f disponivel) para transferir %.2f', v_saldo_atual, p_quantidade;
    END IF;

    -- Insere movimentacao
    INSERT INTO public.movimentacoes_terceiros (
        empresa_id, lote_id, tipo_movimentacao, 
        entidade_origem_id, entidade_destino_id, 
        material_origem_id, material_destino_id, cor, 
        quantidade, observacao, usuario_id
    ) VALUES (
        p_empresa_id, p_lote_id, 'TRANSFERENCIA', 
        p_origem_id, p_destino_id, 
        p_material_id, p_material_id, p_cor, 
        p_quantidade, p_observacao, p_usuario_id
    ) RETURNING id INTO v_mov_id;
    
    RETURN json_build_object('success', true, 'movimentacao_id', v_mov_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 6. Fun��o PL/pgSQL: criar_lote_e_enviar (TRANSACTION)
-- ==========================================
CREATE OR REPLACE FUNCTION public.criar_lote_e_enviar(
    p_empresa_id UUID,
    p_codigo_lote TEXT,
    p_material_original_id UUID,
    p_produto_atual_id UUID,
    p_cor TEXT,
    p_quantidade_inicial NUMERIC,
    p_unidade TEXT,
    p_entidade_fornecedor_id UUID,
    p_data_inicio DATE,
    p_observacao TEXT,
    p_entidade_destino_id UUID,
    p_usuario_id UUID
)
RETURNS JSON AS $$$
DECLARE
    v_lote_id UUID;
    v_mov_id UUID;
BEGIN
    -- Cria o lote
    INSERT INTO public.lotes_terceiros (
        empresa_id, codigo_lote, material_original_id, produto_atual_id, 
        cor, quantidade_inicial, unidade, entidade_fornecedor_id, 
        data_inicio, observacao, status, usuario_criador_id
    ) VALUES (
        p_empresa_id, p_codigo_lote, p_material_original_id, p_produto_atual_id, 
        p_cor, p_quantidade_inicial, p_unidade, p_entidade_fornecedor_id, 
        p_data_inicio, p_observacao, 'EM_PRODUCAO', p_usuario_id
    ) RETURNING id INTO v_lote_id;

    -- Se tem destino, ja cria a entrada nele
    IF p_entidade_destino_id IS NOT NULL THEN
        INSERT INTO public.movimentacoes_terceiros (
            empresa_id, lote_id, tipo_movimentacao, 
            entidade_origem_id, entidade_destino_id, 
            material_origem_id, material_destino_id, cor, 
            quantidade, unidade, observacao, usuario_id
        ) VALUES (
            p_empresa_id, v_lote_id, 'ENTRADA', 
            p_entidade_fornecedor_id, p_entidade_destino_id, 
            p_material_original_id, p_produto_atual_id, p_cor, 
            p_quantidade_inicial, p_unidade, 'Envio inicial', p_usuario_id
        ) RETURNING id INTO v_mov_id;
    END IF;
    
    RETURN json_build_object('success', true, 'lote_id', v_lote_id);
END;
$$$ LANGUAGE plpgsql SECURITY DEFINER;

