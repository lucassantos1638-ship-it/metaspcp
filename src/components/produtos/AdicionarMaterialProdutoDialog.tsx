import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMateriais } from "@/hooks/useMateriais";
import { useAdicionarMaterialProduto } from "@/hooks/useProdutos";
import { Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatarCusto } from "@/lib/custoUtils";

interface AdicionarMaterialProdutoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    produtoId: string;
}

export default function AdicionarMaterialProdutoDialog({
    open,
    onOpenChange,
    produtoId,
}: AdicionarMaterialProdutoDialogProps) {
    const [busca, setBusca] = useState("");
    const [quantidade, setQuantidade] = useState("");
    const [materialSelecionado, setMaterialSelecionado] = useState<any | null>(null);

    const { data: materiais } = useMateriais();
    const adicionarMaterial = useAdicionarMaterialProduto();

    const handleSalvar = () => {
        if (!materialSelecionado || !quantidade) return;

        adicionarMaterial.mutate(
            {
                produtoId,
                materialId: materialSelecionado.id,
                quantidade: Number(quantidade),
            },
            {
                onSuccess: () => {
                    onOpenChange(false);
                    setQuantidade("");
                    setMaterialSelecionado(null);
                    setBusca("");
                },
            }
        );
    };

    const materiaisFiltrados = materiais?.filter((m) =>
        m.nome.toLowerCase().includes(busca.toLowerCase()) && m.ativo
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Adicionar Material</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!materialSelecionado ? (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar material..."
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            <ScrollArea className="h-[200px] border rounded-md p-2">
                                <div className="space-y-1">
                                    {materiaisFiltrados?.map((material) => (
                                        <div
                                            key={material.id}
                                            className="flex items-center justify-between p-2 hover:bg-muted rounded-md cursor-pointer text-sm"
                                            onClick={() => setMaterialSelecionado(material)}
                                        >
                                            <div className="font-medium">{material.nome}</div>
                                            <div className="text-muted-foreground">{formatarCusto(material.preco_custo)} / {material.unidade_medida}</div>
                                        </div>
                                    ))}
                                    {materiaisFiltrados?.length === 0 && (
                                        <div className="text-center text-muted-foreground py-4 text-sm">
                                            Nenhum material encontrado
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md border">
                                <div>
                                    <div className="font-semibold">{materialSelecionado.nome}</div>
                                    <div className="text-sm text-muted-foreground flex gap-2">
                                        <Badge variant="outline" className="text-xs">{materialSelecionado.unidade_medida}</Badge>
                                        <span>{formatarCusto(materialSelecionado.preco_custo)} / unid</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setMaterialSelecionado(null)}>
                                    Trocar
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label>Quantidade Utilizada ({materialSelecionado.unidade_medida})</Label>
                                <Input
                                    type="number"
                                    step="0.001"
                                    placeholder="Ex: 1.5"
                                    value={quantidade}
                                    onChange={(e) => setQuantidade(e.target.value)}
                                    autoFocus
                                />
                                {quantidade && (
                                    <div className="text-right text-sm text-muted-foreground">
                                        Custo Total: <span className="font-semibold text-foreground">{formatarCusto(Number(quantidade) * materialSelecionado.preco_custo)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSalvar} disabled={!materialSelecionado || !quantidade || adicionarMaterial.isPending}>
                        {adicionarMaterial.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
