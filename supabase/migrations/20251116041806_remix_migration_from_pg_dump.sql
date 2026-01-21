--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: atualizar_progresso_previsao(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_progresso_previsao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_previsao_id UUID;
  v_tempo_total_minutos NUMERIC;
BEGIN
  -- Buscar a previsao_id do lote
  SELECT previsao_id INTO v_previsao_id
  FROM lotes
  WHERE id = COALESCE(NEW.lote_id, OLD.lote_id);
  
  -- Se o lote não está vinculado a nenhuma previsão, não fazer nada
  IF v_previsao_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calcular tempo total de todas as produções dos lotes vinculados a esta previsão
  SELECT COALESCE(SUM(pct.tempo_produtivo_minutos), 0) INTO v_tempo_total_minutos
  FROM producoes_com_tempo pct
  JOIN lotes l ON l.id = pct.lote_id
  WHERE l.previsao_id = v_previsao_id;
  
  -- Atualizar progresso_real_horas na previsão (convertendo minutos para horas)
  UPDATE previsoes_producao
  SET progresso_real_horas = v_tempo_total_minutos / 60
  WHERE id = v_previsao_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: calcular_tempo_produtivo(date, time without time zone, integer, date, time without time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calcular_tempo_produtivo(data_inicio date, hora_inicio time without time zone, segundos_inicio integer, data_fim date, hora_fim time without time zone, segundos_fim integer) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  dia DATE;
  hora_inicio_trabalho TIME := '07:00:00';
  hora_fim_manha TIME := '11:00:00';
  hora_inicio_tarde TIME := '12:00:00';
  hora_fim_trabalho TIME := '17:00:00';
  minutos_totais INTEGER := 0;
  inicio_efetivo TIMESTAMP;
  fim_efetivo TIMESTAMP;
  minutos_dia INTEGER;
  inicio_manha TIMESTAMP;
  fim_manha TIMESTAMP;
  inicio_tarde TIMESTAMP;
  fim_tarde TIMESTAMP;
BEGIN
  -- Adicionar segundos aos timestamps
  inicio_efetivo := (data_inicio + hora_inicio) + (segundos_inicio || ' seconds')::INTERVAL;
  fim_efetivo := (data_fim + hora_fim) + (segundos_fim || ' seconds')::INTERVAL;
  
  -- Loop pelos dias úteis (seg-sex)
  FOR dia IN SELECT generate_series(data_inicio, data_fim, '1 day'::interval)::DATE LOOP
    -- Pular fins de semana (0=domingo, 6=sábado)
    IF EXTRACT(DOW FROM dia) IN (0, 6) THEN
      CONTINUE;
    END IF;
    
    minutos_dia := 0;
    
    -- Período da manhã (7h-11h = 4 horas)
    inicio_manha := dia + hora_inicio_trabalho;
    fim_manha := dia + hora_fim_manha;
    
    -- Ajustar início da manhã
    IF dia = data_inicio AND inicio_efetivo > inicio_manha THEN
      inicio_manha := inicio_efetivo;
    END IF;
    
    -- Ajustar fim da manhã
    IF dia = data_fim AND fim_efetivo < fim_manha THEN
      fim_manha := fim_efetivo;
    END IF;
    
    -- Somar minutos da manhã se válido
    IF inicio_manha < fim_manha AND fim_manha <= (dia + hora_fim_manha) THEN
      minutos_dia := minutos_dia + EXTRACT(EPOCH FROM (fim_manha - inicio_manha))::INTEGER / 60;
    END IF;
    
    -- Período da tarde (12h-17h = 5 horas)
    inicio_tarde := dia + hora_inicio_tarde;
    fim_tarde := dia + hora_fim_trabalho;
    
    -- Ajustar início da tarde
    IF dia = data_inicio AND inicio_efetivo > inicio_tarde THEN
      inicio_tarde := inicio_efetivo;
    END IF;
    
    -- Ajustar fim da tarde
    IF dia = data_fim AND fim_efetivo < fim_tarde THEN
      fim_tarde := fim_efetivo;
    END IF;
    
    -- Somar minutos da tarde se válido
    IF inicio_tarde < fim_tarde AND fim_tarde <= (dia + hora_fim_trabalho) THEN
      minutos_dia := minutos_dia + EXTRACT(EPOCH FROM (fim_tarde - inicio_tarde))::INTEGER / 60;
    END IF;
    
    minutos_totais := minutos_totais + minutos_dia;
  END LOOP;
  
  RETURN minutos_totais;
END;
$$;


--
-- Name: gerar_sku(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerar_sku() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  ano_atual TEXT;
  proximo_numero INTEGER;
  novo_sku TEXT;
BEGIN
  ano_atual := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT COALESCE(
    MAX(
      CASE 
        WHEN sku ~ ('^PROD-' || ano_atual || '-[0-9]+$')
        THEN SUBSTRING(sku FROM '[0-9]+$')::INTEGER
        ELSE 0
      END
    ), 0
  ) + 1
  INTO proximo_numero
  FROM produtos;
  
  novo_sku := 'PROD-' || ano_atual || '-' || LPAD(proximo_numero::TEXT, 4, '0');
  
  RETURN novo_sku;
END;
$_$;


--
-- Name: verificar_finalizacao_lote(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verificar_finalizacao_lote() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  etapas_concluidas INTEGER;
  total_etapas INTEGER;
  quantidade_lote INTEGER;
BEGIN
  SELECT quantidade_total INTO quantidade_lote
  FROM lotes
  WHERE id = NEW.lote_id;
  
  SELECT COUNT(*) INTO total_etapas
  FROM etapas;
  
  SELECT COUNT(DISTINCT e.id) INTO etapas_concluidas
  FROM etapas e
  WHERE (
    SELECT COALESCE(SUM(p.quantidade_produzida), 0)
    FROM producoes p
    WHERE p.lote_id = NEW.lote_id AND p.etapa_id = e.id
  ) >= quantidade_lote;
  
  IF etapas_concluidas >= total_etapas THEN
    UPDATE lotes
    SET finalizado = true
    WHERE id = NEW.lote_id AND NOT finalizado;
  END IF;
  
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: colaboradores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colaboradores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    funcao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: etapas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etapas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    ordem integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    custo_por_hora numeric(10,2) DEFAULT 0.00
);


--
-- Name: producoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid NOT NULL,
    lote_id uuid NOT NULL,
    etapa_id uuid NOT NULL,
    subetapa_id uuid,
    quantidade_produzida integer NOT NULL,
    data_inicio date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    data_fim date NOT NULL,
    hora_fim time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    segundos_inicio integer DEFAULT 0,
    segundos_fim integer DEFAULT 0
);


--
-- Name: producoes_com_tempo; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.producoes_com_tempo AS
 SELECT id,
    colaborador_id,
    lote_id,
    etapa_id,
    subetapa_id,
    quantidade_produzida,
    data_inicio,
    hora_inicio,
    data_fim,
    hora_fim,
    created_at,
    segundos_inicio,
    segundos_fim,
    public.calcular_tempo_produtivo(data_inicio, hora_inicio, COALESCE(segundos_inicio, 0), data_fim, hora_fim, COALESCE(segundos_fim, 0)) AS tempo_produtivo_minutos
   FROM public.producoes p;


--
-- Name: subetapas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subetapas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    etapa_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    custo_por_hora numeric(10,2) DEFAULT 0.00
);


--
-- Name: colaborador_desempenho; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.colaborador_desempenho AS
 SELECT p.colaborador_id,
    c.nome AS colaborador_nome,
    p.etapa_id,
    e.nome AS etapa_nome,
    p.subetapa_id,
    s.nome AS subetapa_nome,
    avg((p.tempo_produtivo_minutos / NULLIF(p.quantidade_produzida, 0))) AS tempo_medio_por_peca_minutos,
    count(*) AS num_producoes,
    min(p.created_at) AS primeira_producao,
    max(p.created_at) AS ultima_producao
   FROM (((public.producoes_com_tempo p
     JOIN public.colaboradores c ON ((c.id = p.colaborador_id)))
     JOIN public.etapas e ON ((e.id = p.etapa_id)))
     LEFT JOIN public.subetapas s ON ((s.id = p.subetapa_id)))
  WHERE ((p.tempo_produtivo_minutos > 0) AND (p.quantidade_produzida > 0))
  GROUP BY p.colaborador_id, c.nome, p.etapa_id, e.nome, p.subetapa_id, s.nome;


--
-- Name: lotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_lote text NOT NULL,
    nome_lote text NOT NULL,
    quantidade_total integer NOT NULL,
    finalizado boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    produto_id uuid,
    previsao_id uuid
);


