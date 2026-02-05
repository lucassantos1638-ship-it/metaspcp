import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, PackageOpen, Pencil, FileSpreadsheet, Trash2 } from "lucide-react";
import { useMateriais, useToggleAtivoMaterial, useExcluirMaterial } from "@/hooks/useMateriais";
import CadastroMaterialDialog from "@/components/materiais/CadastroMaterialDialog";
import DetalhesMaterial from "@/components/materiais/DetalhesMaterial";
import ImportarMateriaisDialog from "@/components/materiais/ImportarMateriaisDialog";

export default function Materiais() {
    const [busca, setBusca] = useState("");
    const [dialogCadastroOpen, setDialogCadastroOpen] = useState(false);
    const [dialogImportarOpen, setDialogImportarOpen] = useState(false);
    const [materialSelecionado, setMaterialSelecionado] = useState<string | null>(null);

    const { data: materiais, isLoading } = useMateriais();
    const toggleAtivo = useToggleAtivoMaterial();
    const excluirMaterial = useExcluirMaterial();

    const materiaisFiltrados = materiais?.filter((m) =>
        m.nome.toLowerCase().includes(busca.toLowerCase())
    );

    if (materialSelecionado) {
        return (
            <DetalhesMaterial
                materialId={materialSelecionado}
                onVoltar={() => setMaterialSelecionado(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Materiais</h1>
                    <p className="text-muted-foreground">
                        Gerencie matérias-primas e suas cores
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDialogImportarOpen(true)}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Importar
                    </Button>
                    <Button onClick={() => setDialogCadastroOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Material
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar material..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                    ))}
                </div>
            ) : materiaisFiltrados && materiaisFiltrados.length > 0 ? (
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Unidade</TableHead>
                                <TableHead>Custo</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {materiaisFiltrados.map((material) => (
                                <TableRow
                                    key={material.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => setMaterialSelecionado(material.id)}
                                >
                                    <TableCell className="font-mono text-xs text-muted-foreground">{material.codigo || "-"}</TableCell>
                                    <TableCell className="font-medium">{material.nome}</TableCell>
                                    <TableCell>{material.unidade_medida}</TableCell>
                                    <TableCell>R$ {material.preco_custo.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={material.ativo ? "default" : "secondary"}
                                            className={`h-5 text-[10px] px-1.5 ${material.ativo
                                                ? "bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-100/80 border-gray-200"
                                                }`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleAtivo.mutate({ id: material.id, ativo: !material.ativo });
                                            }}
                                        >
                                            {material.ativo ? "Ativo" : "Inativo"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm("Tem certeza que deseja excluir este material?")) {
                                                    excluirMaterial.mutate(material.id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-12 border rounded-md bg-muted/10">
                    <PackageOpen className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Nenhum material encontrado</p>
                    <p className="text-sm text-muted-foreground">
                        Comece cadastrando sua primeira matéria-prima
                    </p>
                </div>
            )}

            <CadastroMaterialDialog
                open={dialogCadastroOpen}
                onOpenChange={setDialogCadastroOpen}
            />
            <ImportarMateriaisDialog
                open={dialogImportarOpen}
                onOpenChange={setDialogImportarOpen}
            />
        </div>
    );
}
