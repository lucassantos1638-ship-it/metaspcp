import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAtualizarProduto } from "@/hooks/useProdutos";
import { Loader2 } from "lucide-react";

interface EditarProdutoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    produtoId: string;
    nomeAtual: string;
    descricaoAtual: string;
    precoCpfAtual: number;
    precoCnpjAtual: number;
    estoqueAtual: number;
}

export default function EditarProdutoDialog({
    open,
    onOpenChange,
    produtoId,
    nomeAtual,
    descricaoAtual,
    precoCpfAtual,
    precoCnpjAtual,
    estoqueAtual,
}: EditarProdutoDialogProps) {
    const [nome, setNome] = useState("");
    const [descricao, setDescricao] = useState("");
    const [precoCpf, setPrecoCpf] = useState("");
    const [precoCnpj, setPrecoCnpj] = useState("");
    const [estoque, setEstoque] = useState("");

    const { mutate: atualizarProduto, isPending } = useAtualizarProduto();

    useEffect(() => {
        if (open) {
            setNome(nomeAtual || "");
            setDescricao(descricaoAtual || "");
            setPrecoCpf(precoCpfAtual !== undefined ? precoCpfAtual.toString() : "");
            setPrecoCnpj(precoCnpjAtual !== undefined ? precoCnpjAtual.toString() : "");
            setEstoque(estoqueAtual !== undefined ? estoqueAtual.toString() : "");
        }
    }, [open, nomeAtual, descricaoAtual, precoCpfAtual, precoCnpjAtual, estoqueAtual]);

    const handleSalvar = (e: React.FormEvent) => {
        e.preventDefault();
        atualizarProduto(
            {
                id: produtoId,
                nome,
                descricao,
                preco_cpf: Number(precoCpf) || 0,
                preco_cnpj: Number(precoCnpj) || 0,
                estoque: Number(estoque) || 0,
            },
            {
                onSuccess: () => {
                    onOpenChange(false);
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Editar Produto</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSalvar} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="nome">Nome</Label>
                        <Input
                            id="nome"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="descricao">Descrição</Label>
                        <Textarea
                            id="descricao"
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="precoCpf">Preço CPF</Label>
                            <Input
                                id="precoCpf"
                                type="number"
                                step="0.01"
                                min="0"
                                value={precoCpf}
                                onChange={(e) => setPrecoCpf(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="precoCnpj">Preço CNPJ</Label>
                            <Input
                                id="precoCnpj"
                                type="number"
                                step="0.01"
                                min="0"
                                value={precoCnpj}
                                onChange={(e) => setPrecoCnpj(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="estoque">Estoque</Label>
                            <Input
                                id="estoque"
                                type="number"
                                step="0.01"
                                min="0"
                                value={estoque}
                                onChange={(e) => setEstoque(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
