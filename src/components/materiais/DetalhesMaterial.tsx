import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMaterial, useAtualizarMaterial, useCriarCor, useExcluirCor } from "@/hooks/useMateriais";
import { ArrowLeft, Loader2, Plus, Trash2, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface DetalhesMaterialProps {
    materialId: string;
    onVoltar: () => void;
}

export default function DetalhesMaterial({ materialId, onVoltar }: DetalhesMaterialProps) {
    const { data: material, isLoading } = useMaterial(materialId);
    const { mutate: atualizarMaterial, isPending: isUpdating } = useAtualizarMaterial();
    const { mutate: criarCor, isPending: isCreatingCor } = useCriarCor();
    const { mutate: excluirCor, isPending: isDeletingCor } = useExcluirCor();

    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        nome: "",
        codigo: "",
        preco_custo: 0,
        unidade_medida: "",
        estoque_estamparia: 0,
        estoque_tingimento: 0,
        estoque_fabrica: 0,
    });

    const [novoNomeCor, setNovoNomeCor] = useState("");
    const [novoHexCor, setNovoHexCor] = useState("#000000");

    // Load initial data into form when entering edit mode or when data loads
    const handleEditClick = () => {
        if (material) {
            setFormData({
                nome: material.nome,
                codigo: material.codigo || "",
                preco_custo: material.preco_custo,
                unidade_medida: material.unidade_medida || "",
                estoque_estamparia: material.estoque_estamparia || 0,
                estoque_tingimento: material.estoque_tingimento || 0,
                estoque_fabrica: material.estoque_fabrica || 0,
            });
            setEditMode(true);
        }
    };

    const handleSaveMaterial = () => {
        atualizarMaterial(
            {
                id: materialId,
                ...formData,
            },
            {
                onSuccess: () => setEditMode(false),
            }
        );
    };

    const handleAddCor = (e: React.FormEvent) => {
        e.preventDefault();
        if (!novoNomeCor) return;

        criarCor(
            { material_id: materialId, nome: novoNomeCor, hex: novoHexCor },
            {
                onSuccess: () => {
                    setNovoNomeCor("");
                    setNovoHexCor("#000000");
                },
            }
        );
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!material) {
        return <div className="p-4">Material não encontrado. <Button onClick={onVoltar}>Voltar</Button></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onVoltar}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-bold tracking-tight">
                    {editMode ? "Editar Material" : material.nome}
                </h1>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base font-semibold">Informações Básicas</CardTitle>
                    {!editMode ? (
                        <Button variant="outline" size="sm" onClick={handleEditClick}>
                            Editar
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>Cancelar</Button>
                            <Button size="sm" onClick={handleSaveMaterial} disabled={isUpdating}>
                                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="pt-4">
                    {editMode ? (
                        <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-4">
                                <div className="space-y-2 col-span-1">
                                    <Label>Código</Label>
                                    <Input
                                        value={formData.codigo}
                                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2 col-span-3">
                                    <Label>Nome</Label>
                                    <Input
                                        value={formData.nome}
                                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Preço de Custo</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={formData.preco_custo}
                                        onChange={(e) => setFormData({ ...formData, preco_custo: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Unidade</Label>
                                    <Input
                                        value={formData.unidade_medida}
                                        onChange={(e) => setFormData({ ...formData, unidade_medida: e.target.value })}
                                    />
                                </div>
                            </div>

                            <Separator />
                            <Label className="text-base font-semibold">Estoque</Label>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label className="text-xs">Estamparia</Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        value={formData.estoque_estamparia}
                                        onChange={(e) => setFormData({ ...formData, estoque_estamparia: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Tingimento</Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        value={formData.estoque_tingimento}
                                        onChange={(e) => setFormData({ ...formData, estoque_tingimento: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Fábrica</Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        value={formData.estoque_fabrica}
                                        onChange={(e) => setFormData({ ...formData, estoque_fabrica: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground block">Código</span>
                                    <span className="font-medium font-mono">{material.codigo || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Nome</span>
                                    <span className="font-medium">{material.nome}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Preço de Custo</span>
                                    <span className="font-medium">R$ {material.preco_custo.toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Unidade</span>
                                    <span className="font-medium">{material.unidade_medida || "-"}</span>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold mb-3">Posição de Estoque</h4>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="bg-muted/30 p-3 rounded-md border">
                                        <span className="text-muted-foreground text-xs block uppercase tracking-wider">Estamparia</span>
                                        <span className="text-xl font-bold">{material.estoque_estamparia || 0}</span>
                                        <span className="text-xs text-muted-foreground ml-1">{material.unidade_medida}</span>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-md border">
                                        <span className="text-muted-foreground text-xs block uppercase tracking-wider">Tingimento</span>
                                        <span className="text-xl font-bold">{material.estoque_tingimento || 0}</span>
                                        <span className="text-xs text-muted-foreground ml-1">{material.unidade_medida}</span>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-md border">
                                        <span className="text-muted-foreground text-xs block uppercase tracking-wider">Fábrica</span>
                                        <span className="text-xl font-bold">{material.estoque_fabrica || 0}</span>
                                        <span className="text-xs text-muted-foreground ml-1">{material.unidade_medida}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold">Cores Disponíveis</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cor</TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {material.cores.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                            Nenhuma cor cadastrada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    material.cores.map((cor) => (
                                        <TableRow key={cor.id}>
                                            <TableCell>
                                                <div
                                                    className="w-6 h-6 rounded-full border shadow-sm"
                                                    style={{ backgroundColor: cor.hex || "#fff" }}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{cor.nome}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive/90"
                                                    onClick={() => excluirCor({ id: cor.id, material_id: materialId })}
                                                    disabled={isDeletingCor}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        <form onSubmit={handleAddCor} className="flex gap-4 items-end border-t pt-4">
                            <div className="grid gap-2 flex-1">
                                <Label htmlFor="nomeCor">Nova Cor</Label>
                                <Input
                                    id="nomeCor"
                                    placeholder="Nome da cor (ex: Azul Marinho)"
                                    value={novoNomeCor}
                                    onChange={(e) => setNovoNomeCor(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="grid gap-2 w-[100px]">
                                <Label htmlFor="corHex">Cor</Label>
                                <div className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background p-1">
                                    <input
                                        type="color"
                                        id="corHex"
                                        className="h-full w-full cursor-pointer bg-transparent"
                                        value={novoHexCor}
                                        onChange={(e) => setNovoHexCor(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Button type="submit" disabled={isCreatingCor}>
                                {isCreatingCor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                Adicionar
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
