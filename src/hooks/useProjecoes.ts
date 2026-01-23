import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";

export function useProjecoes() {
    const empresaId = useEmpresaId();
    return useQuery({
        queryKey: ["projecoes", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("projecoes")
                .select(`
            *,
            itens:projecao_itens (
                *,
                produto:produtos (*)
            )
        `)
                .eq("empresa_id", empresaId)
                .order("data_referencia", { ascending: false });

            if (error) throw error;
            return data;
        },
    });
}

export function useProjecao(id: string) {
    return useQuery({
        queryKey: ["projecao", id],
        enabled: !!id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("projecoes")
                .select(`
            *,
            itens:projecao_itens (
                *,
                produto:produtos (*)
            )
        `)
                .eq("id", id)
                .single();

            if (error) throw error;
            return data;
        },
    });
}

export function useCriarProjecao() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (novaProjecao: { cliente_nome: string; data_referencia: Date; usuario_id: string; usuario_nome: string; tabela_preco: string; empresa_id: string }) => {
            const { data, error } = await supabase
                .from("projecoes")
                .insert({
                    cliente_nome: novaProjecao.cliente_nome,
                    data_referencia: novaProjecao.data_referencia,
                    usuario_id: novaProjecao.usuario_id,
                    usuario_nome: novaProjecao.usuario_nome,
                    tabela_preco: novaProjecao.tabela_preco,
                    empresa_id: novaProjecao.empresa_id
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projecoes"] });
            toast({ title: "Projeção criada com sucesso!" });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao criar projeção",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

export function useAdicionarItemProjecao() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (novoItem: { projecao_id: string; produto_id: string; quantidade: number; valor_unitario: number }) => {
            const { error } = await supabase
                .from("projecao_itens")
                .insert(novoItem);

            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["projecoes"] });
            queryClient.invalidateQueries({ queryKey: ["projecao", variables.projecao_id] });
        },
        onError: (error: any) => {
            toast({ title: "Erro ao adicionar item", description: error.message, variant: "destructive" });
        }
    });
}

export function useAtualizarItemProjecao() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, quantidade, valor_unitario }: { id: string; quantidade?: number; valor_unitario?: number }) => {
            const updates: any = {};
            if (quantidade !== undefined) updates.quantidade = quantidade;
            if (valor_unitario !== undefined) updates.valor_unitario = valor_unitario;

            const { error } = await supabase
                .from("projecao_itens")
                .update(updates)
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projecoes"] });
            queryClient.invalidateQueries({ queryKey: ["projecao"] });
        },
    });
}

export function useRemoverItemProjecao() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (itemId: string) => {
            const { error } = await supabase
                .from("projecao_itens")
                .delete()
                .eq("id", itemId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projecoes"] });
            queryClient.invalidateQueries({ queryKey: ["projecao"] });
        },
    });
}
