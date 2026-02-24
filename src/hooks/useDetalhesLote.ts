import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { agruparPorEtapa } from "@/lib/loteUtils";

export function useDetalhesLote(loteId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["detalhes_lote", loteId],
    queryFn: async () => {
      if (!loteId) return null;

      // 1. Buscar informações do lote + produto
      const { data: lote, error: loteError } = await supabase
        .from("lotes")
        .select(`
          *,
          produto:produtos(nome, sku)
        `)
        .eq("id", loteId)
        .single();

      if (loteError) throw loteError;

      // 2. Buscar TODAS as etapas e subetapas possíveis para essa empresa
      const { data: todasEtapas } = await supabase
        .from("etapas")
        .select(`
          id,
          nome,
          ordem,
          subetapas(id, nome)
        `)
        .eq("empresa_id", lote.empresa_id)
        .order("ordem");

      // 2.1 Buscar configuração de etapas do produto (se houver)
      const { data: produtoEtapas } = await supabase
        .from("produto_etapas")
        .select("etapa_id, subetapa_id")
        .eq("produto_id", lote.produto_id);

      // 2.2 Filtrar etapas baseadas no produto
      let etapasFiltradas = todasEtapas || [];

      if (produtoEtapas && produtoEtapas.length > 0) {
        etapasFiltradas = etapasFiltradas.filter(etapa =>
          produtoEtapas.some(pe => pe.etapa_id === etapa.id)
        );

        // Opcional: Filtrar subetapas se necessário, mas geralmente exibir a etapa já filtra o fluxo principal.
        // Se quisermos ser estritos com subetapas:
        etapasFiltradas = etapasFiltradas.map(etapa => {
          const configsDaEtapa = produtoEtapas.filter(pe => pe.etapa_id === etapa.id);
          const temRestricaoSubetapa = configsDaEtapa.some(pe => pe.subetapa_id !== null);

          if (temRestricaoSubetapa) {
            return {
              ...etapa,
              subetapas: etapa.subetapas.filter(sub =>
                configsDaEtapa.some(pe => pe.subetapa_id === sub.id)
              )
            };
          }
          return etapa;
        });
      }

      // 3. Buscar produções do lote
      const { data: producoes, error: producoesError } = await supabase
        .from("producoes_com_tempo")
        .select(`
          *,
          etapa:etapas(nome, ordem),
          subetapa:subetapas(nome),
          entidade:entidade(nome),
          servico:entidade_servicos(nome, valor)
        `)
        .eq("lote_id", loteId)
        .order("etapa(ordem)", { ascending: true });

      if (producoesError) throw producoesError;

      // 4. Agrupar informando a estrutura completa
      const progressoPorEtapa = agruparPorEtapa(
        (producoes || []) as any[],
        lote.quantidade_total,
        etapasFiltradas
      );

      // Calcular tempo total trabalhado (soma de tudo que já foi contabilizado)
      const tempoTotal = producoes?.reduce((sum, p) => sum + (p.tempo_produtivo_minutos || 0), 0) || 0;

      // Calcular quantidade total produzida (considerando etapa final ou soma média? Geralmente é a última etapa)
      // Mas a lógica anterior somava todas as finalizadas... vamos manter ou ajustar?
      // "Quantidade Produzida" do lote geralmente refere-se à última etapa (embalagem/expedição).
      // Mas vamos manter a lógica anterior de somar apenas 'finalizado' para não quebrar contrato, 
      // embora 'percentualGeral' do lote seja meio ambíguo se não for da última etapa.
      const quantidadeProduzida = producoes
        ?.filter(p => p.status === 'finalizado')
        .reduce((sum, p) => sum + (p.quantidade_produzida || 0), 0) || 0;

      // 5. Buscar consumo de materiais (Safe fetch)
      let custoMateriais = 0;
      let consumos: any[] = [];
      try {
        const { data: consumosData, error: consumoError } = await supabase
          .from("lote_consumo")
          .select(`
            id,
            quantidade_real,
            material:materiais(id, nome, codigo, preco_custo, unidade_medida),
            cor:materiais_cores(nome)
          `)
          .eq("lote_id", loteId);

        if (!consumoError && consumosData) {
          consumos = consumosData;
          custoMateriais = consumosData.reduce((sum, c: any) => {
            const preco = Math.max(0, c.material?.preco_custo || 0);
            const quantidade = Math.max(0, c.quantidade_real || 0);
            return sum + (quantidade * preco);
          }, 0);
        } else if (consumoError) {
          console.warn("Erro ao buscar custo materiais:", consumoError);
        }
      } catch (err) {
        console.warn("Erro ao buscar custo materiais (catch):", err);
      }

      return {
        lote,
        producoes: producoes || [],
        progressoPorEtapa,
        tempoTotal,
        quantidadeProduzida,
        custoMateriais,
        consumos,
      };
    },
    enabled: !!loteId,
    staleTime: 0, // Sempre buscar dados frescos ao abrir
    refetchInterval: 10000, // Atualizar a cada 10 segundos para ver tempo correndo
  });

  // Realtime subscription
  useEffect(() => {
    if (!loteId) return;

    const channel = supabase
      .channel('producoes-lote-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'producoes',
          filter: `lote_id=eq.${loteId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["detalhes_lote", loteId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loteId, queryClient]);

  return query;
}
