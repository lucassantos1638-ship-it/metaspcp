import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";

export function useVendasPerdidas() {
    const empresaId = useEmpresaId();
    return useQuery({
        queryKey: ["vendas_perdidas", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("vendas_perdidas")
                .select(`
            *,
            itens:vendas_perdidas_itens (
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

export function useVendaPerdida(id: string) {
    return useQuery({
        queryKey: ["venda_perdida", id],
        enabled: !!id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("vendas_perdidas")
                .select(`
            *,
            itens:vendas_perdidas_itens (
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

export function useCriarVendaPerdida() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (novaVenda: { cliente_nome: string; data_referencia: Date; usuario_id: string; usuario_nome: string; tabela_preco: string; empresa_id: string }) => {
            const { data, error } = await supabase
                .from("vendas_perdidas")
                .insert({
                    cliente_nome: novaVenda.cliente_nome,
                    data_referencia: novaVenda.data_referencia,
                    usuario_id: novaVenda.usuario_id,
                    usuario_nome: novaVenda.usuario_nome,
                    tabela_preco: novaVenda.tabela_preco,
                    empresa_id: novaVenda.empresa_id
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["vendas_perdidas"] });
            toast({ title: "Venda Perdida registrada com sucesso!" });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao registrar venda perdida",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

export function useAdicionarItemVendaPerdida() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (novoItem: { venda_perdida_id: string; produto_id: string; quantidade: number; valor_unitario: number }) => {
            const { error } = await supabase
                .from("vendas_perdidas_itens")
                .insert({
                    venda_perdida_id: novoItem.venda_perdida_id,
                    produto_id: novoItem.produto_id,
                    quantidade: novoItem.quantidade,
                    valor_unitario: novoItem.valor_unitario
                });

            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["vendas_perdidas"] });
            queryClient.invalidateQueries({ queryKey: ["venda_perdida", variables.venda_perdida_id] });
        },
        onError: (error: any) => {
            toast({ title: "Erro ao adicionar item", description: error.message, variant: "destructive" });
        }
    });
}

export function useAtualizarItemVendaPerdida() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, quantidade, valor_unitario }: { id: string; quantidade?: number; valor_unitario?: number }) => {
            const updates: any = {};
            if (quantidade !== undefined) updates.quantidade = quantidade;
            if (valor_unitario !== undefined) updates.valor_unitario = valor_unitario;

            const { error } = await supabase
                .from("vendas_perdidas_itens")
                .update(updates)
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["vendas_perdidas"] });
            queryClient.invalidateQueries({ queryKey: ["venda_perdida"] });
        },
    });
}

export function useRemoverItemVendaPerdida() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (itemId: string) => {
            const { error } = await supabase
                .from("vendas_perdidas_itens")
                .delete()
                .eq("id", itemId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["vendas_perdidas"] });
            queryClient.invalidateQueries({ queryKey: ["venda_perdida"] });
        },
    });
}
