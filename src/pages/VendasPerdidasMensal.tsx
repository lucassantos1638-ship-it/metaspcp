import { useParams, useNavigate } from "react-router-dom";
import { useVendasPerdidas } from "@/hooks/useVendasPerdidas";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Package, Maximize2, Minimize2, Printer, ChevronRight } from "lucide-react";
import { format, parseISO, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarCusto } from "@/lib/custoUtils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import DetalhesVendaPerdidaDialog from "@/components/vendas-perdidas/DetalhesVendaPerdidaDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function VendasPerdidasMensal() {
    const { usuarioId, mes } = useParams();
    const navigate = useNavigate();
    const { data: vendas, isLoading } = useVendasPerdidas();
    const [dialogDetalhesOpen, setDialogDetalhesOpen] = useState(false);
    const [vendaSelecionada, setVendaSelecionada] = useState<any>(null);
    const [expandido, setExpandido] = useState(false);

    const listaFiltrada = useMemo(() => {
        if (!vendas || !usuarioId || !mes) return [];
        const [ano, mesNum] = mes.split("-");
        const targetDate = new Date(Number(ano), Number(mesNum) - 1, 1);

        return vendas.filter((p: any) => {
            if (p.usuario_id !== usuarioId) return false;
            const pDate = parseISO(p.data_referencia);
            return isSameMonth(pDate, targetDate);
        });
    }, [vendas, usuarioId, mes]);

    const usuarioNome = listaFiltrada[0]?.usuario_nome || "Usuário";
    const [ano, mesNum] = (mes || "").split("-");
    const dataMes = new Date(Number(ano), Number(mesNum) - 1, 1);

    // Calculate Summary
    const resumoProdutos = useMemo(() => {
        const resumo: any = {};

        listaFiltrada.forEach((venda: any) => {
            venda.itens?.forEach((item: any) => {
                const prodId = item.produto_id;
                if (!prodId) return;

                if (!resumo[prodId]) {
                    resumo[prodId] = {
                        produto: item.produto?.nome || "Desconhecido",
                        sku: item.produto?.sku,
                        quantidade: 0,
                        valorTotal: 0,
                        valorCpf: 0,
                        valorCnpj: 0
                    };
                }

                const qtd = Number(item.quantidade) || 0;
                const valorUn = Number(item.valor_unitario) || 0;
                const total = qtd * valorUn;

                resumo[prodId].quantidade += qtd;
                resumo[prodId].valorTotal += total;

                if (venda.tabela_preco === 'cnpj') {
                    resumo[prodId].valorCnpj += total;
                } else {
                    resumo[prodId].valorCpf += total;
                }
            });
        });

        return Object.values(resumo).sort((a: any, b: any) => b.valorTotal - a.valorTotal);
    }, [listaFiltrada]);

    // Calculate Grand Totals
    const totaisGerais = useMemo(() => {
        return resumoProdutos.reduce((acc: any, item: any) => {
            acc.quantidade += item.quantidade;
            acc.valorCpf += item.valorCpf;
            acc.valorCnpj += item.valorCnpj;
            acc.valorTotal += item.valorTotal;
            return acc;
        }, { quantidade: 0, valorCpf: 0, valorCnpj: 0, valorTotal: 0 } as any);
    }, [resumoProdutos]);


    const handleAbrirDetalhes = (venda: any) => {
        setVendaSelecionada(venda);
        setDialogDetalhesOpen(true);
    };

    const handleImprimir = () => {
        window.print();
    };

    if (isLoading) {
        return <div className="space-y-4 p-8">
            <Skeleton className="h-10 w-48" />
            <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
        </div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] -m-8 p-8 overflow-hidden gap-6 bg-background">
            <style>
                {`
                    @media print {
                        @page { margin: 1cm; size: landscape; }
                        body * { visibility: hidden; }
                        #resumo-section, #resumo-section * { visibility: visible; }
                        #resumo-section { position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index: 9999; margin: 0; padding: 0; border: none; overflow: visible; }
                        .no-print { display: none !important; }
                        .scroll-area-print { height: auto !important; overflow: visible !important; }
                    }
                `}
            </style>

            <div className="flex items-center gap-4 shrink-0 no-print">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/vendas-perdidas/${usuarioId}`)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{format(dataMes, "MMMM yyyy", { locale: ptBR })}</h2>
                    <p className="text-muted-foreground">Resumo de Vendas Perdidas - {usuarioNome}</p>
                </div>
            </div>

            {/* Top Section: Summary Table */}
            <div
                id="resumo-section"
                className={`
                    ${expandido ? 'flex-1 h-full' : 'basis-1/2'} 
                    overflow-hidden border rounded-lg bg-card shadow-sm flex flex-col transition-all duration-300
                `}
            >
                <div className="hidden print:block p-4 mb-2 text-center border-b">
                    <h1 className="text-xl font-bold uppercase">{format(dataMes, "MMMM yyyy", { locale: ptBR })} - Vendas Perdidas</h1>
                    <p className="text-lg font-medium text-gray-800">{usuarioNome}</p>
                </div>
                <div className="p-3 border-b bg-muted/20 font-semibold text-sm flex justify-between items-center shrink-0 print:hidden">
                    <span>Resumo Geral de Produtos (Vendas Perdidas)</span>
                    <div className="flex gap-2 no-print">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleImprimir} title="Imprimir / Salvar PDF">
                            <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpandido(!expandido)} title={expandido ? "Restaurar" : "Expandir"}>
                            {expandido ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto scroll-area-print">
                    <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow>
                                <TableHead className="w-24">SKU</TableHead>
                                <TableHead>Produto</TableHead>
                                <TableHead className="text-right">Qtd Total</TableHead>
                                <TableHead className="text-right">Total CPF</TableHead>
                                <TableHead className="text-right">Total CNPJ</TableHead>
                                <TableHead className="text-right">Total Geral</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {resumoProdutos.map((item: any) => (
                                <TableRow key={item.sku || item.produto}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">{item.sku || '-'}</TableCell>
                                    <TableCell className="font-medium">
                                        {item.produto}
                                    </TableCell>
                                    <TableCell className="text-right font-bold">{item.quantidade}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{formatarCusto(item.valorCpf)}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{formatarCusto(item.valorCnpj)}</TableCell>
                                    <TableCell className="text-right font-bold text-destructive">{formatarCusto(item.valorTotal)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {/* Footer Totals */}
                <div className="p-3 border-t bg-muted/20 flex justify-between items-center text-sm font-bold shrink-0">
                    <span>Totais Perdidos</span>
                    <div className="flex gap-8">
                        <span>{totaisGerais.quantidade} peças</span>
                        <span className="text-muted-foreground">CPF: {formatarCusto(totaisGerais.valorCpf)}</span>
                        <span className="text-muted-foreground">CNPJ: {formatarCusto(totaisGerais.valorCnpj)}</span>
                        <span className="text-destructive text-base">Total: {formatarCusto(totaisGerais.valorTotal)}</span>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Sales List */}
            <div className={`basis-1/2 overflow-hidden flex flex-col gap-2 no-print ${expandido ? 'hidden' : ''}`}>
                <h3 className="font-semibold text-lg shrink-0">Registros Individuais</h3>
                <ScrollArea className="flex-1 border rounded-lg bg-card p-0">
                    <div className="flex flex-col">
                        {listaFiltrada.map((venda: any) => {
                            const vendaTotal = venda.itens?.reduce((acc: number, item: any) => acc + (item.quantidade * item.valor_unitario), 0) || 0;
                            const vendaItens = venda.itens?.reduce((acc: number, item: any) => acc + item.quantidade, 0) || 0;

                            return (
                                <div
                                    key={venda.id}
                                    className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors group"
                                    onClick={() => handleAbrirDetalhes(venda)}
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{venda.cliente_nome}</span>
                                            <Badge variant="outline" className="bg-muted uppercase text-[10px] h-5 px-1">
                                                {venda.tabela_preco}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <Package className="h-3 w-3" />
                                                {Math.round(vendaItens)} peças
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="font-bold text-base text-destructive">{formatarCusto(vendaTotal)}</div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>
                            );
                        })}
                        {listaFiltrada.length === 0 && (
                            <div className="py-10 text-center text-muted-foreground">
                                Nenhuma venda perdida encontrada.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {vendaSelecionada && (
                <DetalhesVendaPerdidaDialog
                    open={!!vendaSelecionada}
                    onOpenChange={(open) => !open && setVendaSelecionada(null)}
                    venda={vendaSelecionada}
                />
            )}
        </div>
    );
}