--
-- Name: metas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etapa_id uuid,
    subetapa_id uuid,
    meta integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT etapa_ou_subetapa CHECK ((((etapa_id IS NOT NULL) AND (subetapa_id IS NULL)) OR ((etapa_id IS NULL) AND (subetapa_id IS NOT NULL)))),
    CONSTRAINT metas_etapa_or_subetapa_check CHECK ((((etapa_id IS NOT NULL) AND (subetapa_id IS NULL)) OR ((etapa_id IS NULL) AND (subetapa_id IS NOT NULL))))
);


--
-- Name: previsao_ajustes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.previsao_ajustes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    previsao_id uuid NOT NULL,
    tipo_ajuste text NOT NULL,
    detalhes jsonb NOT NULL,
    impacto_horas numeric NOT NULL,
    data_ajuste timestamp with time zone DEFAULT now()
);


--
-- Name: previsao_imprevistos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.previsao_imprevistos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    previsao_id uuid NOT NULL,
    tipo text NOT NULL,
    descricao text NOT NULL,
    horas_perdidas numeric NOT NULL,
    data_ocorrencia date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: previsoes_producao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.previsoes_producao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome_pedido text NOT NULL,
    data_entrega_desejada date NOT NULL,
    data_previsao_conclusao date NOT NULL,
    horas_totais_previstas numeric NOT NULL,
    dias_uteis_previstos integer NOT NULL,
    precisa_hora_extra boolean NOT NULL,
    colaboradores_ids uuid[] NOT NULL,
    produtos_quantidades jsonb NOT NULL,
    detalhamento jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'em_andamento'::text,
    progresso_real_horas numeric DEFAULT 0,
    horas_ajustadas numeric DEFAULT 0,
    CONSTRAINT previsoes_producao_status_check CHECK ((status = ANY (ARRAY['em_andamento'::text, 'concluida'::text, 'cancelada'::text])))
);


