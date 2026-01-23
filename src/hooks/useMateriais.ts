import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEmpresaId } from "./useEmpresaId";

export interface Material {
    id: string;
    nome: string;
    codigo?: string | null;
    preco_custo: number;
    estoque_estamparia: number;
    estoque_tingimento: number;
    estoque_fabrica: number;
    unidade_medida: string;
    ativo: boolean;
    empresa_id: string;
    created_at: string;
    updated_at: string;
}

export interface MaterialCor {
    id: string;
    material_id: string;
    nome: string;
    hex: string | null;
    empresa_id: string;
    created_at: string;
}

export interface MaterialWithCores extends Material {
    cores: MaterialCor[];
}

export function useMateriais(apenasAtivos?: boolean) {
    const empresaId = useEmpresaId();

    return useQuery({
        queryKey: ["materiais", empresaId, apenasAtivos],
        enabled: !!empresaId,
        queryFn: async () => {
            let query = supabase
                .from("materiais")
                .select("*")
                .eq("empresa_id", empresaId)
                .order("nome", { ascending: true });

            if (apenasAtivos) {
                query = query.eq("ativo", true);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as Material[];
        },
    });
}

export function useMaterial(materialId: string | null) {
    const empresaId = useEmpresaId();

    return useQuery({
        queryKey: ["material", materialId],
        enabled: !!materialId && !!empresaId,
        queryFn: async () => {
            // Fetch material
            const { data: material, error: materialError } = await supabase
                .from("materiais")
                .select("*")
                .eq("id", materialId)
                .single();

            if (materialError) throw materialError;

            // Fetch colors
            const { data: cores, error: coresError } = await supabase
                .from("materiais_cores")
                .select("*")
                .eq("material_id", materialId)
                .order("nome");

            if (coresError) throw coresError;

            return { ...material, cores: cores || [] } as MaterialWithCores;
        },
    });
}

export function useCriarMaterial() {
    const queryClient = useQueryClient();
    const empresaId = useEmpresaId();

    return useMutation({
        mutationFn: async (novoMaterial: { nome: string; codigo?: string; preco_custo: number; unidade_medida: string; estoque_estamparia?: number; estoque_tingimento?: number; estoque_fabrica?: number }) => {
            if (!empresaId) throw new Error("Empresa não identificada");

            const { data, error } = await supabase
                .from("materiais")
                .insert([{ ...novoMaterial, empresa_id: empresaId }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["materiais"] });
            toast({ title: "Material criado com sucesso" });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao criar material",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

export function useAtualizarMaterial() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updates }: Partial<Material> & { id: string }) => {
            const { data, error } = await supabase
                .from("materiais")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["materiais"] });
            queryClient.invalidateQueries({ queryKey: ["material", data.id] });
            toast({ title: "Material atualizado" });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao atualizar material",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

export function useToggleAtivoMaterial() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
            const { error } = await supabase
                .from("materiais")
                .update({ ativo })
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["materiais"] });
            toast({
                title: variables.ativo ? "Material ativado" : "Material desativado",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao alterar status",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

export function useCriarCor() {
    const queryClient = useQueryClient();
    const empresaId = useEmpresaId();

    return useMutation({
        mutationFn: async (novaCor: { material_id: string; nome: string; hex?: string }) => {
            if (!empresaId) throw new Error("Empresa não identificada");

            const { data, error } = await supabase
                .from("materiais_cores")
                .insert([{ ...novaCor, empresa_id: empresaId }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["material", data.material_id] });
            toast({ title: "Cor adicionada" });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao adicionar cor",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

export function useExcluirCor() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, material_id }: { id: string; material_id: string }) => {
            const { error } = await supabase
                .from("materiais_cores")
                .delete()
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["material", variables.material_id] });
            toast({ title: "Cor removida" });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao remover cor",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}
