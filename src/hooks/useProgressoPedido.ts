import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function useProgressoPedido(previsaoId: string) {
  return useQuery({
    queryKey: ["progresso_pedido", previsaoId],
    queryFn: async () => {
      // Buscar progresso por produto
      const { data: progressoProdutos, error } = await supabase
        .from("progresso_produtos_previsao")
        .select("*")
        .eq("previsao_id", previsaoId);

      if (error) throw error;

      return progressoProdutos;
    },
    enabled: !!previsaoId,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}

export function useLotesDoPedido(previsaoId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["lotes_pedido", previsaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select(`
          *,
          produto:produtos(nome)
        `)
        .eq("previsao_id", previsaoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!previsaoId,
  });

  // Subscription para realtime
  useEffect(() => {
    if (!previsaoId) return;

    const channel = supabase
      .channel('lotes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lotes',
          filter: `previsao_id=eq.${previsaoId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["lotes_pedido", previsaoId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [previsaoId, queryClient]);

  return query;
}

export function useProgressoProdutoDetalhado(previsaoId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["progresso_produto_detalhado", previsaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progresso_produtos_etapas")
        .select("*")
        .eq("previsao_id", previsaoId)
        .order("produto_nome")
        .order("etapa_ordem");

      if (error) throw error;
      return data;
    },
    enabled: !!previsaoId,
  });

  // Subscription para realtime
  useEffect(() => {
    if (!previsaoId) return;

    const channel = supabase
      .channel('producoes-detalhado-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'producoes'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["progresso_produto_detalhado", previsaoId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [previsaoId, queryClient]);

  return query;
}

export function useProgressoProdutoResumo(previsaoId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["progresso_produto_resumo", previsaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progresso_produtos_resumo")
        .select("*")
        .eq("previsao_id", previsaoId)
        .order("produto_nome");

      if (error) throw error;
      return data;
    },
    enabled: !!previsaoId,
  });

  // Subscription para realtime
  useEffect(() => {
    if (!previsaoId) return;

    const channel = supabase
      .channel('producoes-resumo-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'producoes'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["progresso_produto_resumo", previsaoId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [previsaoId, queryClient]);

  return query;
}
