import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "./useEmpresaId";

export interface ColaboradorComAtividade {
    id: string;
    nome: string;
    cargo: string | null;
    atividadeAtual: {
        id: string;
        lote: {
            numero_lote: string;
            nome_lote: string;
        } | null;
        etapa: {
            nome: string;
        } | null;
        subetapa: {
            nome: string;
        } | null;
        atividade: {
            nome: string;
        } | null;
        data_inicio: string;
        hora_inicio: string;
        segundos_inicio: number;
    } | null;
}

export const useAcompanhamentoColaboradores = () => {
    const empresaId = useEmpresaId();

    return useQuery({
        queryKey: ["acompanhamento-colaboradores", empresaId],
        enabled: !!empresaId,
        queryFn: async (): Promise<ColaboradorComAtividade[]> => {
            // 1. Buscar todos os colaboradores ativos
            const { data: colaboradores, error: colabError } = await supabase
                .from("colaboradores")
                .select("id, nome, funcao")
                .eq("empresa_id", empresaId)
                .eq("ativo", true)
                .order("nome");

            if (colabError) throw colabError;

            // 2. Buscar atividades em aberto
            const { data: atividades, error: ativError } = await supabase
                .from("producoes")
                .select(`
          id,
          colaborador_id,
          data_inicio,
          hora_inicio,
          segundos_inicio,
          lote:lotes(numero_lote, nome_lote),
          etapa:etapas(nome),
          subetapa:subetapas(nome),
          atividade:atividades(nome)
        `)
                .eq("empresa_id", empresaId)
                .eq("status", "em_aberto");

            if (ativError) throw ativError;

            // 3. Combinar dados
            return colaboradores.map((colab) => {
                const atividade = atividades?.find((a) => a.colaborador_id === colab.id);

                return {
                    id: colab.id,
                    nome: colab.nome,
                    cargo: colab.funcao,
                    atividadeAtual: atividade ? {
                        id: atividade.id,
                        lote: Array.isArray(atividade.lote) ? atividade.lote[0] : atividade.lote,
                        etapa: Array.isArray(atividade.etapa) ? atividade.etapa[0] : atividade.etapa,
                        subetapa: Array.isArray(atividade.subetapa) ? atividade.subetapa[0] : atividade.subetapa,
                        atividade: Array.isArray(atividade.atividade) ? atividade.atividade[0] : atividade.atividade,
                        data_inicio: atividade.data_inicio,
                        hora_inicio: atividade.hora_inicio,
                        segundos_inicio: atividade.segundos_inicio || 0,
                    } : null
                } as ColaboradorComAtividade;
            });
        },
        refetchInterval: 30000, // Refresh every 30s
    });
};
