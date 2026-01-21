import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Hook para buscar produções em aberto
export const useProducoesEmAberto = () => {
  return useQuery({
    queryKey: ["producoes-em-aberto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producoes")
        .select(`
          *,
          colaborador:colaboradores(nome),
          lote:lotes(numero_lote, nome_lote),
          etapa:etapas(nome),
          subetapa:subetapas(nome)
        `)
        .eq("status", "em_aberto")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
};

// Hook para verificar se colaborador já tem atividade em aberto
export const useColaboradorTemAtividadeAberta = (colaboradorId: string) => {
  return useQuery({
    queryKey: ["colaborador-atividade-aberta", colaboradorId],
    queryFn: async () => {
      if (!colaboradorId) return null;

      const { data, error } = await supabase
        .from("producoes")
        .select("*")
        .eq("colaborador_id", colaboradorId)
        .eq("status", "em_aberto")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!colaboradorId,
  });
};

// Hook para iniciar produção (abertura)
export const useIniciarProducao = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      colaborador_id: string;
      lote_id: string;
      etapa_id: string;
      subetapa_id?: string | null;
      quantidade_produzida?: number | null;
      data_inicio: string;
      hora_inicio: string;
      segundos_inicio?: number;
      empresa_id: string;
    }) => {
      const { data, error } = await supabase
        .from("producoes")
        .insert([{
          ...payload,
          status: "em_aberto",
          subetapa_id: payload.subetapa_id || null,
          quantidade_produzida: payload.quantidade_produzida || null,
          segundos_inicio: payload.segundos_inicio || 0,
          data_fim: null,
          hora_fim: null,
          segundos_fim: null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producoes-em-aberto"] });
      queryClient.invalidateQueries({ queryKey: ["colaborador-atividade-aberta"] });
      queryClient.invalidateQueries({ queryKey: ["acompanhamento-colaboradores"] });
      queryClient.invalidateQueries({ queryKey: ["detalhes_lote"] });
      toast.success("Atividade iniciada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao iniciar produção:", error);
      toast.error(`Erro ao iniciar atividade: ${error.message || "Erro desconhecido"}`);
    },
  });
};

// Hook para finalizar produção (fechamento)
export const useFinalizarProducao = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      data_fim: string;
      hora_fim: string;
      segundos_fim?: number;
      quantidade_produzida: number;
      observacao?: string;
    }) => {
      const { data, error } = await supabase
        .from("producoes")
        .update({
          data_fim: payload.data_fim,
          hora_fim: payload.hora_fim,
          segundos_fim: payload.segundos_fim || 0,
          quantidade_produzida: payload.quantidade_produzida,
          observacao: payload.observacao || null,
          status: "finalizado",
        })
        .eq("id", payload.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producoes-em-aberto"] });
      queryClient.invalidateQueries({ queryKey: ["producoes"] });
      queryClient.invalidateQueries({ queryKey: ["colaborador-atividade-aberta"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["acompanhamento-colaboradores"] });
      queryClient.invalidateQueries({ queryKey: ["detalhes_lote"] });
      toast.success("Atividade finalizada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao finalizar produção:", error);
      toast.error(`Erro ao finalizar atividade: ${error.message || "Erro desconhecido"}`);
    },
  });
};
