import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Search, DollarSign, Clock, Package, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
                etapa:etapas(nome),
                subetapa:subetapas(nome),
                atividade:atividades(nome)
            `)
                .eq("empresa_id", empresaId)
                .eq("colaborador_id", colaboradorId);

            if (dataInicio) {
                query = query.gte("data_inicio", format(dataInicio, "yyyy-MM-dd"));
            }
            if (dataFim) {
                query = query.lte("data_inicio", format(dataFim, "yyyy-MM-dd"));
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

            const { data, error } = await query;
            if (error) throw error;

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

    // Cálculos de Totais
    const totais = producoes?.reduce((acc, curr) => {
        const colaborador = colaboradores?.find(c => c.id === colaboradorId);
        const custoHoraNormal = Number((colaborador as any)?.custo_por_hora || 0);
        const custoHoraExtra = Number((colaborador as any)?.custo_hora_extra || 0);

        const minutosNormais = (curr as any).minutos_normais || 0;
        const minutosExtras = (curr as any).minutos_extras || 0;

        const custoNormal = (minutosNormais / 60) * custoHoraNormal;
        const custoExtra = (minutosExtras / 60) * custoHoraExtra;

        return {
            qtdProduzida: acc.qtdProduzida + (curr.quantidade_produzida || 0),
            tempoNormal: acc.tempoNormal + minutosNormais,
            tempoExtra: acc.tempoExtra + minutosExtras,
            custoTotal: acc.custoTotal + custoNormal + custoExtra,
            custoExtraTotal: acc.custoExtraTotal + custoExtra,
            custoNormal: acc.custoNormal + custoNormal // Adding this property
        };
    }, { qtdProduzida: 0, tempoNormal: 0, tempoExtra: 0, custoTotal: 0, custoExtraTotal: 0, custoNormal: 0 });

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
                            <Select value={colaboradorId} onValueChange={setColaboradorId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {colaboradores?.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* Filtro de Tipo (Novo) */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipo</label>
                            <Select value={tipoFiltro} onValueChange={(val) => {
                                setTipoFiltro(val);
                                // Resetar filtros conflitantes se mudar o tipo
                                if (val === "atividade") {
                                    setProdutoId("all");
                                    setLoteId("all");
                                    setEtapaId("all");
                                    setSubetapaId("all");
                                } else if (val === "producao") {
                                    setAtividadeId("all");
                                }
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="producao">Produção (Lotes)</SelectItem>
                                    <SelectItem value="atividade">Atividades Avulsas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Filtro de Nome da Atividade (Só aparece se Tipo for Atividade ou Todos) */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome da Atividade</label>
                            <Select
                                value={atividadeId}
                                onValueChange={setAtividadeId}
                                disabled={tipoFiltro === "producao"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todas as atividades" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as atividades</SelectItem>
                                    {atividades?.map((ativ) => (
                                        <SelectItem key={ativ.id} value={ativ.id}>
                                            {ativ.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Produto</label>
                            <Select
                                value={produtoId}
                                onValueChange={(val) => {
                                    setProdutoId(val);
                                    setLoteId("all");
                                }}
                                disabled={tipoFiltro === "atividade"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos os produtos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os produtos</SelectItem>
                                    {produtos?.map((prod) => (
                                        <SelectItem key={prod.id} value={prod.id}>
                                            {prod.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Lote</label>
                            <Select
                                value={loteId}
                                onValueChange={setLoteId}
                                disabled={tipoFiltro === "atividade"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos os lotes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os lotes</SelectItem>
                                    {lotes?.filter(l => produtoId === "all" || l.produto_id === produtoId).map((lote) => (
                                        <SelectItem key={lote.id} value={lote.id}>
                                            {lote.numero_lote} - {(lote.produto as any)?.nome || 'Sem Produto'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Etapa</label>
                            <Select
                                value={etapaId}
                                onValueChange={(val) => {
                                    setEtapaId(val);
                                    setSubetapaId("all");
                                }}
                                disabled={tipoFiltro === "atividade"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todas as etapas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as etapas</SelectItem>
                                    {etapas?.map((etapa) => (
                                        <SelectItem key={etapa.id} value={etapa.id}>
                                            {etapa.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Subetapa</label>
                            <Select
                                value={subetapaId}
                                onValueChange={setSubetapaId}
                                disabled={(etapaId === "all" && subetapas?.length === 0) || tipoFiltro === "atividade"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todas as subetapas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as subetapas</SelectItem>
                                    {subetapas?.map((sub) => (
                                        <SelectItem key={sub.id} value={sub.id}>
                                            {sub.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                    <div className="grid gap-4 md:grid-cols-4 print:grid-cols-4 print:gap-2 print-compact">
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
                                <p className="text-xs text-muted-foreground">
                                    {formatarMoeda(totais.custoNormal)} Normal + {formatarMoeda(totais.custoExtraTotal)} Hora Extra
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
                                <p className="text-xs text-muted-foreground">
                                    {formatarTempo(totais.tempoNormal)} Normal + {formatarTempo(totais.tempoExtra)} Extra
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Hora Extra</CardTitle>
                                <Clock className="h-4 w-4 text-orange-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-500">{formatarTempo(totais.tempoExtra)}</div>
                                <p className="text-xs text-muted-foreground">
                                    Custo: {formatarMoeda(totais.custoExtraTotal)}
                                </p>
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
                                    {producoes.map((prod) => {
                                        const colaborador = colaboradores?.find(c => c.id === colaboradorId);
                                        const custoHoraNormal = Number((colaborador as any)?.custo_por_hora || 0);
                                        const custoHoraExtra = Number((colaborador as any)?.custo_hora_extra || 0);

                                        const minutosNormais = (prod as any).minutos_normais || 0;
                                        const minutosExtras = (prod as any).minutos_extras || 0;

                                        const custoNormal = (minutosNormais / 60) * custoHoraNormal;
                                        const custoExtra = (minutosExtras / 60) * custoHoraExtra;
                                        const custoTotal = custoNormal + custoExtra;

                                        return (
                                            <TableRow key={prod.id}>
                                                <TableCell>
                                                    {prod.atividade ? (
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="text-[10px] font-mono border-primary/20 bg-primary/5 text-primary">AVULSA</Badge>
                                                            <span className="font-medium">{prod.atividade.nome}</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="font-medium">{prod.lote?.numero_lote} - {prod.lote?.nome_lote || "Sem Lote"}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {prod.etapa?.nome} {prod.subetapa && `↳ ${prod.subetapa.nome}`}
                                                            </div>
                                                        </>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {prod.data_inicio && format(new Date(prod.data_inicio), "dd/MM/yyyy")}
                                                    <div className="text-xs text-muted-foreground">
                                                        {prod.hora_inicio?.substring(0, 5)} - {prod.hora_fim?.substring(0, 5)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {prod.quantidade_produzida}
                                                </TableCell>

                                                {/* Tempo */}
                                                <TableCell className="text-right bg-blue-50/30">
                                                    {formatarTempo(minutosNormais)}
                                                </TableCell>
                                                <TableCell className="text-right bg-orange-50/30">
                                                    {formatarTempo(minutosExtras)}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-blue-600">
                                                    {formatarTempo(minutosNormais + minutosExtras)}
                                                </TableCell>

                                                {/* Custo */}
                                                <TableCell className="text-right bg-blue-50/30">
                                                    {formatarMoeda(custoNormal)}
                                                </TableCell>
                                                <TableCell className="text-right bg-orange-50/30">
                                                    {formatarMoeda(custoExtra)}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-green-600">
                                                    {formatarMoeda(custoTotal)}
                                                </TableCell>

                                                {/* Médias */}
                                                <TableCell className="text-right font-medium text-purple-600">
                                                    {prod.quantidade_produzida > 0 ? (() => {
                                                        const mediaMinutos = (minutosNormais + minutosExtras) / prod.quantidade_produzida;
                                                        const segundosTotal = mediaMinutos * 60;
                                                        const m = Math.floor(segundosTotal / 60);
                                                        const s = Math.round(segundosTotal % 60);
                                                        return `${m}m ${s}s`;
                                                    })() : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-purple-600">
                                                    {prod.quantidade_produzida > 0 ? formatarMoeda(custoTotal / prod.quantidade_produzida) : '-'}
                                                </TableCell>
                                            </TableRow>
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