--
-- Name: produto_etapas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produto_etapas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    produto_id uuid NOT NULL,
    etapa_id uuid NOT NULL,
    subetapa_id uuid,
    ordem integer NOT NULL,
    obrigatoria boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: produto_metricas; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.produto_metricas AS
 WITH ultimos_lotes AS (
         SELECT l.produto_id,
            l.id AS lote_id,
            l.quantidade_total,
            row_number() OVER (PARTITION BY l.produto_id ORDER BY l.created_at DESC) AS lote_rank
           FROM public.lotes l
          WHERE ((l.finalizado = true) AND (l.produto_id IS NOT NULL))
        ), producoes_ultimos_lotes AS (
         SELECT ul.produto_id,
            p.etapa_id,
            p.subetapa_id,
            sum(p.tempo_produtivo_minutos) AS tempo_total_minutos,
            sum(p.quantidade_produzida) AS quantidade_total,
            count(DISTINCT ul.lote_id) AS num_lotes_analisados
           FROM (ultimos_lotes ul
             JOIN public.producoes_com_tempo p ON ((p.lote_id = ul.lote_id)))
          WHERE (ul.lote_rank <= 3)
          GROUP BY ul.produto_id, p.etapa_id, p.subetapa_id
        )
 SELECT pul.produto_id,
    pul.etapa_id,
    pul.subetapa_id,
    e.nome AS etapa_nome,
    s.nome AS subetapa_nome,
    pul.num_lotes_analisados,
        CASE
            WHEN (pul.quantidade_total > 0) THEN ((pul.tempo_total_minutos)::numeric / (pul.quantidade_total)::numeric)
            ELSE (0)::numeric
        END AS tempo_medio_por_peca_minutos,
        CASE
            WHEN (pul.quantidade_total > 0) THEN ((((pul.tempo_total_minutos)::numeric / (60)::numeric) * COALESCE(s.custo_por_hora, e.custo_por_hora, (0)::numeric)) / (pul.quantidade_total)::numeric)
            ELSE (0)::numeric
        END AS custo_medio_por_peca,
    pul.tempo_total_minutos,
    pul.quantidade_total,
    COALESCE(s.custo_por_hora, e.custo_por_hora, (0)::numeric) AS custo_por_hora
   FROM ((producoes_ultimos_lotes pul
     LEFT JOIN public.etapas e ON ((e.id = pul.etapa_id)))
     LEFT JOIN public.subetapas s ON ((s.id = pul.subetapa_id)))
  ORDER BY pul.produto_id, e.ordem;


