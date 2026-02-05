import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GerenciarAtividades = () => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editando, setEditando] = useState<any>(null);
    const [nome, setNome] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const empresaId = useEmpresaId();

    const { data: atividades, isLoading } = useQuery({
        queryKey: ["atividades", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("atividades")
                .select("*")
                .eq("empresa_id", empresaId)
                .order("nome");
            if (error) throw error;
            return data;
        },
    });

    const createAtividade = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from("atividades").insert({
                nome,
                empresa_id: empresaId,
                ativo: true
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Atividade criada com sucesso!" });
            queryClient.invalidateQueries({ queryKey: ["atividades"] });
            resetForm();
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao criar atividade",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const updateAtividade = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from("atividades")
                .update({
                    nome,
                })
                .eq("id", editando.id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Atividade atualizada com sucesso!" });
            queryClient.invalidateQueries({ queryKey: ["atividades"] });
            resetForm();
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao atualizar atividade",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const deleteAtividade = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("atividades").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Atividade excluída com sucesso!" });
            queryClient.invalidateQueries({ queryKey: ["atividades"] });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao excluir atividade",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const resetForm = () => {
        setNome("");
        setEditando(null);
        setDialogOpen(false);
    };

    const handleEdit = (atividade: any) => {
        setEditando(atividade);
        setNome(atividade.nome);
        setDialogOpen(true);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg sm:text-xl">Gerenciar Atividades</CardTitle>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setEditando(null); setNome(""); }} className="w-full sm:w-auto">
                            <Plus className="w-4 h-4 mr-2" />
                            Nova Atividade
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editando ? "Editar Atividade" : "Nova Atividade"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Nome da Atividade</Label>
                                <Input
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    placeholder="Ex: Manutenção, Limpeza, Reunião"
                                />
                            </div>
                            <Button
                                onClick={() => (editando ? updateAtividade.mutate() : createAtividade.mutate())}
                                disabled={!nome}
                                className="w-full"
                            >
                                {editando ? "Atualizar" : "Criar"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : atividades && atividades.length > 0 ? (
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <Table className="min-w-[500px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead className="w-[120px]">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {atividades.map((atividade) => (
                                    <TableRow key={atividade.id}>
                                        <TableCell className="font-medium">{atividade.nome}</TableCell>
                                        <TableCell className="space-x-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(atividade)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => deleteAtividade.mutate(atividade.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhuma atividade cadastrada</p>
                )}
            </CardContent>
        </Card>
    );
};

export default GerenciarAtividades;
