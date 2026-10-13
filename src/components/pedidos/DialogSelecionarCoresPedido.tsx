import React, { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Palette, Search, Plus, Minus, RotateCcw, Check, ShoppingBag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CorItem {
    codigo: string;
    descricao: string;
}

interface ItemConfirmado {
    produto_id: string;
    produto_nome: string;
    produto_sku?: string;
    cor: string;
    codigo_cor: string;
    quantidade: number;
    preco_unitario: number;
    tipo_desconto: 'percentual' | 'valor';
    desconto: number;
}

interface DialogSelecionarCoresPedidoProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    produtoId: string;
    produtoNome: string;
    produtoSku?: string;
    precoUnitario: number;
    empresaId: string;
    descontoPadraoTipo?: 'percentual' | 'valor';
    descontoPadraoValor?: number;
    itensJaNoPedido?: { cor?: string; quantidade: number }[];
    onConfirmar: (itens: ItemConfirmado[]) => void;
}

export function DialogSelecionarCoresPedido({
    open,
    onOpenChange,
    produtoId,
    produtoNome,
    produtoSku,
    precoUnitario,
    empresaId,
    descontoPadraoTipo = 'percentual',
    descontoPadraoValor = 0,
    itensJaNoPedido = [],
    onConfirmar
}: DialogSelecionarCoresPedidoProps) {
    const [cores, setCores] = useState<CorItem[]>([]);
    const [loadingCores, setLoadingCores] = useState(false);
    const [quantidades, setQuantidades] = useState<Record<string, number>>({});
    const [termoPesquisa, setTermoPesquisa] = useState("");
    const [tipoDesconto, setTipoDesconto] = useState<'percentual' | 'valor'>(descontoPadraoTipo);
    const [valorDesconto, setValorDesconto] = useState<number>(descontoPadraoValor);

    // Carrega cores quando o diálogo for aberto ou o produtoId mudar
    useEffect(() => {
        if (!open || !produtoId) {
            setCores([]);
            setQuantidades({});
            setTermoPesquisa("");
            return;
        }

        setTipoDesconto(descontoPadraoTipo);
        setValorDesconto(descontoPadraoValor || 0);

        let isCancelled = false;

        const carregarCores = async () => {
            setLoadingCores(true);
            try {
                const map = new Map<string, CorItem>();

                // 1. Busca no Supabase produto_cores
                const { data: dbCores, error } = await supabase
                    .from("produto_cores")
                    .select("codigo, descricao")
                    .eq("produto_id", produtoId)
                    .order("codigo");

                if (!error && dbCores) {
                    dbCores.forEach((c: any) => {
                        const desc = (c.descricao || "").trim();
                        if (desc) {
                            map.set(desc.toUpperCase(), {
                                codigo: c.codigo || "",
                                descricao: desc
                            });
                        }
                    });
                }

                // 2. Busca do localStorage produto_cores_${produtoId}
                try {
                    const localCoresStr = localStorage.getItem(`produto_cores_${produtoId}`);
                    if (localCoresStr) {
                        const parsed = JSON.parse(localCoresStr);
                        if (Array.isArray(parsed)) {
                            parsed.forEach((c: any) => {
                                const desc = (c.descricao || c.cor || "").trim();
                                if (desc && !map.has(desc.toUpperCase())) {
                                    map.set(desc.toUpperCase(), {
                                        codigo: c.codigo || "",
                                        descricao: desc
                                    });
                                }
                            });
                        }
                    }
                } catch (e) {}

                // 3. Busca do localStorage estoque_cores_${empresaId}
                if (empresaId) {
                    try {
                        const invStr = localStorage.getItem(`estoque_cores_${empresaId}`);
                        if (invStr) {
                            const inv = JSON.parse(invStr);
                            const prodInv = inv.filter((i: any) => i.produtoId === produtoId);
                            prodInv.forEach((pi: any) => {
                                const desc = (pi.cor || "").trim();
                                if (desc && desc !== "Sem cor definida" && !map.has(desc.toUpperCase())) {
                                    map.set(desc.toUpperCase(), {
                                        codigo: pi.codigoCor || pi.codigo || "",
                                        descricao: desc
                                    });
                                }
                            });
                        }
                    } catch (e) {}
                }

                const lista = Array.from(map.values());
                if (lista.length === 0) {
                    lista.push({ codigo: "-", descricao: "Única" });
                }

                if (!isCancelled) {
                    setCores(lista);
                    setQuantidades({});
                }
            } catch (err) {
                console.error("Erro ao carregar cores do produto:", err);
            } finally {
                if (!isCancelled) {
                    setLoadingCores(false);
                }
            }
        };

        carregarCores();

        return () => {
            isCancelled = true;
        };
    }, [open, produtoId, empresaId, descontoPadraoTipo, descontoPadraoValor]);

    // Filtra as cores com base na pesquisa
    const coresFiltradas = useMemo(() => {
        if (!termoPesquisa.trim()) return cores;
        const termoNorm = termoPesquisa
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

        return cores.filter(c => {
            const descNorm = c.descricao.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const codNorm = (c.codigo || "").toLowerCase();
            return descNorm.includes(termoNorm) || codNorm.includes(termoNorm);
        });
    }, [cores, termoPesquisa]);

    // Map de quantidades já existentes no pedido para cada cor
    const mapJaNoPedido = useMemo(() => {
        const map: Record<string, number> = {};
        itensJaNoPedido.forEach(it => {
            const corKey = (it.cor || "").trim().toUpperCase();
            map[corKey] = (map[corKey] || 0) + (it.quantidade || 0);
        });
        return map;
    }, [itensJaNoPedido]);

    const handleQtdChange = (descricao: string, valorStr: string) => {
        const val = valorStr === "" ? 0 : parseFloat(valorStr.replace(",", "."));
        const valFinal = isNaN(val) || val < 0 ? 0 : val;
        setQuantidades(prev => ({
            ...prev,
            [descricao]: valFinal
        }));
    };

    const handleIncrementar = (descricao: string, delta: number) => {
        setQuantidades(prev => {
            const atual = prev[descricao] || 0;
            const novo = Math.max(0, atual + delta);
            return {
                ...prev,
                [descricao]: novo
            };
        });
    };

    const handleLimparTudo = () => {
        setQuantidades({});
    };

    // Cálculos de totais
    const totalPecas = useMemo(() => {
        return Object.values(quantidades).reduce((acc, q) => acc + (q || 0), 0);
    }, [quantidades]);

    const totalCoresComQtd = useMemo(() => {
        return Object.values(quantidades).filter(q => (q || 0) > 0).length;
    }, [quantidades]);

    const precoComDesconto = useMemo(() => {
        let preco = precoUnitario;
        if (tipoDesconto === 'percentual') {
            preco -= preco * ((valorDesconto || 0) / 100);
        } else {
            preco -= (valorDesconto || 0);
        }
        return Math.max(0, preco);
    }, [precoUnitario, tipoDesconto, valorDesconto]);

    const valorTotalPrevisto = totalPecas * precoComDesconto;

    const handleConfirmar = () => {
        if (totalPecas <= 0) return;

        const itensParaAdicionar: ItemConfirmado[] = [];

        cores.forEach(c => {
            const qtd = quantidades[c.descricao] || 0;
            if (qtd > 0) {
                itensParaAdicionar.push({
                    produto_id: produtoId,
                    produto_nome: produtoNome,
                    produto_sku: produtoSku,
                    cor: c.descricao,
                    codigo_cor: c.codigo && c.codigo !== "-" ? c.codigo : "",
                    quantidade: qtd,
                    preco_unitario: precoUnitario,
                    tipo_desconto: tipoDesconto,
                    desconto: valorDesconto || 0
                });
            }
        });

        onConfirmar(itensParaAdicionar);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl w-[95vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border-slate-300">
                {/* Header estilizado */}
                <DialogHeader className="p-5 pb-4 bg-slate-50/80 border-b border-slate-200 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Palette className="w-5 h-5 text-indigo-600 shrink-0" />
                                <DialogTitle className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                                    Grade de Cores do Produto
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-xs text-slate-600 font-medium">
                                Digite a quantidade desejada em cada cor para adicionar ao pedido.
                            </DialogDescription>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="bg-white text-xs font-mono px-2.5 py-1 text-slate-700 border-slate-300">
                                {produtoSku ? `[${produtoSku}] ` : ""}{produtoNome}
                            </Badge>
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs px-2.5 py-1">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(precoUnitario)} / un.
                            </Badge>
                        </div>
                    </div>

                    {/* Barra de Busca e Desconto da Grade */}
                    <div className="grid grid-cols-12 gap-3 pt-3 mt-2 border-t border-slate-200/60 items-center">
                        <div className="col-span-12 sm:col-span-6 relative">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                            <Input
                                value={termoPesquisa}
                                onChange={e => setTermoPesquisa(e.target.value)}
                                placeholder="Filtrar por nome ou código da cor..."
                                className="pl-9 h-9 text-xs bg-white border-slate-300 focus:border-indigo-500"
                            />
                            {termoPesquisa && (
                                <button
                                    onClick={() => setTermoPesquisa("")}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 text-xs font-bold"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <div className="col-span-6 sm:col-span-3 flex items-center gap-1.5">
                            <Label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Desconto:</Label>
                            <Select value={tipoDesconto} onValueChange={(val: any) => setTipoDesconto(val)}>
                                <SelectTrigger className="h-9 text-xs w-[70px] bg-white border-slate-300">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentual" className="text-xs">%</SelectItem>
                                    <SelectItem value="valor" className="text-xs">R$</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-6 sm:col-span-3">
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={valorDesconto || ""}
                                onChange={e => setValorDesconto(Math.max(0, parseFloat(e.target.value) || 0))}
                                placeholder="0"
                                className="h-9 text-xs bg-white border-slate-300"
                            />
                        </div>
                    </div>
                </DialogHeader>

                {/* Conteúdo com Tabela de Cores */}
                <ScrollArea className="flex-1 max-h-[50vh] min-h-[220px] p-4 bg-slate-50/30">
                    {loadingCores ? (
                        <div className="flex flex-col items-center justify-center py-14 text-slate-500">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                            <span className="text-xs font-medium">Buscando cores do produto...</span>
                        </div>
                    ) : coresFiltradas.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-xs">
                            {termoPesquisa ? `Nenhuma cor encontrada para "${termoPesquisa}".` : "Nenhuma cor cadastrada para este produto."}
                        </div>
                    ) : (
                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                            <Table className="text-xs">
                                <TableHeader className="bg-slate-100/80 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="w-[80px] font-bold text-slate-700">CÓD.</TableHead>
                                        <TableHead className="font-bold text-slate-700">COR</TableHead>
                                        <TableHead className="w-[110px] text-center font-bold text-slate-700">JÁ NO PEDIDO</TableHead>
                                        <TableHead className="w-[180px] text-center font-bold text-indigo-900 bg-indigo-50/50">QUANTIDADE</TableHead>
                                        <TableHead className="w-[120px] text-right font-bold text-slate-700">SUBTOTAL</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {coresFiltradas.map((c) => {
                                        const qtd = quantidades[c.descricao] || 0;
                                        const jaTem = mapJaNoPedido[c.descricao.toUpperCase()] || 0;
                                        const subtotalLinha = qtd * precoComDesconto;
                                        const temQtd = qtd > 0;

                                        return (
                                            <TableRow
                                                key={c.descricao}
                                                className={cn(
                                                    "transition-colors hover:bg-slate-50/80",
                                                    temQtd && "bg-emerald-50/50 hover:bg-emerald-50/70 border-emerald-200"
                                                )}
                                            >
                                                <TableCell className="font-mono text-slate-500 font-semibold">
                                                    {c.codigo && c.codigo !== "-" ? c.codigo : "-"}
                                                </TableCell>
                                                <TableCell className="font-medium text-slate-800">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-400 shrink-0" />
                                                        <span>{c.descricao}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {jaTem > 0 ? (
                                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold text-[10px]">
                                                            {jaTem} un.
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px]">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center p-2">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-7 w-7 rounded border-slate-300 hover:bg-slate-100 text-slate-600"
                                                            onClick={() => handleIncrementar(c.descricao, -1)}
                                                            disabled={qtd <= 0}
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </Button>

                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={qtd > 0 ? qtd : ""}
                                                            onChange={e => handleQtdChange(c.descricao, e.target.value)}
                                                            placeholder="0"
                                                            className={cn(
                                                                "h-8 w-20 text-center font-bold text-xs bg-white border-slate-300 transition-all",
                                                                temQtd && "border-emerald-500 ring-1 ring-emerald-500 text-emerald-800 bg-emerald-50"
                                                            )}
                                                        />

                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-7 w-7 rounded border-slate-300 hover:bg-slate-100 text-slate-600"
                                                            onClick={() => handleIncrementar(c.descricao, 1)}
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-1.5 text-[10px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold"
                                                            onClick={() => handleIncrementar(c.descricao, 10)}
                                                            title="Adicionar +10"
                                                        >
                                                            +10
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-slate-700">
                                                    {subtotalLinha > 0 ? (
                                                        <span className="text-emerald-700">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotalLinha)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 font-normal">R$ 0,00</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </ScrollArea>

                {/* Footer com Resumo em Tempo Real e Botões de Ação */}
                <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600">
                            <ShoppingBag className="w-4 h-4 text-emerald-600" />
                            <span>Total Selecionado:</span>
                            <span className="font-bold text-emerald-700 text-sm">{totalPecas} un.</span>
                            <span className="text-slate-400">({totalCoresComQtd} {totalCoresComQtd === 1 ? 'cor' : 'cores'})</span>
                        </div>

                        {totalPecas > 0 && (
                            <div className="border-l pl-4 border-slate-300 font-bold text-slate-800 text-sm">
                                Total: <span className="text-indigo-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotalPrevisto)}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                        {totalPecas > 0 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleLimparTudo}
                                className="text-slate-500 hover:text-rose-600 text-xs"
                            >
                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Limpar
                            </Button>
                        )}

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-slate-300 text-xs"
                        >
                            Cancelar
                        </Button>

                        <Button
                            type="button"
                            onClick={handleConfirmar}
                            disabled={totalPecas <= 0}
                            className={cn(
                                "font-bold text-xs gap-1.5 transition-all",
                                totalPecas > 0
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                                    : "bg-slate-300 text-slate-500 cursor-not-allowed"
                            )}
                        >
                            <Check className="w-4 h-4" />
                            {totalPecas > 0 ? `Adicionar ${totalPecas} Itens ao Pedido` : "Adicionar ao Pedido"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
