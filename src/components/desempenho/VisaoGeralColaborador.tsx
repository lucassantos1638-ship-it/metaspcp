import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, Package } from "lucide-react";
import { format, getDaysInMonth, startOfMonth, endOfMonth, getDay, isSameDay, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarMoeda, cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Função auxiliar
const formatarTempo = (minutos: number) => {
    const h = Math.floor(minutos / 60);
    const m = Math.floor(minutos % 60);
    return `${h}h ${m}min`;
};

interface VisaoGeralColaboradorProps {
    colaboradores: any[];
    empresaId: string | null;
}

export function VisaoGeralColaborador({ colaboradores, empresaId }: VisaoGeralColaboradorProps) {
    const [colaboradorId, setColaboradorId] = useState<string>("");
    
    // Mes atual como padrao (YYYY-MM)
    const [mesAno, setMesAno] = useState<string>(format(new Date(), "yyyy-MM"));
    
    const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null);

    const year = parseInt(mesAno.split("-")[0]);
    const month = parseInt(mesAno.split("-")[1]) - 1; // 0-indexed
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = endOfMonth(firstDayOfMonth);
    const daysInMonth = getDaysInMonth(firstDayOfMonth);
    const startingDayOfWeek = getDay(firstDayOfMonth); // 0 (Sun) to 6 (Sat)
    
    const dataInicioStr = format(firstDayOfMonth, "yyyy-MM-dd");
    const dataFimStr = format(lastDayOfMonth, "yyyy-MM-dd");

    // Buscar Produções do Colaborador no Mês
    const { data: producoes, isLoading } = useQuery({
        queryKey: ["producoes-visao-geral", empresaId, colaboradorId, mesAno],
        enabled: !!empresaId && !!colaboradorId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("producoes")
                .select(`
                    *,
                    lote:lotes(numero_lote, nome_lote, produto_id),
                    etapa:etapas(nome, ordem),
                    subetapa:subetapas(nome),
                    atividade:atividades(nome),
                    pedido:pedidos(id, numero, entidade(nome))
                `)
                .eq("empresa_id", empresaId)
                .eq("colaborador_id", colaboradorId)
                .gte("data_inicio", dataInicioStr)
                .lte("data_inicio", dataFimStr);

            if (error) throw error;
            return data || [];
        }
    });

    const colaborador = colaboradores.find(c => c.id === colaboradorId);
    
    // Processar produções por dia
    const producoesPorDia = useMemo(() => {
        const mapa = new Map<string, any[]>();
        if (!producoes) return mapa;
        
        producoes.forEach(prod => {
            if (!prod.data_inicio) return;
            // prod.data_inicio format is "YYYY-MM-DD" mostly
            const dateKey = prod.data_inicio.substring(0, 10);
            if (!mapa.has(dateKey)) {
                mapa.set(dateKey, []);
            }
            mapa.get(dateKey)!.push(prod);
        });
        
        return mapa;
    }, [producoes]);

    // Resumo do Mês
    const resumoMes = useMemo(() => {
        let qtd = 0;
        let minNormais = 0;
        let minExtras = 0;
        
        const loteIdsPrimeiraEtapa = new Set<string>();

        if (producoes) {
            producoes.forEach(prod => {
                const n = prod.minutos_normais || 0;
                const e = prod.minutos_extras || 0;
                minNormais += n;
                minExtras += e;
                
                const isPrimeiraEtapa = (prod.etapa as any)?.ordem === 1;
                const loteId = prod.lote_id;
                
                if (isPrimeiraEtapa && loteId) {
                    if (!loteIdsPrimeiraEtapa.has(loteId)) {
                        qtd += (prod.quantidade_produzida || 0);
                        loteIdsPrimeiraEtapa.add(loteId);
                    }
                } else if (!isPrimeiraEtapa) {
                    qtd += (prod.quantidade_produzida || 0);
                }
            });
        }
        
        const custoHoraNormal = Number(colaborador?.custo_por_hora || 0);
        const custoHoraExtra = Number(colaborador?.custo_hora_extra || 0);
        
        const custoTotal = ((minNormais / 60) * custoHoraNormal) + ((minExtras / 60) * custoHoraExtra);

        return {
            qtd, minNormais, minExtras, tempoTotal: minNormais + minExtras, custoTotal
        };
    }, [producoes, colaborador]);

    // Gerar grid do calendário
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(<div key={`empty-${i}`} className="h-24 md:h-32 bg-muted/20 border border-border/50 rounded-md"></div>);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dateKey = format(date, "yyyy-MM-dd");
        const prodsDia = producoesPorDia.get(dateKey) || [];
        
        // Calcular tempo do dia
        const minDia = prodsDia.reduce((acc, p) => acc + (p.minutos_normais || 0) + (p.minutos_extras || 0), 0);
        
        days.push(
            <div 
                key={d} 
                onClick={() => prodsDia.length > 0 && setDiaSelecionado(date)}
                className={cn(
                    "h-24 md:h-32 border border-border rounded-md p-2 flex flex-col transition-colors overflow-hidden",
                    isSameDay(date, new Date()) ? "border-primary bg-primary/5" : "bg-card",
                    prodsDia.length > 0 ? "cursor-pointer hover:border-primary/50 hover:bg-muted" : "opacity-80"
                )}
            >
                <div className="flex justify-between items-center mb-1">
                    <span className={cn(
                        "text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                        isSameDay(date, new Date()) ? "bg-primary text-primary-foreground" : ""
                    )}>
                        {d}
                    </span>
                    {minDia > 0 && (
                        <span className="text-xs font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded">
                            {formatarTempo(minDia)}
                        </span>
                    )}
                </div>
                
                <div className="flex flex-col gap-1 overflow-y-auto scrollbar-thin flex-1 mt-1">
                    {prodsDia.slice(0, 3).map((p, idx) => (
                        <div key={idx} className="text-[10px] leading-tight truncate px-1.5 py-1 bg-muted rounded">
                            {p.atividade ? (p.atividade as any).nome : p.pedido_id ? `Pedido` : p.lote?.numero_lote || "Lote"}
                        </div>
                    ))}
                    {prodsDia.length > 3 && (
                        <div className="text-[10px] font-medium text-muted-foreground px-1">
                            +{prodsDia.length - 3} mais
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Modal data
    const selectedDateKey = diaSelecionado ? format(diaSelecionado, "yyyy-MM-dd") : "";
    const prodsModal = diaSelecionado ? (producoesPorDia.get(selectedDateKey) || []) : [];

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-3 items-end">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Colaborador</label>
                            <Select value={colaboradorId} onValueChange={setColaboradorId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um colaborador" />
                                </SelectTrigger>
                                <SelectContent>
                                    {colaboradores.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Mês / Ano</label>
                            <input 
                                type="month" 
                                value={mesAno}
                                onChange={(e) => setMesAno(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {colaboradorId && (
                <>
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Horas Trabalhadas (Mês)</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatarTempo(resumoMes.tempoTotal)}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Normal: {formatarTempo(resumoMes.minNormais)} | Extra: {formatarTempo(resumoMes.minExtras)}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Produção Total (Mês)</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{resumoMes.qtd} un</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Custo Estimado (Mês)</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{formatarMoeda(resumoMes.custoTotal)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Valor Hora</CardTitle>
                                <DollarSign className="h-4 w-4 text-purple-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg font-bold">Base: {formatarMoeda(Number(colaborador?.custo_por_hora || 0))}/h</div>
                                <div className="text-sm text-muted-foreground">Extra: {formatarMoeda(Number(colaborador?.custo_hora_extra || 0))}/h</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="capitalize">{format(firstDayOfMonth, "MMMM 'de' yyyy", { locale: ptBR })}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center p-8 text-muted-foreground">Carregando calendário...</div>
                            ) : (
                                <div>
                                    <div className="grid grid-cols-7 gap-2 mb-2 text-center text-sm font-medium text-muted-foreground">
                                        <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
                                    </div>
                                    <div className="grid grid-cols-7 gap-2">
                                        {days}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            <Dialog open={!!diaSelecionado} onOpenChange={(open) => !open && setDiaSelecionado(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Atividades de {diaSelecionado && format(diaSelecionado, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="mt-4 px-2">
                        {prodsModal.sort((a, b) => (a.hora_inicio || "").localeCompare(b.hora_inicio || "")).map((prod, idx) => {
                             const minN = prod.minutos_normais || 0;
                             const minE = prod.minutos_extras || 0;
                             const subetapaStr = (prod.subetapa as any)?.nome ? ` - ${(prod.subetapa as any).nome}` : "";
                             const titulo = prod.atividade ? (prod.atividade as any).nome : prod.pedido_id ? `Pedido ${(prod.pedido as any)?.numero || ''}` : `${prod.lote?.numero_lote || ''} - ${prod.etapa?.nome || ''}${subetapaStr}`;
                             
                             return (
                                <div key={idx} className="relative pl-6 pb-6">
                                    {/* Linha vertical */}
                                    {idx !== prodsModal.length - 1 && (
                                        <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border"></div>
                                    )}
                                    {/* Bolinha do timeline */}
                                    <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full bg-primary ring-4 ring-background z-10"></div>
                                    
                                    <div className="bg-muted/40 rounded-lg border border-border p-3 ml-2 hover:bg-muted/60 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-semibold text-primary text-sm flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5" />
                                                {prod.hora_inicio?.substring(0, 5)} {prod.hora_fim ? `até ${prod.hora_fim.substring(0, 5)}` : ''}
                                            </div>
                                            <div className="text-sm font-bold text-foreground bg-background px-2 py-0.5 rounded shadow-sm border border-border bg-gradient-to-br from-background to-muted">
                                                {formatarTempo(minN + minE)}
                                            </div>
                                        </div>
                                        
                                        <div className="mt-2 text-sm font-medium">
                                            {titulo}
                                        </div>
                                        
                                        {prod.quantidade_produzida > 0 && (
                                            <div className="text-xs text-muted-foreground mt-2 font-medium bg-background inline-block px-2 py-1 rounded shadow-sm border border-border/50">
                                                Quantidade: {prod.quantidade_produzida} un
                                            </div>
                                        )}
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
