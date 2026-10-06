import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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

interface ImportarProdutosDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface CorImportada {
    codigo: string;
    descricao: string;
}

interface ProdutoImportado {
    sku: string;
    nome: string;
    cores: CorImportada[];
    status: 'pendente' | 'sucesso' | 'erro';
    erro?: string;
    isNovoProduto?: boolean;
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

                const produtosMap = new Map<string, ProdutoImportado>();

                data.forEach((row: any) => {
                    let sku = '';
                    let nome = '';
                    let codigoCor = '';
                    let nomeCor = '';

                    for (const key of Object.keys(row)) {
                        const normalizedKey = key.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        
                        if (normalizedKey === 'artigo' || normalizedKey === 'sku') sku = String(row[key]).trim();
                        if (normalizedKey === 'descricao' || normalizedKey === 'nome') nome = String(row[key]).trim();
                        if (normalizedKey === 'cor' || normalizedKey === 'cod cor' || normalizedKey === 'codigo cor' || normalizedKey === 'codigo') codigoCor = String(row[key]).trim();
                        if (normalizedKey === 'desc cor' || normalizedKey === 'descricao cor' || normalizedKey === 'nome cor') nomeCor = String(row[key]).trim();
                    }

                    if (!sku) return;

                    if (!produtosMap.has(sku)) {
                        produtosMap.set(sku, {
                            sku,
                            nome: nome || 'Produto sem nome',
                            cores: [],
                            status: 'pendente'
                        });
                    }

                    if (nomeCor) {
                        produtosMap.get(sku)!.cores.push({
                            codigo: codigoCor !== 'undefined' ? codigoCor : '',
                            descricao: nomeCor
                        });
                    }
                });

                const produtosMapeados = Array.from(produtosMap.values());

                if (produtosMapeados.length === 0) {
                    toast({
                        title: "Nenhum produto válido",
                        description: "Certifique-se que a planilha tem a coluna 'Artigo' ou 'SKU'.",
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

    const handleImportar = async () => {
        if (produtosParaImportar.length === 0) return;

        setLoading(true);
        let sucessos = 0;
        let erros = 0;
        let coresAdicionadas = 0;
        const novosProdutos = [...produtosParaImportar];

        for (let i = 0; i < novosProdutos.length; i++) {
            const prod = novosProdutos[i];

            try {
                let produtoId;
                const { data: prodExistente, error: checkError } = await supabase
                    .from("produtos")
                    .select("id")
                    .eq("sku", prod.sku)
                    .eq("empresa_id", empresaId!)
                    .maybeSingle();

                if (checkError) throw checkError;

                if (!prodExistente) {
                    const { data: newProd, error: insertError } = await supabase
                        .from("produtos")
                        .insert({
                            nome: prod.nome,
                            sku: prod.sku,
                            empresa_id: empresaId!,
                            ativo: true,
                        })
                        .select("id")
                        .single();

                    if (insertError) throw insertError;
                    produtoId = newProd.id;
                    prod.isNovoProduto = true;
                } else {
                    produtoId = prodExistente.id;
                    prod.isNovoProduto = false;
                }

                if (prod.cores.length > 0) {
                    const { data: coresExistentes } = await supabase
                        .from('produto_cores')
                        .select('descricao, codigo')
                        .eq('produto_id', produtoId);
                    
                    const coresParaInserir = prod.cores.filter(c => 
                        !coresExistentes?.some(ce => ce.descricao.toLowerCase().trim() === c.descricao.toLowerCase().trim())
                    ).map(c => ({
                        produto_id: produtoId,
                        empresa_id: empresaId!,
                        codigo: c.codigo || null,
                        descricao: c.descricao
                    }));

                    if (coresParaInserir.length > 0) {
                        const { error: insertCoresError } = await supabase
                            .from('produto_cores')
                            .insert(coresParaInserir);
                        
                        if (insertCoresError) throw insertCoresError;
                        coresAdicionadas += coresParaInserir.length;
                    }
                }

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
                description: `${sucessos} produtos processados. ${coresAdicionadas} novas cores inseridas. ${erros > 0 ? `${erros} erros.` : ''}`,
                variant: erros > 0 ? "default" : "default",
            });
            queryClient.invalidateQueries({ queryKey: ["produtos"] });

            if (erros === 0) {
                onOpenChange(false);
                resetForm();
            }
        } else {
            toast({
                title: "Erro na importação",
                description: "Nenhum produto foi processado. Verifique os erros na lista.",
                variant: "destructive",
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Importar Produtos via Excel</DialogTitle>
                    <DialogDescription>
                        Envie uma planilha para cadastrar novos produtos ou adicionar cores aos existentes.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col space-y-4 min-h-0">
                    {!file ? (
                        <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center space-y-4 hover:bg-muted/50 transition-colors h-full">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <FileSpreadsheet className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Selecione o arquivo Excel</h3>
                                <p className="text-sm text-muted-foreground">
                                    Formatos suportados: .xlsx, .xls, .csv
                                </p>
                                <div className="mt-4 text-sm text-muted-foreground bg-muted p-4 rounded-md inline-block text-left">
                                    <p><strong>Colunas suportadas:</strong></p>
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li><strong>Artigo</strong> ou <strong>SKU</strong> (Obrigatório)</li>
                                        <li><strong>Descrição</strong> ou <strong>Nome</strong></li>
                                        <li><strong>Cor</strong> (Código da cor)</li>
                                        <li><strong>Desc. Cor</strong> (Nome da cor)</li>
                                    </ul>
                                </div>
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
                        <div className="flex-1 flex flex-col space-y-4 min-h-0 h-full">
                            <div className="flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                    <span className="font-medium">{file.name}</span>
                                    <Badge variant="outline">{produtosParaImportar.length} produtos encontrados</Badge>
                                </div>
                                <Button variant="ghost" size="sm" onClick={resetForm} disabled={loading}>
                                    Trocar arquivo
                                </Button>
                            </div>

                            <ScrollArea className="flex-1 border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Artigo (SKU)</TableHead>
                                            <TableHead>Descrição (Nome)</TableHead>
                                            <TableHead>Qtd. Cores</TableHead>
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
                                                <TableCell className="font-mono text-xs">{prod.sku}</TableCell>
                                                <TableCell className="text-xs truncate max-w-[200px]">
                                                    {prod.nome}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {prod.cores.length > 0 ? (
                                                        <Badge variant="secondary">{prod.cores.length}</Badge>
                                                    ) : '-'}
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
