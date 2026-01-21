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

interface ImportarColaboradoresDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ColaboradorImportado {
    nome: string;
    funcao?: string;
    custo_por_hora?: number;
    custo_hora_extra?: number;
    status: 'pendente' | 'sucesso' | 'erro';
    erro?: string;
}

export default function ImportarColaboradoresDialog({
    open,
    onOpenChange,
}: ImportarColaboradoresDialogProps) {
    const empresaId = useEmpresaId();
    const queryClient = useQueryClient();
    const [colaboradoresParaImportar, setColaboradoresParaImportar] = useState<ColaboradorImportado[]>([]);
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const resetForm = () => {
        setColaboradoresParaImportar([]);
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

                // Read as array of arrays to find the header row
                const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (rawData.length === 0) {
                    toast({
                        title: "Arquivo vazio",
                        description: "Não foram encontrados dados na planilha.",
                        variant: "destructive",
                    });
                    setLoading(false);
                    return;
                }

                // Normalização de chaves para facilitar busca (apenas letras e números, minúsculo)
                const normalizeKey = (key: any) => String(key || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

                // Helper parsing function
                const parseCurrency = (value: any): number => {
                    if (typeof value === 'number') return value;
                    if (!value) return 0;

                    const stringValue = String(value);
                    // Remove currency symbols (R$, $), whitespace, and keep numbers, commas and dots
                    const cleanString = stringValue.replace(/[^\d.,]/g, '').trim();

                    if (!cleanString) return 0;

                    // If it has ',' assume it is decimal separator if it appears once or is the last separator
                    // Simple approach: replace ',' with '.'
                    return parseFloat(cleanString.replace(',', '.')) || 0;
                };

                // Find header row (first row that contains "nome", "colaborador" or "funcionario")
                let headerRowIndex = -1;
                let headerMap: Record<string, number> = {}; // Normalized Column Name -> Index

                for (let i = 0; i < rawData.length; i++) {
                    const row = rawData[i];
                    const foundName = row.some(cell => {
                        const cellNorm = normalizeKey(cell);
                        return cellNorm.includes('nome') || cellNorm.includes('colaborador') || cellNorm.includes('funcionario');
                    });

                    if (foundName) {
                        headerRowIndex = i;
                        // Map headers
                        row.forEach((cell, idx) => {
                            if (cell) {
                                headerMap[normalizeKey(cell)] = idx;
                            }
                        });
                        console.log("Cabeçalho encontrado na linha:", i, "Colunas:", Object.keys(headerMap));
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    // Fallback: Assume first row is header if we couldn't find one
                    headerRowIndex = 0;
                    rawData[0].forEach((cell, idx) => {
                        if (cell) headerMap[normalizeKey(cell)] = idx;
                    });
                    console.log("Cabeçalho não identificado automaticamente. Usando primeira linha.", Object.keys(headerMap));
                }

                // Process data rows (starting after header)
                const mapeados: ColaboradorImportado[] = [];

                for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (!row || row.length === 0) continue;

                    // Helper to get value by list of possible keys
                    const getValue = (keys: string[]) => {
                        for (const key of keys) {
                            const idx = headerMap[key];
                            if (idx !== undefined && row[idx] !== undefined) return row[idx];
                        }
                        return undefined;
                    };

                    const nome = getValue(['nome', 'colaborador', 'funcionario', 'name']) || '';
                    if (!nome || String(nome).trim() === '') continue;

                    const funcao = getValue(['cargo', 'funcao', 'funçao', 'role', 'job']) || '';

                    const custoHoraRaw = getValue(['custohora', 'custoporhora', 'valorhora', 'custo', 'salariohora', 'horanormal', 'custonormal', 'valor', 'hora']);
                    const custoExtraRaw = getValue(['custoextra', 'custohoraextra', 'valorhoraextra', 'horaextra', 'valorextra', 'custoextra2', 'extra']);

                    mapeados.push({
                        nome: String(nome),
                        funcao: String(funcao),
                        custo_por_hora: parseCurrency(custoHoraRaw),
                        custo_hora_extra: parseCurrency(custoExtraRaw),
                        status: 'pendente' as const
                    });
                }

                console.log("Dados processados:", mapeados);

                if (mapeados.length === 0) {
                    toast({
                        title: "Nenhum dado válido",
                        description: "Certifique-se que a planilha tem uma coluna 'Nome'.",
                        variant: "destructive",
                    });
                }

                setColaboradoresParaImportar(mapeados);
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
        if (colaboradoresParaImportar.length === 0) return;

        setLoading(true);
        let sucessos = 0;
        let erros = 0;
        const novos = [...colaboradoresParaImportar];

        for (let i = 0; i < novos.length; i++) {
            const item = novos[i];

            if (item.status === 'sucesso') continue;

            try {
                const { error } = await supabase
                    .from("colaboradores")
                    .insert({
                        nome: item.nome,
                        funcao: item.funcao, // Saving role/function
                        custo_por_hora: item.custo_por_hora,
                        custo_hora_extra: item.custo_hora_extra,
                        empresa_id: empresaId,
                        ativo: true,
                    });

                if (error) throw error;

                novos[i].status = 'sucesso';
                sucessos++;
            } catch (error: any) {
                console.error(`Erro ao importar ${item.nome}:`, error);
                novos[i].status = 'erro';
                novos[i].erro = error.message;
                erros++;
            }
        }

        setColaboradoresParaImportar(novos);
        setLoading(false);

        if (sucessos > 0) {
            toast({
                title: "Importação concluída",
                description: `${sucessos} colaboradores importados com sucesso. ${erros > 0 ? `${erros} erros.` : ''}`,
                variant: "default",
            });
            queryClient.invalidateQueries({ queryKey: ["colaboradores"] });

            if (erros === 0) {
                onOpenChange(false);
                resetForm();
            }
        } else {
            toast({
                title: "Erro na importação",
                description: "Nenhum colaborador foi importado.",
                variant: "destructive",
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Importar Colaboradores via Excel</DialogTitle>
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
                                    Colunas esperadas: <strong>Nome</strong>, Cargo, Custo Hora, Custo Extra
                                </p>
                            </div>
                            <Input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                                id="file-upload-colab"
                                onChange={handleFileUpload}
                            />
                            <Button asChild>
                                <Label htmlFor="file-upload-colab" className="cursor-pointer">
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
                                    <Badge variant="outline">{colaboradoresParaImportar.length} encontrados</Badge>
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
                                            <TableHead>Cargo</TableHead>
                                            <TableHead>Custo/Hora</TableHead>
                                            <TableHead>Custo Extra</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {colaboradoresParaImportar.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    {item.status === 'pendente' && <Badge variant="outline">Pendente</Badge>}
                                                    {item.status === 'sucesso' && <Badge className="bg-green-500 hover:bg-green-600">OK</Badge>}
                                                    {item.status === 'erro' && (
                                                        <div className="flex items-center text-red-500 text-xs" title={item.erro}>
                                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                                            Erro
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>{item.nome}</TableCell>
                                                <TableCell>{item.funcao || '-'}</TableCell>
                                                <TableCell>R$ {item.custo_por_hora?.toFixed(2)}</TableCell>
                                                <TableCell>R$ {item.custo_hora_extra?.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>

                            <div className="flex justify-end pt-2">
                                <Button onClick={handleImportar} disabled={loading || colaboradoresParaImportar.length === 0}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="mr-2 h-4 w-4" />
                                            Importar {colaboradoresParaImportar.filter(p => p.status === 'pendente').length} Colaboradores
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
