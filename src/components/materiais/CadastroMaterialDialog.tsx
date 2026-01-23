import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCriarMaterial } from "@/hooks/useMateriais";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface CadastroMaterialDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function CadastroMaterialDialog({ open, onOpenChange }: CadastroMaterialDialogProps) {
    const [nome, setNome] = useState("");
    const [codigo, setCodigo] = useState("");
    const [precoCusto, setPrecoCusto] = useState("");
    const [unidadeMedida, setUnidadeMedida] = useState("");
    const [estoqueEstamparia, setEstoqueEstamparia] = useState("");
    const [estoqueTingimento, setEstoqueTingimento] = useState("");
    const [estoqueFabrica, setEstoqueFabrica] = useState("");

    const { mutate: criarMaterial, isPending } = useCriarMaterial();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nome) return;

        criarMaterial(
            {
                nome,
                codigo,
                preco_custo: Number(precoCusto) || 0,
                unidade_medida: unidadeMedida,
                estoque_estamparia: Number(estoqueEstamparia) || 0,
                estoque_tingimento: Number(estoqueTingimento) || 0,
                estoque_fabrica: Number(estoqueFabrica) || 0,
            },
            {
                onSuccess: () => {
                    setNome("");
                    setCodigo("");
                    setPrecoCusto("");
                    setUnidadeMedida("");
                    setEstoqueEstamparia("");
                    setEstoqueTingimento("");
                    setEstoqueFabrica("");
                    onOpenChange(false);
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Novo Material</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-1 space-y-2">
                            <Label htmlFor="codigo">Cód. / Ref.</Label>
                            <Input
                                id="codigo"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                placeholder="OPCIONAL"
                            />
                        </div>
                        <div className="col-span-3 space-y-2">
                            <Label htmlFor="nome">Nome do Material</Label>
                            <Input
                                id="nome"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                placeholder="Ex: Tecido Algodão"
                                required
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="preco">Preço de Custo</Label>
                            <Input
                                id="preco"
                                type="number"
                                step="0.01"
                                min="0"
                                value={precoCusto}
                                onChange={(e) => setPrecoCusto(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unidade">Unidade Medida</Label>
                            <Input
                                id="unidade"
                                value={unidadeMedida}
                                onChange={(e) => setUnidadeMedida(e.target.value)}
                                placeholder="Ex: m, kg, un"
                            />
                        </div>
                    </div>

                    <Separator className="my-2" />
                    <Label className="text-base font-semibold">Estoque Inicial</Label>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="est_estamparia" className="text-xs">Estamparia</Label>
                            <Input
                                id="est_estamparia"
                                type="number"
                                step="any"
                                value={estoqueEstamparia}
                                onChange={(e) => setEstoqueEstamparia(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="est_tingimento" className="text-xs">Tingimento</Label>
                            <Input
                                id="est_tingimento"
                                type="number"
                                step="any"
                                value={estoqueTingimento}
                                onChange={(e) => setEstoqueTingimento(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="est_fabrica" className="text-xs">Fábrica</Label>
                            <Input
                                id="est_fabrica"
                                type="number"
                                step="any"
                                value={estoqueFabrica}
                                onChange={(e) => setEstoqueFabrica(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
