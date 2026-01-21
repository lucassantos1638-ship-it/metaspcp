import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { contarDiasUteis } from "@/lib/previsaoUtils";
import { useEffect } from "react";
import { useEmpresaId } from "./useEmpresaId";

interface RegistrarImprevistoParams {
  previsao_id: string;
  tipo: string;
  descricao: string;
  horas_perdidas: number;
  data_ocorrencia: string;
}

interface AjustarColaboradoresParams {
  previsao_id: string;
  colaboradores_ids_novos: string[];
  tipo_ajuste: 'add' | 'remove';
  colaborador_afetado_id: string;
  colaborador_afetado_nome: string;
}

interface AjustarQuantidadeParams {
  previsao_id: string;
  produto_id: string;
  quantidade_nova: number;
}

interface AtualizarStatusParams {
  previsao_id: string;
  status: 'em_andamento' | 'concluida' | 'cancelada';
}

export function usePrevisoesSalvas(filtroStatus?: string) {
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["previsoes_producao", filtroStatus, empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      let query = supabase
        .from("previsoes_producao")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

      if (filtroStatus && filtroStatus !== 'todos') {
        query = query.eq("status", filtroStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });

  // Subscription para realtime
  useEffect(() => {
    const channel = supabase
      .channel('previsoes-list-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'previsoes_producao'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["previsoes_producao", filtroStatus] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filtroStatus, queryClient]);

  return query;
}

export function usePrevisaoDetalhes(previsaoId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["previsao_detalhes", previsaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsoes_producao")
        .select("*")
        .eq("id", previsaoId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!previsaoId,
  });

  // Subscription para realtime
  useEffect(() => {
    if (!previsaoId) return;

    const channel = supabase
      .channel('previsao-details-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'previsoes_producao',
          filter: `id=eq.${previsaoId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["previsao_detalhes", previsaoId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [previsaoId, queryClient]);

  return query;
}

export function useImprevistos(previsaoId: string) {
  return useQuery({
    queryKey: ["imprevistos", previsaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsao_imprevistos")
        .select("*")
        .eq("previsao_id", previsaoId)
        .order("data_ocorrencia", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!previsaoId,
  });
}

export function useAjustes(previsaoId: string) {
  return useQuery({
    queryKey: ["ajustes", previsaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsao_ajustes")
        .select("*")
        .eq("previsao_id", previsaoId)
        .order("data_ajuste", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!previsaoId,
  });
}

export function useRegistrarImprevisto() {
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: RegistrarImprevistoParams) => {
      const { previsao_id, tipo, descricao, horas_perdidas, data_ocorrencia } = params;

      const { error } = await supabase
        .from("previsao_imprevistos")
        .insert({
          empresa_id: empresaId,
          previsao_id,
          tipo,
          descricao,
          horas_perdidas,
          data_ocorrencia,
        });

      if (error) throw error;

      const { data: previsao } = await supabase
        .from("previsoes_producao")
        .select("horas_ajustadas")
        .eq("id", previsao_id)
        .single();

      await supabase
        .from("previsoes_producao")
        .update({
          horas_ajustadas: (previsao?.horas_ajustadas || 0) + horas_perdidas,
        })
        .eq("id", previsao_id);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["imprevistos", variables.previsao_id] });
      queryClient.invalidateQueries({ queryKey: ["previsao_detalhes", variables.previsao_id] });
      queryClient.invalidateQueries({ queryKey: ["previsoes_producao"] });
      toast.success("Imprevisto registrado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao registrar imprevisto:", error);
      toast.error("Erro ao registrar imprevisto");
    },
  });
}

export function useAjustarColaboradores() {
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AjustarColaboradoresParams) => {
      const { previsao_id, colaboradores_ids_novos, tipo_ajuste, colaborador_afetado_id, colaborador_afetado_nome } = params;

      const { data: previsao, error: previsaoError } = await supabase
        .from("previsoes_producao")
        .select("*")
        .eq("id", previsao_id)
        .single();

      if (previsaoError) throw previsaoError;

      const impacto_horas = tipo_ajuste === 'add' ? -15 : 15;

      await supabase
        .from("previsoes_producao")
        .update({
          colaboradores_ids: colaboradores_ids_novos,
          horas_ajustadas: (previsao.horas_ajustadas || 0) + impacto_horas,
        })
        .eq("id", previsao_id);

      await supabase
        .from("previsao_ajustes")
        .insert({
          empresa_id: empresaId,
          previsao_id,
          tipo_ajuste: tipo_ajuste === 'add' ? 'add_colaborador' : 'remove_colaborador',
          detalhes: { 
            colaborador_id: colaborador_afetado_id,
            colaborador_nome: colaborador_afetado_nome
          },
          impacto_horas,
        });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ajustes", variables.previsao_id] });
      queryClient.invalidateQueries({ queryKey: ["previsao_detalhes", variables.previsao_id] });
      queryClient.invalidateQueries({ queryKey: ["previsoes_producao"] });
      toast.success("Equipe ajustada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao ajustar colaboradores:", error);
      toast.error("Erro ao ajustar equipe");
    },
  });
}

export function useAjustarQuantidade() {
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AjustarQuantidadeParams) => {
      const { previsao_id, produto_id, quantidade_nova } = params;

      const { data: previsao, error: previsaoError } = await supabase
        .from("previsoes_producao")
        .select("*")
        .eq("id", previsao_id)
        .single();

      if (previsaoError) throw previsaoError;

      const produtos = previsao.produtos_quantidades as any[];
      const index = produtos.findIndex((p: any) => p.produto_id === produto_id);
      
      if (index === -1) throw new Error("Produto não encontrado");

      const quantidade_antiga = produtos[index].quantidade;
      const diferenca = quantidade_nova - quantidade_antiga;
      
      const impacto_horas = (diferenca * 0.76);

      produtos[index].quantidade = quantidade_nova;

      await supabase
        .from("previsoes_producao")
        .update({
          produtos_quantidades: produtos,
          horas_ajustadas: (previsao.horas_ajustadas || 0) + impacto_horas,
        })
        .eq("id", previsao_id);

      await supabase
        .from("previsao_ajustes")
        .insert({
          empresa_id: empresaId,
          previsao_id,
          tipo_ajuste: 'ajuste_quantidade',
          detalhes: { 
            produto_id, 
            produto_nome: produtos[index].produto_nome,
            quantidade_antiga, 
            quantidade_nova 
          },
          impacto_horas,
        });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ajustes", variables.previsao_id] });
      queryClient.invalidateQueries({ queryKey: ["previsao_detalhes", variables.previsao_id] });
      queryClient.invalidateQueries({ queryKey: ["previsoes_producao"] });
      toast.success("Quantidade ajustada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao ajustar quantidade:", error);
      toast.error("Erro ao ajustar quantidade");
    },
  });
}

export function useAtualizarStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AtualizarStatusParams) => {
      const { previsao_id, status } = params;

      const { error } = await supabase
        .from("previsoes_producao")
        .update({ status })
        .eq("id", previsao_id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["previsao_detalhes", variables.previsao_id] });
      queryClient.invalidateQueries({ queryKey: ["previsoes_producao"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    },
  });
}

export function useDeletarImprevisto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, previsao_id, horas_perdidas }: { id: string; previsao_id: string; horas_perdidas: number }) => {
      const { error } = await supabase
        .from("previsao_imprevistos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      const { data: previsao } = await supabase
        .from("previsoes_producao")
        .select("horas_ajustadas")
        .eq("id", previsao_id)
        .single();

      await supabase
        .from("previsoes_producao")
        .update({
          horas_ajustadas: (previsao?.horas_ajustadas || 0) - horas_perdidas,
        })
        .eq("id", previsao_id);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["imprevistos", variables.previsao_id] });
      queryClient.invalidateQueries({ queryKey: ["previsao_detalhes", variables.previsao_id] });
      queryClient.invalidateQueries({ queryKey: ["previsoes_producao"] });
      toast.success("Imprevisto removido com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao deletar imprevisto:", error);
      toast.error("Erro ao deletar imprevisto");
    },
  });
}