--
-- Name: produtos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produtos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    sku text NOT NULL,
    descricao text,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: progresso_produtos_previsao; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.progresso_produtos_previsao AS
 SELECT l.previsao_id,
    l.produto_id,
    p.nome AS produto_nome,
    sum(l.quantidade_total) AS quantidade_total_lotes,
    count(DISTINCT l.id) AS num_lotes,
    COALESCE(sum(prod.quantidade_produzida), (0)::bigint) AS quantidade_produzida,
    COALESCE((sum(pct.tempo_produtivo_minutos) / 60), (0)::bigint) AS horas_trabalhadas,
    round((((COALESCE(sum(prod.quantidade_produzida), (0)::bigint))::numeric / (NULLIF(sum(l.quantidade_total), 0))::numeric) * (100)::numeric), 2) AS percentual_conclusao
   FROM (((public.lotes l
     LEFT JOIN public.produtos p ON ((p.id = l.produto_id)))
     LEFT JOIN public.producoes prod ON ((prod.lote_id = l.id)))
     LEFT JOIN public.producoes_com_tempo pct ON ((pct.id = prod.id)))
  WHERE (l.previsao_id IS NOT NULL)
  GROUP BY l.previsao_id, l.produto_id, p.nome;


--
-- Name: colaboradores colaboradores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaboradores
    ADD CONSTRAINT colaboradores_pkey PRIMARY KEY (id);


--
-- Name: etapas etapas_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etapas
    ADD CONSTRAINT etapas_nome_key UNIQUE (nome);


--
-- Name: etapas etapas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etapas
    ADD CONSTRAINT etapas_pkey PRIMARY KEY (id);


--
-- Name: lotes lotes_numero_lote_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_numero_lote_key UNIQUE (numero_lote);


--
-- Name: lotes lotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_pkey PRIMARY KEY (id);


--
-- Name: metas metas_etapa_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas
    ADD CONSTRAINT metas_etapa_id_unique UNIQUE (etapa_id);


--
-- Name: metas metas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas
    ADD CONSTRAINT metas_pkey PRIMARY KEY (id);


--
-- Name: metas metas_subetapa_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas
    ADD CONSTRAINT metas_subetapa_id_unique UNIQUE (subetapa_id);


--
-- Name: previsao_ajustes previsao_ajustes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.previsao_ajustes
    ADD CONSTRAINT previsao_ajustes_pkey PRIMARY KEY (id);


--
-- Name: previsao_imprevistos previsao_imprevistos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.previsao_imprevistos
    ADD CONSTRAINT previsao_imprevistos_pkey PRIMARY KEY (id);


--
-- Name: previsoes_producao previsoes_producao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.previsoes_producao
    ADD CONSTRAINT previsoes_producao_pkey PRIMARY KEY (id);


--
-- Name: producoes producoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producoes
    ADD CONSTRAINT producoes_pkey PRIMARY KEY (id);


--
-- Name: produto_etapas produto_etapas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_etapas
    ADD CONSTRAINT produto_etapas_pkey PRIMARY KEY (id);


