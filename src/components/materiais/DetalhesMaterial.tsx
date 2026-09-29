import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMaterial, useAtualizarMaterial, useCriarCores, useExcluirCor } from "@/hooks/useMateriais";
import { ArrowLeft, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import * as XLSX from "xlsx";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useRef } from "react";

interface DetalhesMaterialProps {
    materialId: string;
    onVoltar: () => void;
}

export default function DetalhesMaterial({ materialId, onVoltar }: DetalhesMaterialProps) {
    const { data: material, isLoading } = useMaterial(materialId);
    const { mutate: atualizarMaterial, isPending: isUpdating } = useAtualizarMaterial();
    const { mutate: criarCores, isPending: isCreatingCores } = useCriarCores();
    const { mutate: excluirCor, isPending: isDeletingCor } = useExcluirCor();

    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        nome: "",
        codigo: "",
        grupo: "",
        preco_custo: 0,
        unidade_medida: "",
        fator_conversao_pacote: 1,
        estoque_estamparia: 0,
        estoque_tingimento: 0,
        estoque_fabrica: 0,
    });

    const [novoNomeCor, setNovoNomeCor] = useState("");
    const [novoCodigoCor, setNovoCodigoCor] = useState("");
    
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load initial data into form when entering edit mode or when data loads
    const handleEditClick = () => {
        if (material) {
            setFormData({
                nome: material.nome,
                codigo: material.codigo || "",
                grupo: material.grupo || "",
                preco_custo: material.preco_custo || 0,
                unidade_medida: material.unidade_medida || "",
                fator_conversao_pacote: material.fator_conversao_pacote || 1,
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

        // Adiciona uma única cor por vez quando o código é usado, 
        // ou continua permitindo vírgula se não usar código
        const nomes = novoNomeCor.split(",").map(n => n.trim()).filter(n => n.length > 0);

        if (nomes.length === 0) return;

        const novasCores = nomes.map((nome, idx) => ({
            material_id: materialId,
            nome,
            codigo: idx === 0 && nomes.length === 1 ? novoCodigoCor.trim() || null : null,
            hex: "#000000" // Default dummy hex
        }));

        criarCores(
            novasCores,
            {
                onSuccess: () => {
                    setNovoNomeCor("");
                    setNovoCodigoCor("");
                },
            }
        );
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const arrayBuffer = evt.target?.result as ArrayBuffer;
                const wb = XLSX.read(arrayBuffer, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // Converte para JSON
                const data = XLSX.utils.sheet_to_json(ws);
                
                if (data.length === 0) {
                    toast({ title: "Planilha vazia", variant: "destructive" });
                    return;
                }

                // Espera as colunas 'Código' e 'Cor' (ignora maiúsculas/minúsculas e acentos)
                const novasCores = data.map((row: any) => {
                    let nome = null;
                    let codigo = null;
                    
                    for (const key of Object.keys(row)) {
                        const normalizedKey = key.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        
                        if (normalizedKey === 'cor' || normalizedKey === 'nome') {
                            nome = row[key];
                        }
                        if (normalizedKey === 'codigo') {
                            codigo = row[key];
                        }
                    }
                    
                    if (!nome) return null;

                    return {
                        material_id: materialId,
                        nome: String(nome).trim(),
                        codigo: codigo ? String(codigo).trim() : null,
                        hex: "#000000"
                    };
                }).filter(Boolean) as { material_id: string; nome: string; codigo: string | null; hex: string }[];

                if (novasCores.length === 0) {
                    toast({ 
                        title: "Formato inválido", 
                        description: "A planilha precisa ter a coluna 'Cor'. Verifique se o nome da coluna está correto.",
                        variant: "destructive" 
                    });
                    return;
                }

                criarCores(novasCores, {
                    onSuccess: () => {
                        setIsUploadOpen(false);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                    }
                });

            } catch (error) {
                console.error("Erro ao ler planilha:", error);
                toast({ title: "Erro ao ler a planilha", variant: "destructive" });
            }
        };
        reader.readAsArrayBuffer(file);
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
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2 col-span-1">
                                    <Label>Código</Label>
                                    <Input
                                        value={formData.codigo}
                                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <Label>Nome</Label>
                                    <Input
                                        value={formData.nome}
                                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2 col-span-1">
                                    <Label>Grupo</Label>
                                    <Input
                                        value={formData.grupo}
                                        onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
                                        placeholder="Ex: Malha"
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
                                <div className="space-y-2">
                                    <Label>Conv</Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        value={formData.fator_conversao_pacote}
                                        onChange={(e) => setFormData({ ...formData, fator_conversao_pacote: Number(e.target.value) })}
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
                            <div className="grid gap-4 md:grid-cols-5 text-sm">
                                <div>
                                    <span className="text-muted-foreground block">Código</span>
                                    <span className="font-medium font-mono">{material.codigo || "-"}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-muted-foreground block">Nome</span>
                                    <span className="font-medium">{material.nome}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Grupo</span>
                                    <span className="font-medium">{material.grupo || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Preço de Custo</span>
                                    <span className="font-medium">R$ {(material.preco_custo || 0).toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Unidade / Conv</span>
                                    <span className="font-medium">{material.unidade_medida || "-"} (x{material.fator_conversao_pacote})</span>
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
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-base font-semibold">Cores Disponíveis</CardTitle>
                    
                    <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Upload className="h-4 w-4 mr-2" />
                                Importar Excel
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Importar Cores via Planilha</DialogTitle>
                                <DialogDescription>
                                    Para que a importação funcione corretamente, a sua planilha Excel (.xlsx) deve conter a coluna <strong>Cor</strong>. 
                                    <br /><br />
                                    Você também pode incluir a coluna <strong>Código</strong>, caso as cores possuam um.
                                    <br /><br />
                                    <strong>Exemplo de cabeçalho (primeira linha):</strong>
                                    <br />
                                    <span className="font-mono bg-muted p-1 rounded text-xs mt-2 inline-block">Código | Cor</span>
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg mt-4">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                />
                                <Button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isCreatingCores}
                                >
                                    {isCreatingCores ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                                    Selecionar Arquivo
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px]">Código</TableHead>
                                    <TableHead>Cor</TableHead>
                                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {material.cores.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center text-muted-foreground h-24">
                                            Nenhuma cor cadastrada.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    material.cores.map((cor) => (
                                        <TableRow key={cor.id}>
                                            <TableCell className="font-mono text-sm">{cor.codigo || "-"}</TableCell>
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

                        <form onSubmit={handleAddCor} className="flex gap-4 items-start border-t pt-4">
                            <div className="grid gap-2 w-[150px]">
                                <Label htmlFor="codigoCor">Código (Opcional)</Label>
                                <Input
                                    id="codigoCor"
                                    placeholder="Ex: 050010"
                                    value={novoCodigoCor}
                                    onChange={(e) => setNovoCodigoCor(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2 flex-1">
                                <Label htmlFor="nomeCor">Nome da Cor</Label>
                                <Input
                                    id="nomeCor"
                                    placeholder="Digite a cor (Ex: Azul Piscina)"
                                    value={novoNomeCor}
                                    onChange={(e) => setNovoNomeCor(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-muted-foreground">Separe por vírgula para adicionar várias cores sem código.</p>
                            </div>
                            <Button type="submit" disabled={isCreatingCores} className="mt-6">
                                {isCreatingCores ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                Adicionar
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}
