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

interface ImportarCoresDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface CorImportada {
    artigo: string;
    nomeProduto: string;
    corCodigo: string;
    corDescricao: string;
    status: 'pendente' | 'sucesso' | 'erro' | 'produto_nao_encontrado';
    erro?: string;
    produtoId?: string;
}

export default function ImportarCoresDialog({
    open,
    onOpenChange,
}: ImportarCoresDialogProps) {
    const empresaId = useEmpresaId();
    const queryClient = useQueryClient();
    const [coresParaImportar, setCoresParaImportar] = useState<CorImportada[]>([]);
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const resetForm = () => {
        setCoresParaImportar([]);
        setFile(null);
        setLoading(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setLoading(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                // Try reading with generic headers to see if we can parse standard CSV
                let data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    toast({
                        title: "Arquivo vazio",
                        description: "Não foram encontrados dados na planilha.",
                        variant: "destructive",
                    });
                    setLoading(false);
                    return;
                }

                // If it's a raw csv with semicolon, we might need to handle it differently, 
                // but usually XLSX handles it if imported properly, or we can check keys
                const firstRow: any = data[0];
                const keys = Object.keys(firstRow);
                let isSemicolonCsv = false;
                if (keys.length === 1 && keys[0].includes(';')) {
                  // Fallback for CSV with semicolon not parsed correctly
                  data = data.map((row: any) => {
                    const rowKey = Object.keys(row)[0];
                    const values = row[rowKey].split(';');
                    const headers = keys[0].split(';');
                    const obj: any = {};
                    headers.forEach((h, i) => obj[h.trim()] = values[i] ? values[i].trim() : '');
                    return obj;
                  });
                }

                // Mapear dados
                const coresMapeadas: CorImportada[] = data.map((row: any) => {
                    // Adapt field names mapping according to the expected CSV structure
                    const artigo = row['Artigo'] || row['artigo'] || row['ARTIGO'] || '';
                    const nomeProduto = row['Descrio'] || row['Descrição'] || row['descricao'] || row['Descricao'] || row['Nome'] || '';
                    const corCodigo = String(row['Cor'] || row['cor'] || row['COR'] || '');
                    const corDescricao = row['Desc. Cor'] || row['Desc Cor'] || row['desc. cor'] || row['Descricao Cor'] || row['Descrição da Cor'] || '';

                    return {
                        artigo: String(artigo).trim(),
                        nomeProduto: String(nomeProduto).trim(),
                        corCodigo: String(corCodigo).trim(),
                        corDescricao: String(corDescricao).trim(),
                        status: 'pendente' as const
                    };
                }).filter(p => p.artigo !== '' && p.corCodigo !== ''); // Ignorar linhas vazias

                if (coresMapeadas.length === 0) {
                    toast({
                        title: "Nenhum dado válido",
                        description: "Certifique-se que a planilha tem as colunas 'Artigo' e 'Cor'.",
                        variant: "destructive",
                    });
                    setLoading(false);
                    return;
                }

                // Pré-validar os produtos no banco para ver se o NOME existe
                const nomesProdutos = Array.from(new Set(coresMapeadas.map(c => c.nomeProduto)));
                
                // Fetch todos os produtos da empresa
                const { data: produtosExistentes, error: errProdutos } = await supabase
                    .from('produtos')
                    .select('id, nome')
                    .eq('empresa_id', empresaId);

                if (errProdutos) throw errProdutos;

                const nomeToIdMap = new Map<string, string>();
                produtosExistentes?.forEach(p => {
                    nomeToIdMap.set(p.nome.trim().toLowerCase(), p.id);
                });

                const coresComStatus = coresMapeadas.map(c => {
                    const nomeKey = c.nomeProduto.toLowerCase();
                    const prodId = nomeToIdMap.get(nomeKey);
                    if (prodId) {
                        return { ...c, produtoId: prodId };
                    } else {
                        return { ...c, status: 'produto_nao_encontrado' as const, erro: 'Produto não encontrado pelo Nome' };
                    }
                });

                setCoresParaImportar(coresComStatus);
            } catch (error) {
                console.error("Erro ao ler arquivo:", error);
                toast({
                    title: "Erro ao ler arquivo",
                    description: "Verifique se o arquivo é um Excel ou CSV válido.",
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleImportar = async () => {
        if (coresParaImportar.length === 0) return;

        setLoading(true);
        let sucessos = 0;
        let erros = 0;
        const novasCores = [...coresParaImportar];

        for (let i = 0; i < novasCores.length; i++) {
            const cor = novasCores[i];

            if (cor.status === 'produto_nao_encontrado' || cor.status === 'sucesso') {
                if (cor.status === 'produto_nao_encontrado') erros++;
                continue;
            }

            try {
                // Verificar se a cor já existe para o produto
                const { data: corExistente } = await supabase
                    .from('produto_cores')
                    .select('id')
                    .eq('produto_id', cor.produtoId!)
                    .eq('codigo', cor.corCodigo)
                    .maybeSingle();

                if (corExistente) {
                    // Update
                    const { error } = await supabase
                        .from('produto_cores')
                        .update({
                            descricao: cor.corDescricao
                        })
                        .eq('id', corExistente.id);

                    if (error) throw error;
                } else {
                    // Insert
                    const { error } = await supabase
                        .from('produto_cores')
                        .insert({
                            produto_id: cor.produtoId!,
                            codigo: cor.corCodigo,
                            descricao: cor.corDescricao,
                            empresa_id: empresaId
                        });

                    if (error) throw error;
                }

                novasCores[i].status = 'sucesso';
                sucessos++;
            } catch (error: any) {
                console.error(`Erro ao importar cor ${cor.corCodigo} para produto ${cor.nomeProduto}:`, error);
                novasCores[i].status = 'erro';
                novasCores[i].erro = error.message;
                erros++;
            }
        }

        setCoresParaImportar(novasCores);
        setLoading(false);

        if (sucessos > 0) {
            toast({
                title: "Importação concluída",
                description: `${sucessos} cores processadas com sucesso. ${erros > 0 ? `${erros} erros ignorados.` : ''}`,
            });
            queryClient.invalidateQueries({ queryKey: ["produtos"] });

            if (erros === 0) {
                onOpenChange(false);
                resetForm();
            }
        } else {
            toast({
                title: "Erro na importação",
                description: "Nenhuma cor foi processada. Verifique os erros.",
                variant: "destructive",
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-none">
                    <DialogTitle>Importar Cores de Produtos</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                    {!file ? (
                        <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center space-y-4 hover:bg-muted/50 transition-colors">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <FileSpreadsheet className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Selecione o arquivo CSV/Excel</h3>
                                <p className="text-sm text-muted-foreground">
                                    Formatos suportados: .xlsx, .xls, .csv
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Colunas esperadas: <strong>Artigo</strong>, <strong>Cor</strong>, <strong>Desc. Cor</strong>, Descrio (opcional)
                                </p>
                            </div>
                            <Input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                                id="file-upload-cores"
                                onChange={handleFileUpload}
                            />
                            <Button asChild>
                                <Label htmlFor="file-upload-cores" className="cursor-pointer">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Carregar Planilha
                                </Label>
                            </Button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col gap-4 min-h-0">
                            <div className="flex items-center justify-between flex-none">
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                    <span className="font-medium">{file.name}</span>
                                    <Badge variant="outline">{coresParaImportar.length} linhas encontradas</Badge>
                                </div>
                                <Button variant="ghost" size="sm" onClick={resetForm} disabled={loading}>
                                    Trocar arquivo
                                </Button>
                            </div>

                            <ScrollArea className="flex-1 border rounded-md min-h-[300px]">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Artigo (SKU)</TableHead>
                                            <TableHead>Produto</TableHead>
                                            <TableHead>Código Cor</TableHead>
                                            <TableHead>Desc. Cor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {coresParaImportar.map((cor, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    {cor.status === 'pendente' && <Badge variant="outline">Pronto</Badge>}
                                                    {cor.status === 'sucesso' && <Badge className="bg-green-500 hover:bg-green-600">OK</Badge>}
                                                    {cor.status === 'produto_nao_encontrado' && (
                                                        <div className="flex items-center text-orange-500 text-xs" title="Produto não encontrado pelo Nome">
                                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                                            Não enc.
                                                        </div>
                                                    )}
                                                    {cor.status === 'erro' && (
                                                        <div className="flex items-center text-red-500 text-xs" title={cor.erro}>
                                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                                            Erro
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{cor.artigo}</TableCell>
                                                <TableCell className="text-xs truncate max-w-[200px]" title={cor.nomeProduto}>{cor.nomeProduto}</TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {cor.corCodigo}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">
                                                    {cor.corDescricao}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>

                            <div className="flex justify-end pt-2 flex-none border-t border-border mt-2">
                                <Button 
                                    onClick={handleImportar} 
                                    disabled={loading || coresParaImportar.length === 0 || coresParaImportar.every(c => c.status === 'produto_nao_encontrado' || c.status === 'sucesso')}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            Importar {coresParaImportar.filter(c => c.status === 'pendente').length} Cores
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
