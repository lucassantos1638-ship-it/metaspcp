import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface DialogProdutosTabelaProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tabelaId: string;
    tabelaNome: string;
}

interface ItemTabela {
    id: string;
    produto_id: string;
    preco: number;
    produto_nome?: string;
    produto_sku?: string;
}

export default function DialogProdutosTabela({
    open,
    onOpenChange,
    tabelaId,
    tabelaNome
}: DialogProdutosTabelaProps) {
    const empresaId = useEmpresaId();
    const queryClient = useQueryClient();

    const [produtoSelecionado, setProdutoSelecionado] = useState<string>("");
    const [preco, setPreco] = useState<string>("");

    const { data: itens, isLoading } = useQuery({
        queryKey: ["tabelas_preco_itens", tabelaId],
        enabled: open && !!tabelaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tabelas_preco_itens")
                .select(`
                    id, 
                    produto_id, 
                    preco,
                    produtos:produto_id (nome, sku)
                `)
                .eq("tabela_preco_id", tabelaId);

            if (error) throw error;

            return data.map((d: any) => ({
                id: d.id,
                produto_id: d.produto_id,
                preco: d.preco,
                produto_nome: d.produtos?.nome,
                produto_sku: d.produtos?.sku,
            })) as ItemTabela[];
        },
    });

    const { data: produtos } = useQuery({
        queryKey: ["produtos", empresaId],
        enabled: open && !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("produtos")
                .select("id, nome, sku")
                .eq("empresa_id", empresaId)
                .order("nome");

            if (error) throw error;
            return data;
        },
    });

    const addMutation = useMutation({
        mutationFn: async () => {
            if (!produtoSelecionado || !preco) throw new Error("Preencha o produto e o preço");

            const precoNum = parseFloat(preco.replace(",", "."));
            if (isNaN(precoNum)) throw new Error("Preço inválido");

            const { error } = await supabase
                .from("tabelas_preco_itens")
                .insert([{
                    tabela_preco_id: tabelaId,
                    produto_id: produtoSelecionado,
                    preco: precoNum
                }]);

            if (error) {
                if (error.code === '23505') {
                    throw new Error("Este produto já está nesta tabela");
                }
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tabelas_preco_itens", tabelaId] });
            toast.success("Produto adicionado à tabela!");
            setProdutoSelecionado("");
            setPreco("");
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("tabelas_preco_itens").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tabelas_preco_itens", tabelaId] });
            toast.success("Produto removido da tabela!");
        },
        onError: (error) => {
            toast.error(`Erro ao remover: ${error.message}`);
        },
    });

    const handleAdd = () => {
        addMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Tabela: {tabelaNome}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-12 gap-4 items-end bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="col-span-12 sm:col-span-7 space-y-2">
                        <Label>Produto</Label>
                        <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione um produto..." />
                            </SelectTrigger>
                            <SelectContent>
                                {produtos?.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.sku ? `[${p.sku}] ` : ""}{p.nome}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="col-span-8 sm:col-span-3 space-y-2">
                        <Label>Preço de Venda</Label>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={preco}
                            onChange={(e) => setPreco(e.target.value)}
                        />
                    </div>
                    <div className="col-span-4 sm:col-span-2 space-y-2">
                        <Button onClick={handleAdd} disabled={addMutation.isPending} className="w-full">
                            <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                    </div>
                </div>

                <div className="bg-card border rounded-lg shadow-sm overflow-hidden h-[400px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary">
                            <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead className="text-right">Preço</TableHead>
                                <TableHead className="w-[80px] text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8">Carregando...</TableCell>
                                </TableRow>
                            ) : itens?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                        Nenhum produto vinculado a esta tabela.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                itens?.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">
                                            {item.produto_sku ? `[${item.produto_sku}] ` : ""}
                                            {item.produto_nome}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => removeMutation.mutate(item.id)}
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