--
-- Name: produto_etapas produto_etapas_produto_id_etapa_id_subetapa_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_etapas
    ADD CONSTRAINT produto_etapas_produto_id_etapa_id_subetapa_id_key UNIQUE (produto_id, etapa_id, subetapa_id);


--
-- Name: produtos produtos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);


--
-- Name: produtos produtos_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_sku_key UNIQUE (sku);


--
-- Name: subetapas subetapas_nome_etapa_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subetapas
    ADD CONSTRAINT subetapas_nome_etapa_id_key UNIQUE (nome, etapa_id);


--
-- Name: subetapas subetapas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subetapas
    ADD CONSTRAINT subetapas_pkey PRIMARY KEY (id);


--
-- Name: idx_lotes_previsao_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lotes_previsao_id ON public.lotes USING btree (previsao_id);


--
-- Name: idx_lotes_produto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lotes_produto ON public.lotes USING btree (produto_id);


--
-- Name: idx_producoes_colaborador; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producoes_colaborador ON public.producoes USING btree (colaborador_id);


--
-- Name: idx_producoes_data_inicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producoes_data_inicio ON public.producoes USING btree (data_inicio);


--
-- Name: idx_producoes_etapa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producoes_etapa ON public.producoes USING btree (etapa_id);


--
-- Name: idx_producoes_lote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producoes_lote ON public.producoes USING btree (lote_id);


--
-- Name: idx_producoes_mes_ano; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producoes_mes_ano ON public.producoes USING btree (EXTRACT(month FROM data_inicio), EXTRACT(year FROM data_inicio));


--
-- Name: idx_producoes_subetapa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producoes_subetapa ON public.producoes USING btree (subetapa_id);


--
-- Name: idx_produto_etapas_produto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produto_etapas_produto ON public.produto_etapas USING btree (produto_id);


--
-- Name: idx_produtos_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_ativo ON public.produtos USING btree (ativo);


--
-- Name: idx_produtos_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_produtos_sku ON public.produtos USING btree (sku);


--
-- Name: idx_subetapas_etapa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subetapas_etapa ON public.subetapas USING btree (etapa_id);


--
-- Name: producoes trigger_atualizar_progresso_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_atualizar_progresso_delete AFTER DELETE ON public.producoes FOR EACH ROW EXECUTE FUNCTION public.atualizar_progresso_previsao();


--
-- Name: producoes trigger_atualizar_progresso_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_atualizar_progresso_insert AFTER INSERT ON public.producoes FOR EACH ROW EXECUTE FUNCTION public.atualizar_progresso_previsao();


--
-- Name: producoes trigger_atualizar_progresso_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_atualizar_progresso_update AFTER UPDATE ON public.producoes FOR EACH ROW EXECUTE FUNCTION public.atualizar_progresso_previsao();


--
-- Name: producoes trigger_verificar_finalizacao; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_verificar_finalizacao AFTER INSERT ON public.producoes FOR EACH ROW EXECUTE FUNCTION public.verificar_finalizacao_lote();


--
-- Name: lotes lotes_previsao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_previsao_id_fkey FOREIGN KEY (previsao_id) REFERENCES public.previsoes_producao(id) ON DELETE SET NULL;


--
-- Name: lotes lotes_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lotes
    ADD CONSTRAINT lotes_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE SET NULL;


--
-- Name: metas metas_etapa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas
    ADD CONSTRAINT metas_etapa_id_fkey FOREIGN KEY (etapa_id) REFERENCES public.etapas(id) ON DELETE CASCADE;


--
-- Name: metas metas_subetapa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metas
    ADD CONSTRAINT metas_subetapa_id_fkey FOREIGN KEY (subetapa_id) REFERENCES public.subetapas(id) ON DELETE CASCADE;


--
-- Name: previsao_ajustes previsao_ajustes_previsao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.previsao_ajustes
    ADD CONSTRAINT previsao_ajustes_previsao_id_fkey FOREIGN KEY (previsao_id) REFERENCES public.previsoes_producao(id) ON DELETE CASCADE;


--
-- Name: previsao_imprevistos previsao_imprevistos_previsao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.previsao_imprevistos
    ADD CONSTRAINT previsao_imprevistos_previsao_id_fkey FOREIGN KEY (previsao_id) REFERENCES public.previsoes_producao(id) ON DELETE CASCADE;


