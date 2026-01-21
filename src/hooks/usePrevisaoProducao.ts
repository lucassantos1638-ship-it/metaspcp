import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { contarDiasUteis, adicionarDiasUteis } from "@/lib/previsaoUtils";
import { useEmpresaId } from "./useEmpresaId";

interface ProdutoItem {
  produto_id: string;
  quantidade: number;
}

interface PrevisaoParams {
  produtos: ProdutoItem[];
  colaboradores_ids: string[];
  data_entrega: Date;
}

export function useColaboradores() {
  const empresaId = useEmpresaId();

  return useQuery({
    queryKey: ["colaboradores", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });
}

export function usePrevisaoProducao() {
  return useMutation({
    mutationFn: async ({
      produtos,
      colaboradores_ids,
      data_entrega,
    }: PrevisaoParams) => {
      // 1. Buscar desempenho dos colaboradores
      const { data: desempenho, error: desempenhoError } = await supabase
        .from("colaborador_desempenho")
        .select("*")
        .in("colaborador_id", colaboradores_ids);

      if (desempenhoError) throw desempenhoError;

      // 2. Para cada produto, buscar etapas e calcular tempo
      const resultados = [];

      for (const item of produtos) {
        const { data: etapasProduto, error: etapasError } = await supabase
          .from("produto_etapas")
          .select(`
            *,
            etapa:etapas(*),
            subetapa:subetapas(*)
          `)
          .eq("produto_id", item.produto_id)
          .order("ordem");

        if (etapasError) throw etapasError;

        // Buscar informações do produto
        const { data: produto, error: produtoError } = await supabase
          .from("produtos")
          .select("*")
          .eq("id", item.produto_id)
          .maybeSingle();

        if (produtoError) throw produtoError;
        if (!produto) throw new Error(`Produto não encontrado: ${item.produto_id}`);

        // 3. Para cada etapa, calcular tempo
        const etapasCalculadas = etapasProduto.map((ep: any) => {
          // Filtrar colaboradores que fazem essa etapa
          const colabsNaEtapa = desempenho?.filter(
            (d: any) =>
              d.etapa_id === ep.etapa_id &&
              (!ep.subetapa_id || d.subetapa_id === ep.subetapa_id)
          ) || [];

          // Calcular velocidade combinada (soma das velocidades)
          const velocidadeTotal = colabsNaEtapa.reduce((sum: number, c: any) => {
            return sum + 1 / c.tempo_medio_por_peca_minutos;
          }, 0);

          // Tempo total para a quantidade
          const tempoMinutos =
            velocidadeTotal > 0 ? item.quantidade / velocidadeTotal : 0;

          // Calcular custo
          const custoPorHora = ep.subetapa?.custo_por_hora || ep.etapa?.custo_por_hora || 0;
          const custoTotal = (tempoMinutos / 60) * custoPorHora;

          return {
            etapa: ep,
            colaboradores: colabsNaEtapa,
            tempoMinutos,
            tempoHoras: tempoMinutos / 60,
            custoTotal,
            alertaSemColaborador: colabsNaEtapa.length === 0,
            alertaPoucosDados: colabsNaEtapa.some((c: any) => c.num_producoes < 3),
          };
        });

        const tempoTotalMinutos = etapasCalculadas.reduce(
          (sum, e) => sum + e.tempoMinutos,
          0
        );

        const custoTotalProduto = etapasCalculadas.reduce(
          (sum, e) => sum + e.custoTotal,
          0
        );

        resultados.push({
          produto_id: item.produto_id,
          produto_nome: produto.nome,
          quantidade: item.quantidade,
          etapas: etapasCalculadas,
          tempoTotalMinutos,
          custoTotal: custoTotalProduto,
        });
      }

      // 4. Calcular totais e verificar data de entrega
      const tempoTotalHoras = resultados.reduce(
        (sum, r) => sum + r.tempoTotalMinutos / 60,
        0
      );

      const custoTotalGeral = resultados.reduce(
        (sum, r) => sum + r.custoTotal,
        0
      );

      const diasUteisNecessarios = Math.ceil(tempoTotalHoras / 9);

      const dataAtual = new Date();
      const diasUteisDisponiveis = contarDiasUteis(dataAtual, data_entrega);

      const precisaHoraExtra = diasUteisNecessarios > diasUteisDisponiveis;

      const horasExtrasPorDia =
        precisaHoraExtra && diasUteisDisponiveis > 0
          ? (tempoTotalHoras - diasUteisDisponiveis * 9) / diasUteisDisponiveis
          : 0;

      const dataPrevistaConclusao = adicionarDiasUteis(
        dataAtual,
        diasUteisNecessarios
      );

      // Verificar alertas globais
      const temAlertaSemColaborador = resultados.some((r) =>
        r.etapas.some((e) => e.alertaSemColaborador)
      );

      const temAlertaPoucosDados = resultados.some((r) =>
        r.etapas.some((e) => e.alertaPoucosDados)
      );

      return {
        resultados,
        tempoTotalHoras,
        custoTotalGeral,
        diasUteisNecessarios,
        diasUteisDisponiveis,
        precisaHoraExtra,
        horasExtrasPorDia,
        dataPrevistaConclusao,
        temAlertaSemColaborador,
        temAlertaPoucosDados,
      };
    },
  });
}

export function useSalvarPrevisao() {
  const empresaId = useEmpresaId();

  return useMutation({
    mutationFn: async (dados: any) => {
      const { error } = await supabase
        .from("previsoes_producao")
        .insert({
          empresa_id: empresaId,
          nome_pedido: dados.nome_pedido,
          data_entrega_desejada: dados.data_entrega,
          data_previsao_conclusao: dados.dataPrevistaConclusao.toISOString().split('T')[0],
          horas_totais_previstas: dados.tempoTotalHoras,
          dias_uteis_previstos: dados.diasUteisNecessarios,
          precisa_hora_extra: dados.precisaHoraExtra,
          colaboradores_ids: dados.colaboradores_ids,
          produtos_quantidades: dados.produtos,
          detalhamento: dados.resultados,
        });

      if (error) throw error;
    },
  });
}
