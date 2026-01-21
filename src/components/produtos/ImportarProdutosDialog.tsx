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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useGerarSku } from "@/hooks/useProdutos";

interface ImportarProdutosDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ProdutoImportado {
    nome: string;
    sku?: string;
    descricao?: string;
    status: 'pendente' | 'sucesso' | 'erro';
    erro?: string;
}

export default function ImportarProdutosDialog({
    open,
    onOpenChange,
}: ImportarProdutosDialogProps) {
    const empresaId = useEmpresaId();
    const queryClient = useQueryClient();
    const [produtosParaImportar, setProdutosParaImportar] = useState<ProdutoImportado[]>([]);
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const resetForm = () => {
        setProdutosParaImportar([]);
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
                const produtosMapeados: ProdutoImportado[] = data.map((row: any) => ({
                    nome: row['Nome'] || row['nome'] || row['NOME'] || '',
                    sku: row['SKU'] || row['sku'] || undefined,
                    descricao: row['Descrição'] || row['descricao'] || row['Descricao'] || undefined,
                    status: 'pendente'
                })).filter(p => p.nome.trim() !== ''); // Ignorar linhas sem nome

                if (produtosMapeados.length === 0) {
                    toast({
                        title: "Nenhum produto válido",
                        description: "Certifique-se que a planilha tem uma coluna chamada 'Nome'.",
                        variant: "destructive",
                    });
                }

                setProdutosParaImportar(produtosMapeados);
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

    const gerarSkuAuto = () => {
        // Função auxiliar simples para caso não venha SKU
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    const handleImportar = async () => {
        if (produtosParaImportar.length === 0) return;

        setLoading(true);
        let sucessos = 0;
        let erros = 0;
        const novosProdutos = [...produtosParaImportar];

        for (let i = 0; i < novosProdutos.length; i++) {
            const prod = novosProdutos[i];

            try {
                // Gerar SKU se não existir
                const skuParaSalvar = prod.sku || gerarSkuAuto();

                const { error } = await supabase
                    .from("produtos")
                    .insert({
                        nome: prod.nome,
                        sku: skuParaSalvar,
                        descricao: prod.descricao,
                        empresa_id: empresaId,
                        ativo: true,
                    });

                if (error) throw error;

                novosProdutos[i].status = 'sucesso';
                sucessos++;
            } catch (error: any) {
                console.error(`Erro ao importar ${prod.nome}:`, error);
                novosProdutos[i].status = 'erro';
                novosProdutos[i].erro = error.message;
                erros++;
            }
        }

        setProdutosParaImportar(novosProdutos);
        setLoading(false);

        if (sucessos > 0) {
            toast({
                title: "Importação concluída",
                description: `${sucessos} produtos importados com sucesso. ${erros > 0 ? `${erros} erros.` : ''}`,
                variant: erros > 0 ? "default" : "default", // Ajustar variante se necessário
            });
            queryClient.invalidateQueries({ queryKey: ["produtos"] });

            // Se tudo deu certo, fechar
            if (erros === 0) {
                onOpenChange(false);
                resetForm();
            }
        } else {
            toast({
                title: "Erro na importação",
                description: "Nenhum produto foi importado. Verifique os erros na lista.",
                variant: "destructive",
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Importar Produtos via Excel</DialogTitle>
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
                                    Colunas esperadas: <strong>Nome</strong>, SKU (opcional), Descrição (opcional)
                                </p>
                            </div>
                            <Input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                                id="file-upload"
                                onChange={handleFileUpload}
                            />
                            <Button asChild>
                                <Label htmlFor="file-upload" className="cursor-pointer">
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
                                    <Badge variant="outline">{produtosParaImportar.length} produtos encontrados</Badge>
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
                                            <TableHead>Nome</TableHead>
                                            <TableHead>SKU</TableHead>
                                            <TableHead>Descrição</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {produtosParaImportar.map((prod, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    {prod.status === 'pendente' && <Badge variant="outline">Pendente</Badge>}
                                                    {prod.status === 'sucesso' && <Badge className="bg-green-500 hover:bg-green-600">OK</Badge>}
                                                    {prod.status === 'erro' && (
                                                        <div className="flex items-center text-red-500 text-xs" title={prod.erro}>
                                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                                            Erro
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>{prod.nome}</TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {prod.sku || <em>Auto-gerar</em>}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {prod.descricao || '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>

                            <div className="flex justify-end pt-2">
                                <Button onClick={handleImportar} disabled={loading || produtosParaImportar.length === 0}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            Importar {produtosParaImportar.filter(p => p.status === 'pendente').length} Produtos
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
