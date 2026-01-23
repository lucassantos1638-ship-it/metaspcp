import { useState, useMemo } from "react";
import { useProjecoes } from "@/hooks/useProjecoes";
import { useProgramacaoMateriais } from "@/hooks/useProgramacao";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Printer, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Programacao() {
    const [open, setOpen] = useState(false);
    const [mesesSelecionados, setMesesSelecionados] = useState<string[]>([]);
    const [mesesParaConsulta, setMesesParaConsulta] = useState<string[]>([]);

    const { data: projecoes } = useProjecoes();
    const {
        data: materiaisNecessarios,
        isLoading: isLoadingMateriais,
        refetch
    } = useProgramacaoMateriais(mesesParaConsulta);

    // Extrair meses únicos disponíveis das projeções
    const mesesDisponiveis = useMemo(() => {
        if (!projecoes) return [];

        const mesesSet = new Set<string>();
        projecoes.forEach(p => {
            const mes = format(parseISO(p.data_referencia), "yyyy-MM");
            mesesSet.add(mes);
        });

        return Array.from(mesesSet)
            .sort((a, b) => b.localeCompare(a)) // Decrescente
            .map(mes => ({
                value: mes,
                label: format(parseISO(mes + "-01"), "MMMM yyyy", { locale: ptBR })
            }));
    }, [projecoes]);

    const toggleMes = (mesValue: string) => {
        setMesesSelecionados(current =>
            current.includes(mesValue)
                ? current.filter(m => m !== mesValue)
                : [...current, mesValue]
        );
    };

    const handleConsultar = () => {
        setMesesParaConsulta(mesesSelecionados);
        // Pequeno timeout para garantir que o estado atualize antes do refetch se for a mesma seleção
        setTimeout(() => {
            refetch();
        }, 0);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 max-w-7xl mx-auto p-6 no-print">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Programação de Materiais (MRP)</h1>
                    <p className="text-muted-foreground mt-1">
                        Planejamento de necessidade de matéria-prima baseado nas projeções.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtrar Período</CardTitle>
                    <CardDescription>Selecione os meses de referência para o cálculo.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-[300px] justify-between"
                            >
                                {mesesSelecionados.length === 0
                                    ? "Selecione os meses..."
                                    : `${mesesSelecionados.length} meses selecionados`}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Buscar mês..." />
                                <CommandList>
                                    <CommandEmpty>Nenhum mês encontrado.</CommandEmpty>
                                    <CommandGroup>
                                        {mesesDisponiveis.map((mes) => (
                                            <CommandItem
                                                key={mes.value}
                                                value={mes.value}
                                                onSelect={() => toggleMes(mes.value)}
                                            >
                                                <div
                                                    className={cn(
                                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                        mesesSelecionados.includes(mes.value)
                                                            ? "bg-primary text-primary-foreground"
                                                            : "opacity-50 [&_svg]:invisible"
                                                    )}
                                                >
                                                    <Check className={cn("h-4 w-4")} />
                                                </div>
                                                <span className="capitalize">{mes.label}</span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {mesesSelecionados.map(mesValue => {
                            const mesLabel = mesesDisponiveis.find(m => m.value === mesValue)?.label;
                            return (
                                <Badge key={mesValue} variant="secondary" className="capitalize">
                                    {mesLabel}
                                    <button
                                        className="ml-2 hover:text-destructive"
                                        onClick={() => toggleMes(mesValue)}
                                    >
                                        ×
                                    </button>
                                </Badge>
                            )
                        })}
                    </div>

                    <div className="mt-4 flex justify-end">
                        <Button onClick={handleConsultar} disabled={mesesSelecionados.length === 0}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Consultar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {mesesParaConsulta.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Necessidade de Materiais</CardTitle>
                        <CardDescription>
                            Comparativo entre necessidade de produção e estoque atual.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingMateriais ? (
                            <div className="py-8 text-center text-muted-foreground">Calculando...</div>
                        ) : !materiaisNecessarios || materiaisNecessarios.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                Nenhum material necessário encontrado para o período selecionado.
                                <br />Tente clicar em "Consultar" novamente para atualizar.
                            </div>
                        ) : (
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[80px]">Código</TableHead>
                                            <TableHead className="min-w-[200px]">Material</TableHead>
                                            <TableHead>Unidade</TableHead>
                                            <TableHead className="text-right bg-muted/30">Necessidade</TableHead>
                                            <TableHead className="text-right text-xs text-muted-foreground">Est. Estamparia</TableHead>
                                            <TableHead className="text-right text-xs text-muted-foreground">Est. Tingimento</TableHead>
                                            <TableHead className="text-right text-xs text-muted-foreground">Est. Fábrica</TableHead>
                                            <TableHead className="text-right text-xs font-semibold text-blue-600 bg-blue-50/50">Est. Prod. (Mat)</TableHead>
                                            <TableHead className="text-right text-xs font-semibold text-orange-600 bg-orange-50/50">Em Prod. (Mat)</TableHead>
                                            <TableHead className="text-right font-semibold">Total Estoque</TableHead>
                                            <TableHead className="text-right bg-blue-50 dark:bg-blue-950 font-bold border-l-2 border-blue-200">A Comprar</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {materiaisNecessarios.map((material) => {
                                            // Total includes Raw Material Stock + Product Stock Credit + WIP Credit
                                            const totalEstoque = (material.estoque_estamparia || 0) + (material.estoque_tingimento || 0) + (material.estoque_fabrica || 0);
                                            const credits = (material.estoque_produto_credit || 0) + (material.producao_produto_credit || 0);

                                            // A Comprar = Necessidade - (Estoque MP + Creditos)
                                            // Or strictly what the user asked: "pegar a quantidade que precisa e diminuir o que voce já tem"
                                            const aComprar = Math.max(0, material.quantidade_total - totalEstoque - credits);

                                            // Highlight row if purchase is needed
                                            const rowClass = aComprar > 0 ? "bg-red-50/50 dark:bg-red-900/10" : "";

                                            return (
                                                <TableRow key={material.id} className={rowClass}>
                                                    <TableCell className="font-mono text-xs">{material.codigo || "-"}</TableCell>
                                                    <TableCell className="font-medium">{material.nome}</TableCell>
                                                    <TableCell>{material.unidade_medida || "un"}</TableCell>
                                                    <TableCell className="text-right font-semibold bg-muted/30">
                                                        {material.quantidade_total.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                                    </TableCell>

                                                    <TableCell className="text-right text-muted-foreground">
                                                        {material.estoque_estamparia?.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) || "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        {material.estoque_tingimento?.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) || "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        {material.estoque_fabrica?.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) || "-"}
                                                    </TableCell>

                                                    <TableCell className="text-right text-blue-600 font-medium bg-blue-50/30">
                                                        {material.estoque_produto_credit?.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) || "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right text-orange-600 font-medium bg-orange-50/30">
                                                        {material.producao_produto_credit?.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) || "-"}
                                                    </TableCell>

                                                    <TableCell className="text-right font-medium">
                                                        {(totalEstoque + credits).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                                    </TableCell>

                                                    <TableCell className={`text-right font-bold text-lg border-l-2 border-blue-200 bg-blue-50 dark:bg-blue-950 ${aComprar > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                                                        {aComprar.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Print Styles */}
            <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>

            <div className="hidden print:block p-8">
                <h1 className="text-2xl font-bold mb-4">Relatório de Necessidade de Materiais</h1>
                <p className="mb-6">Período: {mesesParaConsulta.map(m => format(parseISO(m + "-01"), "MM/yyyy")).join(", ")}</p>

                <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 p-2 text-left">Código</th>
                            <th className="border border-gray-300 p-2 text-left">Material</th>
                            <th className="border border-gray-300 p-2 text-left">Unidade</th>
                            <th className="border border-gray-300 p-2 text-right">Necessidade</th>
                            <th className="border border-gray-300 p-2 text-right">Est. Total</th>
                            <th className="border border-gray-300 p-2 text-right font-bold bg-gray-200">A Comprar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {materiaisNecessarios?.map((material) => {
                            const totalEstoque = (material.estoque_estamparia || 0) + (material.estoque_tingimento || 0) + (material.estoque_fabrica || 0);
                            const aComprar = Math.max(0, material.quantidade_total - totalEstoque);

                            return (
                                <tr key={material.id}>
                                    <td className="border border-gray-300 p-2 font-mono text-xs">{material.codigo || "-"}</td>
                                    <td className="border border-gray-300 p-2">{material.nome}</td>
                                    <td className="border border-gray-300 p-2">{material.unidade_medida || "un"}</td>
                                    <td className="border border-gray-300 p-2 text-right">
                                        {material.quantidade_total.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="border border-gray-300 p-2 text-right">
                                        {(totalEstoque + ((material.estoque_produto_credit || 0) + (material.producao_produto_credit || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="border border-gray-300 p-2 text-right font-bold bg-gray-50">
                                        {aComprar.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                <div className="mt-8 text-sm text-gray-500">
                    Gerado em {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
            </div>
        </div>
    );
}

