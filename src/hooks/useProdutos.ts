import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEmpresaId } from "./useEmpresaId";

export function useProdutos(apenasAtivos?: boolean) {
  const empresaId = useEmpresaId();

  return useQuery({
    queryKey: ["produtos", empresaId, apenasAtivos],
    enabled: !!empresaId,
    queryFn: async () => {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("produtos")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("created_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (apenasAtivos) {
          query = query.eq("ativo", true);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data) {
          allData = [...allData, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      return allData;
    },
  });
}

export function useProdutoComMetricas(produtoId: string) {
  return useQuery({
    queryKey: ["produto", produtoId, "metricas"],
    enabled: !!produtoId,
    queryFn: async () => {
      // Buscar produto
      const { data: produto, error: produtoError } = await supabase
        .from("produtos")
        .select("*")
        .eq("id", produtoId)
        .maybeSingle();

      if (produtoError) throw produtoError;
      if (!produto) throw new Error("Produto não encontrado");

      // Buscar etapas do produto
      const { data: etapas, error: etapasError } = await supabase
        .from("produto_etapas")
        .select(`
          *,
          etapa:etapas(*),
          subetapa:subetapas(*)
        `)
        .eq("produto_id", produtoId)
        .order("ordem");

      if (etapasError) throw etapasError;

      // Buscar métricas
      const { data: metricas, error: metricasError } = await supabase
        .from("produto_metricas")
        .select("*")
        .eq("produto_id", produtoId);

      if (metricasError) throw metricasError;

      // Buscar últimos lotes finalizados
      const { data: ultimosLotes, error: lotesError } = await supabase
        .from("lotes")
        .select("*")
        .eq("produto_id", produtoId)
        .eq("finalizado", true)
        .order("created_at", { ascending: false })
        .limit(3);

      if (lotesError) throw lotesError;

      // Buscar produções para esses lotes para calcular custo/tempo real de cada um
      const loteIds = ultimosLotes?.map((l) => l.id) || [];
      let ultimosLotesCalculados: any[] = [];

      if (loteIds.length > 0) {
        const { data: producoes, error: prodError } = await supabase
          .from("producoes")
          .select("*, colaborador:colaboradores(*)")
          .in("lote_id", loteIds)
          .not("data_fim", "is", null);

        if (!prodError && producoes) {
          ultimosLotesCalculados = ultimosLotes!.map((lote) => {
            const prods = producoes.filter((p) => p.lote_id === lote.id);
            let totalMinutos = 0;
            let totalCusto = 0;

            prods.forEach((p: any) => {
              const minutosNormais = p.minutos_normais || 0;
              const minutosExtras = p.minutos_extras || 0;

              totalMinutos += minutosNormais + minutosExtras;

              const custoHora = p.colaborador?.custo_por_hora || 0;
              const custoExtra = p.colaborador?.custo_hora_extra || custoHora;

              const custoN = (minutosNormais / 60) * custoHora;
              const custoE = (minutosExtras / 60) * custoExtra;

              totalCusto += custoN + custoE;
            });

            return {
              ...lote,
              tempo_por_peca: lote.quantidade_total > 0 ? totalMinutos / lote.quantidade_total : 0,
              custo_por_peca: lote.quantidade_total > 0 ? totalCusto / lote.quantidade_total : 0,
            };
          });
        } else {
          ultimosLotesCalculados = ultimosLotes || [];
        }
      }

      // Calcular totais
      const tempoTotalMedio = metricas?.reduce(
        (sum, m) => sum + (m.tempo_medio_por_peca_minutos || 0),
        0
      ) || 0;

      const custoTotalMedio = metricas?.reduce(
        (sum, m) => sum + (m.custo_medio_por_peca || 0),
        0
      ) || 0;

      const numLotesAnalisados = metricas?.[0]?.num_lotes_analisados || 0;

      return {
        produto,
        etapas: etapas || [],
        metricas: metricas || [],
        ultimosLotes: ultimosLotesCalculados,
        tempoTotalMedio,
        custoTotalMedio,
        numLotesAnalisados,
      };
    },
  });
}

export function useToggleAtivoProduto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("produtos")
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({
        title: variables.ativo ? "Produto ativado" : "Produto desativado",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar produto",
        variant: "destructive",
      });
    },
  });
}

export function useGerarSku() {
  return useMutation({
    mutationFn: async () => {
      try {
        const { data, error } = await supabase.rpc("gerar_sku");
        if (error) throw error;
        return data as string;
      } catch (error) {
        console.warn("Falha ao gerar SKU (Supabase), usando mock", error);
        return ` SKU-${Math.floor(Math.random() * 10000)}`;
      }
    },
  });
}

export function useExcluirProduto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (produtoId: string) => {
      // Verificar se há lotes vinculados
      const { data: lotes, error: lotesError } = await supabase
        .from("lotes")
        .select("id")
        .eq("produto_id", produtoId)
        .limit(1);

      if (lotesError) throw lotesError;

      if (lotes && lotes.length > 0) {
        throw new Error("Não é possível excluir. Existem lotes vinculados a este produto. Considere desativar o produto em vez de excluí-lo.");
      }

      // Excluir produto_etapas primeiro (FK constraint)
      const { error: etapasError } = await supabase
        .from("produto_etapas")
        .delete()
        .eq("produto_id", produtoId);

      if (etapasError) throw etapasError;

      // Excluir o produto
      const { error: produtoError } = await supabase
        .from("produtos")
        .delete()
        .eq("id", produtoId);

      if (produtoError) throw produtoError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({
        title: "Produto excluído",
        description: "O produto foi excluído com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
