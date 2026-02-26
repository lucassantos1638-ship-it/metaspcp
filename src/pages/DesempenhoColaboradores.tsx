import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Search, DollarSign, Clock, Package, Printer, ChevronDown, ChevronRight, Check } from "lucide-react";
import { format, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { formatarMoeda } from "@/lib/utils";

// Função auxiliar para formatar tempo (minutos -> HH:mm)
const formatarTempo = (minutos: number) => {
    const h = Math.floor(minutos / 60);
    const m = Math.floor(minutos % 60);
    return `${h}h ${m}min`;
};

function SearchableSelect({
    value,
    onValueChange,
    options,
    placeholder,
    disabled
}: {
    value: string;
    onValueChange: (val: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal bg-background"
                    disabled={disabled}
                >
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Pesquisar..." />
                    <CommandList>
                        <CommandEmpty>Nenhum resultado.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onValueChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default function DesempenhoColaboradores() {
    console.log("DesempenhoColaboradores component mounted");
    const empresaId = useEmpresaId();
    const [colaboradorId, setColaboradorId] = useState<string>("");
    const [dataInicio, setDataInicio] = useState<Date | undefined>(new Date());
    const [dataFim, setDataFim] = useState<Date | undefined>(new Date());
    const [loteId, setLoteId] = useState<string>("all");
    const [produtoId, setProdutoId] = useState<string>("all");
    const [etapaId, setEtapaId] = useState<string>("all");
    const [subetapaId, setSubetapaId] = useState<string>("all");
    const [tipoFiltro, setTipoFiltro] = useState<string>("all"); // all, producao, atividade
    const [atividadeId, setAtividadeId] = useState<string>("all");
    const [filtrosAplicados, setFiltrosAplicados] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (id: string) => {
        setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Buscar Colaboradores
    const { data: colaboradores } = useQuery({
        queryKey: ["colaboradores-desempenho", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("colaboradores")
                .select("id, nome, custo_por_hora, custo_hora_extra")
                .eq("empresa_id", empresaId)
                .eq("ativo", true)
                .order("nome");

            if (error) throw error;
            return data;
        },
    });

    // Buscar Atividades Avulsas
    const { data: atividades } = useQuery({
        queryKey: ["atividades-desempenho", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("atividades")
                .select("id, nome")
                .eq("empresa_id", empresaId)
                .eq("ativo", true)
                .order("nome");
            if (error) throw error;
            return data;
        },
    });

    // Buscar Lotes
    const { data: lotes } = useQuery({
        queryKey: ["lotes-desempenho", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("lotes")
                .select(`
                    id, 
                    numero_lote,
                    produto_id,
                    produto:produtos(nome)
                `)
                .eq("empresa_id", empresaId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data;
        },
    });

    // Filtra lotes baseado no produto selecionado
    const lotesFiltrados = lotes?.filter(l =>
        produtoId === "all" || (l.produto && (l as any).produto_id)
    );

    // Buscar Produtos
    const { data: produtos } = useQuery({
        queryKey: ["produtos-desempenho", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("produtos")
                .select("id, nome")
                .eq("empresa_id", empresaId)
                .eq("ativo", true)
                .order("nome");
            if (error) throw error;
            return data;
        },
    });

    // Buscar Etapas
    const { data: etapas } = useQuery({
        queryKey: ["etapas-desempenho", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("etapas")
                .select("id, nome")
                .eq("empresa_id", empresaId)
                .order("nome");
            if (error) throw error;
            return data;
        },
    });

    // Buscar Subetapas (se etapa selecionada ou todas)
    const { data: subetapas } = useQuery({
        queryKey: ["subetapas-desempenho", empresaId, etapaId],
        enabled: !!empresaId,
        queryFn: async () => {
            let query = supabase
                .from("subetapas")
                .select("id, nome, etapa_id")
                .eq("empresa_id", empresaId)
                .order("nome");

            if (etapaId !== "all") {
                query = query.eq("etapa_id", etapaId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
    });

    // Query Principal de Produção
    const { data: producoes, isLoading, refetch } = useQuery({
        queryKey: ["producoes-desempenho", empresaId, colaboradorId, dataInicio, dataFim, loteId, produtoId, etapaId, subetapaId, tipoFiltro, atividadeId],
        enabled: false, // Só busca quando clicar em Consultar
        queryFn: async () => {
            if (!colaboradorId) return [];

            let query = supabase
                .from("producoes")
                .select(`
                *,
                lote:lotes(numero_lote, nome_lote, produto_id),
                etapa:etapas(nome, ordem),
                subetapa:subetapas(nome),
                atividade:atividades(nome)
            `)
                .eq("empresa_id", empresaId)
                .eq("colaborador_id", colaboradorId);

            const fromStr = format(dataInicio, "yyyy-MM-dd");
            const toStr = format(dataFim, "yyyy-MM-dd");
            console.log(`Buscando produções de colaboradorId: ${colaboradorId} entre ${fromStr} e ${toStr}`);

            if (dataInicio) {
                query = query.gte("data_inicio", fromStr);
            }
            if (dataFim) {
                query = query.lte("data_inicio", `${toStr} 23:59:59`);
            }

            // Filtro por Tipo (Produção vs Atividade)
            if (tipoFiltro === "producao") {
                // Se for produção, TEM que ter lote_id (ou não ter atividade_id, dependendo da regra de negócio, mas lote_id é mais seguro para "Produção")
                // Como lote_id pode ser null em atividades, verificamos se activity_id IS NULL
                query = query.is("atividade_id", null);
            } else if (tipoFiltro === "atividade") {
                // Se for atividade, TEM que ter atividade_id
                query = query.not("atividade_id", "is", null);
            }

            // Filtro por Atividade Específica
            if (atividadeId && atividadeId !== "all") {
                query = query.eq("atividade_id", atividadeId);
            }

            console.log("Query URL e params processados...", { fromStr, toStr, tipoFiltro, atividadeId });
            const { data, error } = await query;
            if (error) {
                console.error("Erro na busca de produções:", error);
                throw error;
            }
            console.log("Dados retornados da busca:", data?.length);

            // Filtro de Lote no Client Side se preenchido e não for "all"
            let filteredData = data;

            if (produtoId && produtoId !== "all") {
                filteredData = filteredData?.filter(p => p.lote?.produto_id === produtoId) || [];
            }

            if (loteId && loteId !== "all") {
                filteredData = filteredData?.filter(p => p.lote_id === loteId) || [];
            }

            if (etapaId && etapaId !== "all") {
                filteredData = filteredData?.filter(p => p.etapa_id === etapaId) || [];
            }

            if (subetapaId && subetapaId !== "all") {
                filteredData = filteredData?.filter(p => p.subetapa_id === subetapaId) || [];
            }

            return filteredData;
        }
    });

    const handleConsultar = () => {
        if (colaboradorId) {
            setFiltrosAplicados(true);
            refetch();
        }
    };

    const grupos = useMemo(() => {
        if (!producoes || !colaboradores || !colaboradorId) return [];
        const colaborador = colaboradores.find(c => c.id === colaboradorId);
        const custoHoraNormal = Number((colaborador as any)?.custo_por_hora || 0);
        const custoHoraExtra = Number((colaborador as any)?.custo_hora_extra || 0);

        const map = new Map<string, any>();
        const lotesPorGrupo = new Map<string, Map<string, number>>(); // Controlar max qtd de Lote por Grupo

        producoes.forEach(prod => {
            const isAvulsa = !!prod.atividade;
            const key = isAvulsa
                ? `atividade_${prod.atividade_id}`
                : `etapa_${prod.etapa_id}_subetapa_${prod.subetapa_id || 'null'}`;

            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    isAvulsa,
                    titulo: isAvulsa
                        ? (prod.atividade as any).nome
                        : `${(prod.etapa as any)?.nome} ${(prod.subetapa as any) ? `↳ ${(prod.subetapa as any).nome}` : ''}`,
                    items: [],
                    qtd: 0,
                    minutosNormais: 0,
                    minutosExtras: 0,
                    custoNormal: 0,
                    custoExtra: 0,
                });
                lotesPorGrupo.set(key, new Map());
            }

            const grupo = map.get(key);
            grupo.items.push(prod);

            // Regra da Primeira Etapa: a quantidade inteira do lote repete em cada lanca de tempo parcial
            // Entao usamos somente a "MAX" quantidade daquele lote, em vez de somar (apenas na Etapa 1)
            const isPrimeiraEtapa = (prod.etapa as any)?.ordem === 1;
            const loteId = prod.lote_id;
            const qtdLancamento = prod.quantidade_produzida || 0;

            if (isPrimeiraEtapa && loteId) {
                const maxDoLoteParaEsteGrupo = lotesPorGrupo.get(key)!.get(loteId) || 0;
                if (qtdLancamento > maxDoLoteParaEsteGrupo) {
                    lotesPorGrupo.get(key)!.set(loteId, qtdLancamento);
                }
            } else {
                grupo.qtd += qtdLancamento;
            }

            const minNormais = (prod as any).minutos_normais || 0;
            const minExtras = (prod as any).minutos_extras || 0;
            grupo.minutosNormais += minNormais;
            grupo.minutosExtras += minExtras;

            grupo.custoNormal += (minNormais / 60) * custoHoraNormal;
            grupo.custoExtra += (minExtras / 60) * custoHoraExtra;
        });

        // Somar as "MÁXIMAS quantidades dos Lotes" para cada grupo se for a Etapa 1
        for (const [key, lotesMap] of lotesPorGrupo.entries()) {
            const grupo = map.get(key);
            let totalLotesPrimeira = 0;
            for (const maxQtd of lotesMap.values()) {
                totalLotesPrimeira += maxQtd;
            }
            grupo.qtd += totalLotesPrimeira;
        }

        // Ordenar por qtd maior primeiro ou titulo
        return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
    }, [producoes, colaboradores, colaboradorId]);

    // Cálculos de Totais
    const totais = useMemo(() => {
        if (!producoes || !colaboradores || !colaboradorId) return null;

        const colaborador = colaboradores?.find(c => c.id === colaboradorId);
        const custoHoraNormal = Number((colaborador as any)?.custo_por_hora || 0);
        const custoHoraExtra = Number((colaborador as any)?.custo_hora_extra || 0);

        let qtdProduzida = 0;
        let tempoNormal = 0;
        let tempoExtra = 0;
        let custoTotal = 0;
        let custoExtraTotal = 0;
        let custoNormalTotal = 0;

        const lotesPrimeiraEtapaGeral = new Map<string, number>();

        producoes.forEach(curr => {
            const minN = (curr as any).minutos_normais || 0;
            const minE = (curr as any).minutos_extras || 0;
            const cNormal = (minN / 60) * custoHoraNormal;
            const cExtra = (minE / 60) * custoHoraExtra;

            const isPrimeiraEtapa = (curr.etapa as any)?.ordem === 1;
            const loteId = curr.lote_id;
            const qtdLanc = curr.quantidade_produzida || 0;

            if (isPrimeiraEtapa && loteId) {
                const maxQty = lotesPrimeiraEtapaGeral.get(loteId) || 0;
                if (qtdLanc > maxQty) {
                    lotesPrimeiraEtapaGeral.set(loteId, qtdLanc);
                }
            } else {
                qtdProduzida += qtdLanc;
            }

            tempoNormal += minN;
            tempoExtra += minE;
            custoNormalTotal += cNormal;
            custoExtraTotal += cExtra;
            custoTotal += cNormal + cExtra;
        });

        let qtdLotesPrimeiraEtapa = 0;
        for (const num of lotesPrimeiraEtapaGeral.values()) {
            qtdLotesPrimeiraEtapa += num;
        }

        return {
            qtdProduzida: qtdProduzida + qtdLotesPrimeiraEtapa,
            tempoNormal,
            tempoExtra,
            custoTotal,
            custoExtraTotal,
            custoNormal: custoNormalTotal
        };
    }, [producoes, colaboradores, colaboradorId]);

    const mediaTempoPorUnidade = totais && totais.qtdProduzida > 0
        ? (totais.tempoNormal + totais.tempoExtra) / totais.qtdProduzida
        : 0;

    const mediaCustoPorUnidade = totais && totais.qtdProduzida > 0
        ? totais.custoTotal / totais.qtdProduzida
        : 0;

    return (
        <div className="space-y-6">
            {/* Estilos de Impressão */}
            <style>
                {`
                    @media print {
                        @page { margin: 10mm; size: landscape; }
                        body { -webkit-print-color-adjust: exact; }
                        .print-compact { gap: 0.5rem !important; }
                        tr { page-break-inside: avoid; }
                        td, th { padding: 0.25rem 0.5rem !important; font-size: 10px !important; }
                        .card-print { border: 1px solid #ddd !important; box-shadow: none !important; }
                    }
                `}
            </style>

            <div className="hidden print:block mb-6">
                <div className="flex justify-between items-start border-b pb-4 mb-4">
                    <div>
                        <h1 className="text-xl font-bold">Relatório de Desempenho</h1>
                        <p className="text-sm text-gray-600">Meta PCP - Controle de Produção</p>
                    </div>
                    <div className="text-right text-sm">
                        <p><strong>Emissão:</strong> {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                        {colaboradorId && (
                            <p><strong>Colaborador:</strong> {colaboradores?.find(c => c.id === colaboradorId)?.nome}</p>
                        )}
                        <p><strong>Período:</strong> {dataInicio ? format(dataInicio, "dd/MM/yy") : "Início"} até {dataFim ? format(dataFim, "dd/MM/yy") : "Fim"}</p>
                    </div>
                </div>
            </div>

            <div className="print:hidden">
                <h1 className="text-2xl font-bold tracking-tight">Desempenho de Colaboradores</h1>
                <p className="text-muted-foreground">
                    Análise detalhada de produção, custos e eficiência por colaborador.
                </p>
            </div>

            {/* Filtros */}
            <Card className="print:hidden">
                <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-4 items-end mb-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Colaborador</label>
                            <SearchableSelect
                                value={colaboradorId}
                                onValueChange={setColaboradorId}
                                placeholder="Selecione..."
                                options={[
                                    { value: "", label: "Selecione..." },
                                    ...(colaboradores?.map(c => ({ value: c.id, label: c.nome })) || [])
                                ]}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Período</label>
                            <div className="flex gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !dataInicio && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dataInicio ? format(dataInicio, "dd/MM/yy") : <span>Início</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={dataInicio}
                                            onSelect={setDataInicio}
                                            initialFocus
                                            locale={ptBR}
                                        />
                                    </PopoverContent>
                                </Popover>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !dataFim && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dataFim ? format(dataFim, "dd/MM/yy") : <span>Fim</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={dataFim}
                                            onSelect={setDataFim}
                                            initialFocus
                                            locale={ptBR}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* Filtro de Tipo (Novo) */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipo</label>
                            <SearchableSelect
                                value={tipoFiltro}
                                onValueChange={(val) => {
                                    setTipoFiltro(val);
                                    if (val === "atividade") {
                                        setProdutoId("all");
                                        setLoteId("all");
                                        setEtapaId("all");
                                        setSubetapaId("all");
                                    } else if (val === "producao") {
                                        setAtividadeId("all");
                                    }
                                }}
                                placeholder="Todos"
                                options={[
                                    { value: "all", label: "Todos" },
                                    { value: "producao", label: "Produção (Lotes)" },
                                    { value: "atividade", label: "Atividades Avulsas" }
                                ]}
                            />
                        </div>

                        {/* Filtro de Nome da Atividade */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome da Atividade</label>
                            <SearchableSelect
                                value={atividadeId}
                                onValueChange={setAtividadeId}
                                disabled={tipoFiltro === "producao"}
                                placeholder="Todas as atividades"
                                options={[
                                    { value: "all", label: "Todas as atividades" },
                                    ...(atividades?.map(a => ({ value: a.id, label: a.nome })) || [])
                                ]}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Produto</label>
                            <SearchableSelect
                                value={produtoId}
                                onValueChange={(val) => {
                                    setProdutoId(val);
                                    setLoteId("all");
                                }}
                                disabled={tipoFiltro === "atividade"}
                                placeholder="Todos os produtos"
                                options={[
                                    { value: "all", label: "Todos os produtos" },
                                    ...(produtos?.map(p => ({ value: p.id, label: p.nome })) || [])
                                ]}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Lote</label>
                            <SearchableSelect
                                value={loteId}
                                onValueChange={setLoteId}
                                disabled={tipoFiltro === "atividade"}
                                placeholder="Todos os lotes"
                                options={[
                                    { value: "all", label: "Todos os lotes" },
                                    ...(lotes?.filter(l => produtoId === "all" || l.produto_id === produtoId).map(l => ({
                                        value: l.id,
                                        label: `${l.numero_lote} - ${(l.produto as any)?.nome || 'Sem Produto'}`
                                    })) || [])
                                ]}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Etapa</label>
                            <SearchableSelect
                                value={etapaId}
                                onValueChange={(val) => {
                                    setEtapaId(val);
                                    setSubetapaId("all");
                                }}
                                disabled={tipoFiltro === "atividade"}
                                placeholder="Todas as etapas"
                                options={[
                                    { value: "all", label: "Todas as etapas" },
                                    ...(etapas?.map(e => ({ value: e.id, label: e.nome })) || [])
                                ]}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Subetapa</label>
                            <SearchableSelect
                                value={subetapaId}
                                onValueChange={setSubetapaId}
                                disabled={(etapaId === "all" && (!subetapas || subetapas.length === 0)) || tipoFiltro === "atividade"}
                                placeholder="Todas as subetapas"
                                options={[
                                    { value: "all", label: "Todas as subetapas" },
                                    ...(subetapas?.map(s => ({ value: s.id, label: s.nome })) || [])
                                ]}
                            />
                        </div>

                        <div className="flex gap-2 items-end">
                            <Button onClick={handleConsultar} disabled={!colaboradorId || isLoading} className="flex-1">
                                {isLoading ? "Consultando..." : "Consultar"}
                                <Search className="ml-2 h-4 w-4" />
                            </Button>
                            <Button variant="outline" onClick={() => window.print()} disabled={!filtrosAplicados}>
                                <Printer className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent >
            </Card >

            {/* Resultados - Resumo */}
            {
                filtrosAplicados && totais && (
                    <div className="grid gap-4 md:grid-cols-5 print:grid-cols-5 print:gap-2 print-compact">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Produção Total</CardTitle>
                                <Package className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totais.qtdProduzida} un</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{formatarMoeda(totais.custoTotal)}</div>
                                <p className="text-[10px] text-muted-foreground">
                                    {formatarMoeda(totais.custoNormal)} Normal + {formatarMoeda(totais.custoExtraTotal)} Extra
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Tempo Total</CardTitle>
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatarTempo(totais.tempoNormal + totais.tempoExtra)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Custo Unitário</CardTitle>
                                <DollarSign className="h-4 w-4 text-purple-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-purple-700">{formatarMoeda(mediaCustoPorUnidade)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Tempo Unit.</CardTitle>
                                <Clock className="h-4 w-4 text-purple-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-purple-700">
                                    {(() => {
                                        const segundosTotal = mediaTempoPorUnidade * 60;
                                        if (isNaN(segundosTotal) || !isFinite(segundosTotal) || segundosTotal === 0) return "-";
                                        const m = Math.floor(segundosTotal / 60);
                                        const s = Math.round(segundosTotal % 60);
                                        return `${m}m ${s}s`;
                                    })()}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            }

            {/* Tabela Detalhada */}
            {
                filtrosAplicados && producoes && producoes.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalhamento de Atividades</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Lote / Etapa</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead className="text-right">Qtd.</TableHead>
                                        <TableHead className="text-right bg-blue-50/50">Tempo</TableHead>
                                        <TableHead className="text-right bg-orange-50/50">Hora Extra</TableHead>
                                        <TableHead className="text-right font-bold text-blue-600">Tempo Total</TableHead>
                                        <TableHead className="text-right bg-blue-50/50">Custo Normal</TableHead>
                                        <TableHead className="text-right bg-orange-50/50">Custo Extra</TableHead>
                                        <TableHead className="text-right font-bold">Custo Total</TableHead>
                                        <TableHead className="text-right font-medium text-purple-600">Tempo Uni.</TableHead>
                                        <TableHead className="text-right font-medium text-purple-600">Custo Unit.</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {grupos.map((grupo) => {
                                        const custoTotalGrupo = grupo.custoNormal + grupo.custoExtra;
                                        const tempoTotalGrupo = grupo.minutosNormais + grupo.minutosExtras;

                                        return (
                                            <React.Fragment key={grupo.id}>
                                                <TableRow className="bg-muted/30 font-semibold cursor-pointer hover:bg-muted/50" onClick={() => toggleGroup(grupo.id)}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {expandedGroups[grupo.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                            {grupo.isAvulsa && <Badge variant="outline" className="text-[10px] font-mono border-primary/20 bg-primary/5 text-primary">AVULSA</Badge>}
                                                            <span>{grupo.titulo}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-muted-foreground">{grupo.items.length} registro(s)</span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">
                                                        {grupo.qtd}
                                                    </TableCell>

                                                    <TableCell className="text-right bg-blue-50/50">
                                                        {formatarTempo(grupo.minutosNormais)}
                                                    </TableCell>
                                                    <TableCell className="text-right bg-orange-50/50">
                                                        {formatarTempo(grupo.minutosExtras)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-blue-700">
                                                        {formatarTempo(tempoTotalGrupo)}
                                                    </TableCell>

                                                    <TableCell className="text-right bg-blue-50/50">
                                                        {formatarMoeda(grupo.custoNormal)}
                                                    </TableCell>
                                                    <TableCell className="text-right bg-orange-50/50">
                                                        {formatarMoeda(grupo.custoExtra)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-green-700">
                                                        {formatarMoeda(custoTotalGrupo)}
                                                    </TableCell>

                                                    <TableCell className="text-right font-medium text-purple-700">
                                                        {grupo.qtd > 0 ? (() => {
                                                            const mediaMinutos = tempoTotalGrupo / grupo.qtd;
                                                            const segundosTotal = mediaMinutos * 60;
                                                            const m = Math.floor(segundosTotal / 60);
                                                            const s = Math.round(segundosTotal % 60);
                                                            return `${m}m ${s}s`;
                                                        })() : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-purple-700">
                                                        {grupo.qtd > 0 ? formatarMoeda(custoTotalGrupo / grupo.qtd) : '-'}
                                                    </TableCell>
                                                </TableRow>

                                                {expandedGroups[grupo.id] && (() => {
                                                    // Controlar visualização de duplicadas na Etapa 1
                                                    const lotesProcessados = new Set<string>();

                                                    // Primeiro, ordenar por ID desc para que o último lançamento seja o que mostra a QTD.
                                                    // Isso garante que mostramos a qtd na primeira linha de cima para baixo
                                                    const sortedItems = [...grupo.items].sort((a, b) => b.id - a.id);

                                                    return sortedItems.map((prod: any) => {
                                                        const colaborador = colaboradores?.find(c => c.id === colaboradorId);
                                                        const custoHoraNormal = Number((colaborador as any)?.custo_por_hora || 0);
                                                        const custoHoraExtra = Number((colaborador as any)?.custo_hora_extra || 0);

                                                        const minutosNormais = prod.minutos_normais || 0;
                                                        const minutosExtras = prod.minutos_extras || 0;

                                                        const custoNormal = (minutosNormais / 60) * custoHoraNormal;
                                                        const custoExtra = (minutosExtras / 60) * custoHoraExtra;
                                                        const custoTotal = custoNormal + custoExtra;

                                                        return (
                                                            <TableRow key={prod.id} className="bg-muted/10 text-sm">
                                                                <TableCell className="pl-10">
                                                                    {prod.atividade ? (
                                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                                            <span>Registro de Atividade</span>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <div className="font-medium">{prod.lote?.numero_lote} - {prod.lote?.nome_lote || "Sem Lote"}</div>
                                                                        </>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {prod.data_inicio && format(new Date(prod.data_inicio + "T12:00:00"), "dd/MM/yyyy")}
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {prod.hora_inicio?.substring(0, 5)} - {prod.hora_fim?.substring(0, 5)}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium">
                                                                    {(() => {
                                                                        const isPrimeiraEtapa = (prod.etapa as any)?.ordem === 1;
                                                                        const loteId = prod.lote_id;

                                                                        if (isPrimeiraEtapa && loteId) {
                                                                            if (lotesProcessados.has(loteId)) {
                                                                                return "0";
                                                                            }
                                                                            lotesProcessados.add(loteId);
                                                                        }
                                                                        return prod.quantidade_produzida || "0";
                                                                    })()}
                                                                </TableCell>

                                                                {/* Tempo */}
                                                                <TableCell className="text-right bg-blue-50/20 text-xs text-muted-foreground">
                                                                    {formatarTempo(minutosNormais)}
                                                                </TableCell>
                                                                <TableCell className="text-right bg-orange-50/20 text-xs text-muted-foreground">
                                                                    {formatarTempo(minutosExtras)}
                                                                </TableCell>
                                                                <TableCell className="text-right font-semibold text-blue-600/80 text-xs">
                                                                    {formatarTempo(minutosNormais + minutosExtras)}
                                                                </TableCell>

                                                                {/* Custo */}
                                                                <TableCell className="text-right text-muted-foreground/50 text-xs italic">
                                                                    -
                                                                </TableCell>
                                                                <TableCell className="text-right text-muted-foreground/50 text-xs italic">
                                                                    -
                                                                </TableCell>
                                                                <TableCell className="text-right text-green-600/50 text-xs italic">
                                                                    -
                                                                </TableCell>

                                                                <TableCell className="text-right text-purple-400/50 text-xs italic">
                                                                    -
                                                                </TableCell>
                                                                <TableCell className="text-right text-purple-400/50 text-xs italic">
                                                                    -
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
                                                })()}
                                            </React.Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )
            }
        </div >
    );
}

function ActivityIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    )
}
