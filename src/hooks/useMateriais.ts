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

    // Conversion fields
    tem_conversao_pacote: boolean;
    fator_conversao_pacote: number;

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
        mutationFn: async (novoMaterial: {
            nome: string;
            codigo?: string;
            preco_custo: number;
            unidade_medida: string;
            estoque_estamparia?: number;
            estoque_tingimento?: number;
            estoque_fabrica?: number;
            tem_conversao_pacote?: boolean;
            fator_conversao_pacote?: number;
        }) => {
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

// Batch creation of colors
export function useCriarCores() {
    const queryClient = useQueryClient();
    const empresaId = useEmpresaId();

    return useMutation({
        mutationFn: async (novasCores: { material_id: string; nome: string; hex?: string }[]) => {
            if (!empresaId) throw new Error("Empresa não identificada");

            const coresComEmpresa = novasCores.map(cor => ({
                ...cor,
                empresa_id: empresaId
            }));

            const { data, error } = await supabase
                .from("materiais_cores")
                .insert(coresComEmpresa)
                .select();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            if (data && data.length > 0) {
                queryClient.invalidateQueries({ queryKey: ["material", data[0].material_id] });
            }
            toast({ title: "Cores adicionadas com sucesso" });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao adicionar cores",
                description: error.message,
                variant: "destructive",
            });
        },
    });
}

// ...existing code...
export function useExcluirCor() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, material_id }: { id: string; material_id: string }) => {
            const { error } = await supabase
                .from("materiais_cores")
                .delete()
                .eq("id", id);

            if (error) throw error;
            return { material_id };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["material", data.material_id] });
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

export function useExcluirMaterial() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("materiais")
                .delete()
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["materiais"] });
            toast({ title: "Material excluído com sucesso" });
        },
        onError: (error: any) => {
            let description = error.message;

            if (error.message?.includes("violates foreign key constraint")) {
                if (error.message?.includes("produto_materiais")) {
                    description = "Este material faz parte da Ficha Técnica de um ou mais produtos. Remova-o dos produtos antes de excluir.";
                } else if (error.message?.includes("lote_consumo")) {
                    description = "Este material já possui histórico de consumo em lotes e não pode ser excluído para manter a integridade dos dados.";
                } else {
                    description = "Este material está em uso por outros registros do sistema e não pode ser excluído.";
                }
            }

            toast({
                title: "Não foi possível excluir",
                description: description,
                variant: "destructive",
            });
        }
    });
}