--
-- Name: producoes producoes_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producoes
    ADD CONSTRAINT producoes_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE CASCADE;


--
-- Name: producoes producoes_etapa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producoes
    ADD CONSTRAINT producoes_etapa_id_fkey FOREIGN KEY (etapa_id) REFERENCES public.etapas(id) ON DELETE CASCADE;


--
-- Name: producoes producoes_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producoes
    ADD CONSTRAINT producoes_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes(id) ON DELETE CASCADE;


--
-- Name: producoes producoes_subetapa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producoes
    ADD CONSTRAINT producoes_subetapa_id_fkey FOREIGN KEY (subetapa_id) REFERENCES public.subetapas(id) ON DELETE SET NULL;


--
-- Name: produto_etapas produto_etapas_etapa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_etapas
    ADD CONSTRAINT produto_etapas_etapa_id_fkey FOREIGN KEY (etapa_id) REFERENCES public.etapas(id) ON DELETE CASCADE;


--
-- Name: produto_etapas produto_etapas_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_etapas
    ADD CONSTRAINT produto_etapas_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE CASCADE;


--
-- Name: produto_etapas produto_etapas_subetapa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produto_etapas
    ADD CONSTRAINT produto_etapas_subetapa_id_fkey FOREIGN KEY (subetapa_id) REFERENCES public.subetapas(id) ON DELETE CASCADE;


--
-- Name: subetapas subetapas_etapa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subetapas
    ADD CONSTRAINT subetapas_etapa_id_fkey FOREIGN KEY (etapa_id) REFERENCES public.etapas(id) ON DELETE CASCADE;


--
-- Name: colaboradores Allow all operations on colaboradores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on colaboradores" ON public.colaboradores USING (true) WITH CHECK (true);


--
-- Name: etapas Allow all operations on etapas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on etapas" ON public.etapas USING (true) WITH CHECK (true);


--
-- Name: lotes Allow all operations on lotes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on lotes" ON public.lotes USING (true) WITH CHECK (true);


--
-- Name: metas Allow all operations on metas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on metas" ON public.metas USING (true) WITH CHECK (true);


--
-- Name: previsao_ajustes Allow all operations on previsao_ajustes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on previsao_ajustes" ON public.previsao_ajustes USING (true) WITH CHECK (true);


--
-- Name: previsao_imprevistos Allow all operations on previsao_imprevistos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on previsao_imprevistos" ON public.previsao_imprevistos USING (true) WITH CHECK (true);


--
-- Name: previsoes_producao Allow all operations on previsoes_producao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on previsoes_producao" ON public.previsoes_producao USING (true) WITH CHECK (true);


--
-- Name: producoes Allow all operations on producoes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on producoes" ON public.producoes USING (true) WITH CHECK (true);


--
-- Name: produto_etapas Allow all operations on produto_etapas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on produto_etapas" ON public.produto_etapas USING (true) WITH CHECK (true);


--
-- Name: produtos Allow all operations on produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on produtos" ON public.produtos USING (true) WITH CHECK (true);


--
-- Name: subetapas Allow all operations on subetapas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on subetapas" ON public.subetapas USING (true) WITH CHECK (true);


--
-- Name: colaboradores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

--
-- Name: etapas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.etapas ENABLE ROW LEVEL SECURITY;

--
-- Name: lotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;

--
-- Name: metas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

--
-- Name: previsao_ajustes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.previsao_ajustes ENABLE ROW LEVEL SECURITY;

--
-- Name: previsao_imprevistos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.previsao_imprevistos ENABLE ROW LEVEL SECURITY;

--
-- Name: previsoes_producao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.previsoes_producao ENABLE ROW LEVEL SECURITY;

--
-- Name: producoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.producoes ENABLE ROW LEVEL SECURITY;

--
-- Name: produto_etapas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.produto_etapas ENABLE ROW LEVEL SECURITY;

--
-- Name: produtos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

--
-- Name: subetapas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subetapas ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


