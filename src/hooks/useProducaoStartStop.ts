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
          lote:lotes(numero_lote, nome_lote, produto_id),
          etapa:etapas(nome, ordem),
          subetapa:subetapas(nome),
          atividade:atividades(nome),
          entidade:entidade(nome),
          servico:entidade_servicos(nome, valor)
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
        .select(`
          *,
          lote:lotes(numero_lote, nome_lote),
          etapa:etapas(nome),
          subetapa:subetapas(nome),
          atividade:atividades(nome)
        `)
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
      colaborador_id?: string | null;
      lote_id?: string | null;
      etapa_id?: string | null;
      subetapa_id?: string | null;
      atividade_id?: string | null;
      terceirizado?: boolean;
      entidade_id?: string | null;
      servico_id?: string | null;
      quantidade_enviada?: number | null;
      quantidade_produzida?: number | null;
      data_inicio: string;
      hora_inicio: string;
      segundos_inicio?: number;
      empresa_id: string;
    }) => {
      // Validar payload
      if (!payload.atividade_id && (!payload.lote_id || (!payload.etapa_id && !payload.terceirizado))) {
        throw new Error("É necessário informar um Lote/Etapa, uma Atividade, ou um Lote Terceirizado.");
      }
      if (payload.terceirizado && (!payload.entidade_id || !payload.servico_id || !payload.quantidade_enviada)) {
        throw new Error("Para terceirização, informe a Entidade, o Serviço e a Quantidade Enviada.");
      }
      if (!payload.terceirizado && !payload.colaborador_id) {
        throw new Error("É necessário informar o Colaborador para atividades internas.");
      }

      const { data, error } = await supabase
        .from("producoes")
        .insert([{
          colaborador_id: payload.colaborador_id || null,
          empresa_id: payload.empresa_id,
          lote_id: payload.lote_id || null, // Garante null se undefined
          etapa_id: payload.etapa_id || null, // Garante null se undefined
          subetapa_id: payload.subetapa_id || null,
          atividade_id: payload.atividade_id || null, // Novo campo
          terceirizado: payload.terceirizado || false,
          entidade_id: payload.entidade_id || null,
          servico_id: payload.servico_id || null,
          quantidade_enviada: payload.quantidade_enviada || null,
          quantidade_produzida: payload.quantidade_produzida || null,
          data_inicio: payload.data_inicio,
          hora_inicio: payload.hora_inicio,
          segundos_inicio: payload.segundos_inicio || 0,
          status: "em_aberto",
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
      data_fim?: string | null;
      hora_fim?: string | null;
      segundos_fim?: number | null;
      quantidade_produzida?: number;
      quantidade_devolvida?: number;
      observacao?: string;
      status?: "em_aberto" | "finalizado";
    }) => {
      const { data, error } = await supabase
        .from("producoes")
        .update({
          data_fim: payload.data_fim !== undefined ? payload.data_fim : null,
          hora_fim: payload.hora_fim !== undefined ? payload.hora_fim : null,
          segundos_fim: payload.segundos_fim !== undefined ? payload.segundos_fim : null,
          quantidade_produzida: payload.quantidade_produzida,
          quantidade_devolvida: payload.quantidade_devolvida !== undefined ? payload.quantidade_devolvida : undefined,
          observacao: payload.observacao || null,
          status: payload.status || "finalizado",
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
