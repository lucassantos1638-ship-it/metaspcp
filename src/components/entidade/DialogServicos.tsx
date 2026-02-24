import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Servico {
    id: string;
    nome: string;
    valor: number;
}

interface DialogServicosProps {
    entidade: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function DialogServicos({
    entidade,
    open,
    onOpenChange,
}: DialogServicosProps) {
    const empresaId = useEmpresaId();
    const queryClient = useQueryClient();
    const [nome, setNome] = useState("");
    const [valor, setValor] = useState("");

    const { data: servicos, isLoading } = useQuery({
        queryKey: ["entidade_servicos", entidade?.id],
        enabled: !!entidade?.id && open,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("entidade_servicos")
                .select("*")
                .eq("entidade_id", entidade.id)
                .order("nome");

            if (error) throw error;
            return data as Servico[];
        },
    });

    const saveMutation = useMutation({
        mutationFn: async (novoServico: { nome: string; valor: number }) => {
            const { error } = await supabase.from("entidade_servicos").insert([{
                empresa_id: empresaId,
                entidade_id: entidade.id,
                nome: novoServico.nome,
                valor: novoServico.valor,
            }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["entidade_servicos", entidade?.id] });
            toast.success("Serviço adicionado com sucesso!");
            setNome("");
            setValor("");
        },
        onError: (error: any) => {
            toast.error(`Erro ao salvar serviço: ${error.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("entidade_servicos").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["entidade_servicos", entidade?.id] });
            toast.success("Serviço removido!");
        },
        onError: (error: any) => {
            toast.error(`Erro ao excluir: ${error.message}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nome.trim() || !valor) {
            toast.error("Preencha nome e valor do serviço.");
            return;
        }

        // Converte string com vírgula para número
        const valorNum = parseFloat(valor.replace(",", "."));
        if (isNaN(valorNum) || valorNum <= 0) {
            toast.error("Valor inválido.");
            return;
        }

        saveMutation.mutate({ nome, valor: valorNum });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Serviços Terceirizados - {entidade?.nome}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex gap-2 items-end mt-4">
                    <div className="space-y-2 flex-1">
                        <Label htmlFor="nome-servico">Nome do Serviço</Label>
                        <Input
                            id="nome-servico"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Ex: Costura Camisa"
                        />
                    </div>
                    <div className="space-y-2 w-[120px]">
                        <Label htmlFor="valor-servico">Valor (R$)</Label>
                        <Input
                            id="valor-servico"
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            placeholder="0,00"
                        />
                    </div>
                    <Button type="submit" disabled={saveMutation.isPending}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </form>

                <div className="border rounded-md mt-4 max-h-[300px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Serviço</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead className="w-[60px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">
                                        Carregando...
                                    </TableCell>
                                </TableRow>
                            ) : servicos?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">
                                        Nenhum serviço cadastrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                servicos?.map((servico) => (
                                    <TableRow key={servico.id}>
                                        <TableCell className="font-medium py-2">{servico.nome}</TableCell>
                                        <TableCell className="py-2">{formatCurrency(servico.valor)}</TableCell>
                                        <TableCell className="py-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    if (window.confirm("Remover este serviço?")) {
                                                        deleteMutation.mutate(servico.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
