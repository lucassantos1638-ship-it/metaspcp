import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import * as XLSX from "xlsx";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportarMateriaisDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface MaterialImportado {
    codigo?: string;
    nome: string;
    preco_custo?: number;
    unidade_medida?: string;
    status: 'pendente' | 'sucesso' | 'erro';
    erro?: string;
}

export default function ImportarMateriaisDialog({
    open,
    onOpenChange,
}: ImportarMateriaisDialogProps) {
    const empresaId = useEmpresaId();
    const queryClient = useQueryClient();
    const [materiaisParaImportar, setMateriaisParaImportar] = useState<MaterialImportado[]>([]);
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const resetForm = () => {
        setMateriaisParaImportar([]);
        setFile(null);
        setLoading(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setLoading(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    toast({
                        title: "Arquivo vazio",
                        description: "Não foram encontrados dados na planilha.",
                        variant: "destructive",
                    });
                    setLoading(false);
                    return;
                }

                // Mapear dados
                const materiaisMapeados: MaterialImportado[] = data.map((row: any) => ({
                    codigo: row['Código'] || row['Codigo'] || row['CODIGO'] || row['cod'] || row['COD'] || undefined,
                    nome: row['Nome'] || row['nome'] || row['NOME'] || row['Descrição'] || row['Descricao'] || '',
                    preco_custo: Number(row['Preço Custo'] || row['preco_custo'] || row['Custo'] || row['Preço'] || 0),
                    unidade_medida: row['Unidade'] || row['unidade'] || row['UM'] || 'un',
                    status: 'pendente'
                })).filter(p => p.nome && p.nome.trim() !== '');

                const materiaisTipados: MaterialImportado[] = materiaisMapeados.map(m => ({
                    ...m,
                    status: 'pendente' as 'pendente' | 'sucesso' | 'erro'
                }));

                if (materiaisTipados.length === 0) {
                    toast({
                        title: "Nenhum material válido",
                        description: "Certifique-se que a planilha tem colunas como 'Nome' ou 'Descrição'.",
                        variant: "destructive",
                    });
                }

                setMateriaisParaImportar(materiaisTipados);
            } catch (error) {
                console.error("Erro ao ler arquivo:", error);
                toast({
                    title: "Erro ao ler arquivo",
                    description: "Verifique se o arquivo é um Excel válido.",
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleImportar = async () => {
        if (materiaisParaImportar.length === 0) return;

        setLoading(true);
        let sucessos = 0;
        let erros = 0;
        const novosMateriais = [...materiaisParaImportar];

        for (let i = 0; i < novosMateriais.length; i++) {
            const mat = novosMateriais[i];

            if (mat.status === 'sucesso') continue;

            try {
                const { error } = await supabase
                    .from("materiais")
                    .insert({
                        codigo: mat.codigo,
                        nome: mat.nome,
                        preco_custo: mat.preco_custo || 0,
                        unidade_medida: mat.unidade_medida,
                        empresa_id: empresaId,
                        ativo: true,
                    });

                if (error) throw error;

                novosMateriais[i].status = 'sucesso';
                sucessos++;
            } catch (error: any) {
                console.error(`Erro ao importar ${mat.nome}:`, error);
                novosMateriais[i].status = 'erro';
                novosMateriais[i].erro = error.message;
                erros++;
            }
        }

        setMateriaisParaImportar(novosMateriais);
        setLoading(false);

        if (sucessos > 0) {
            toast({
                title: "Importação concluída",
                description: `${sucessos} materiais importados com sucesso.`,
            });
            queryClient.invalidateQueries({ queryKey: ["materiais"] });

            if (erros === 0) {
                onOpenChange(false);
                resetForm();
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Importar Materiais via Excel</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {!file ? (
                        <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center space-y-4 hover:bg-muted/50 transition-colors">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <FileSpreadsheet className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Selecione o arquivo Excel</h3>
                                <p className="text-sm text-muted-foreground">
                                    Formatos suportados: .xlsx, .xls, .csv
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Colunas: <strong>Código</strong>, <strong>Nome/Descrição</strong>, <strong>Preço Custo</strong>, <strong>Unidade</strong>
                                </p>
                            </div>
                            <Input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                                id="file-upload-mat"
                                onChange={handleFileUpload}
                            />
                            <Button asChild>
                                <Label htmlFor="file-upload-mat" className="cursor-pointer">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Carregar Planilha
                                </Label>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                    <span className="font-medium">{file.name}</span>
                                    <Badge variant="outline">{materiaisParaImportar.length} itens</Badge>
                                </div>
                                <Button variant="ghost" size="sm" onClick={resetForm} disabled={loading}>
                                    Trocar arquivo
                                </Button>
                            </div>

                            <ScrollArea className="h-[400px] border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Código</TableHead>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Unidade</TableHead>
                                            <TableHead>Custo</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materiaisParaImportar.map((mat, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    {mat.status === 'pendente' && <Badge variant="outline">Pendente</Badge>}
                                                    {mat.status === 'sucesso' && <Badge className="bg-green-500 hover:bg-green-600">OK</Badge>}
                                                    {mat.status === 'erro' && (
                                                        <div className="flex items-center text-red-500 text-xs" title={mat.erro}>
                                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                                            Erro
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{mat.codigo || '-'}</TableCell>
                                                <TableCell>{mat.nome}</TableCell>
                                                <TableCell>{mat.unidade_medida}</TableCell>
                                                <TableCell>R$ {mat.preco_custo?.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>

                            <div className="flex justify-end pt-2">
                                <Button onClick={handleImportar} disabled={loading || materiaisParaImportar.length === 0}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            Importar
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
