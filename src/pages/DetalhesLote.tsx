import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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
import { useDetalhesLote } from "@/hooks/useDetalhesLote";
import { formatarTempoProdutivo } from "@/lib/timeUtils";
import { formatarCusto } from "@/lib/custoUtils";
import { Package, Clock, Users, CheckCircle2, Loader2, DollarSign, Calculator, ArrowLeft, Droplet, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export default function DetalhesLote() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data, isLoading } = useDetalhesLote(id || null);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Carregando detalhes do lote...</p>
            </div>
        );
    }

    if (!data?.lote) {
        return (
            <div className="container mx-auto py-6">
                <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>
                <div className="flex flex-col items-center justify-center h-[50vh]">
                    <p className="text-muted-foreground">Lote não encontrado.</p>
                </div>
            </div>
        )
    }

    const { lote, progressoPorEtapa, tempoTotal, quantidadeProduzida, custoMateriais, consumos } = data;

    // Calcular totais
    const custoProcesso = progressoPorEtapa.reduce((acc, curr) => acc + curr.custo_total, 0);
    const custoTotalGeral = custoProcesso;

    // Calcular custos unitários com base na quantidade do lote
    const quantidadeParaCalculo = lote.quantidade || lote.quantidade_total || 0;

    // Soma dos custos unitários de cada etapa
    const custoUnitarioGeral = progressoPorEtapa.reduce((acc, curr) => {
        const unitarioEtapa = curr.quantidade_produzida > 0 ? curr.custo_total / curr.quantidade_produzida : 0;
        return acc + unitarioEtapa;
    }, 0);

    // Soma dos tempos unitários de cada etapa
    const tempoUnitarioGeral = progressoPorEtapa.reduce((acc, curr) => {
        const unitarioEtapa = curr.quantidade_produzida > 0 ? curr.tempo_total / curr.quantidade_produzida : 0;
        return acc + unitarioEtapa;
    }, 0);

    // Variáveis para a nova interface de custos
    const custoTerceirizadoTotal = progressoPorEtapa.filter(e => e.is_terceirizado).reduce((acc, curr) => acc + curr.custo_total, 0);
    const custoMaoDeObraTotal = custoTotalGeral - custoTerceirizadoTotal;
    // O custo_total do lote inteiro
    const custoUnitTerceirizado = quantidadeParaCalculo > 0 ? custoTerceirizadoTotal / quantidadeParaCalculo : 0;
    const custoUnitMaoDeObra = custoUnitarioGeral - custoUnitTerceirizado;

    const custoMaterialTotal = custoMateriais || 0;
    const custoUnitMaterial = quantidadeParaCalculo > 0 ? custoMaterialTotal / quantidadeParaCalculo : 0;

    const custoAgregadoTotal = custoMaoDeObraTotal + custoTerceirizadoTotal + custoMaterialTotal;
    const custoAgregadoUnit = custoUnitMaoDeObra + custoUnitTerceirizado + custoUnitMaterial;

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 md:gap-4">
                    <Button variant="ghost" onClick={() => navigate(-1)} size="sm" className="pl-0 md:pl-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                    </Button>
                    <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                        <Package className="h-5 w-5 md:h-6 md:w-6" />
                        Detalhes do Lote
                    </h1>
                </div>
                {lote.finalizado ? (
                    <Button
                        variant="outline"
                        className="w-full md:w-auto"
                        onClick={async () => {
                            const { error } = await supabase
                                .from('lotes')
                                .update({
                                    finalizado: false,
                                    manually_reopened: true
                                })
                                .eq('id', lote.id);

                            if (error) {
                                toast.error("Erro ao reabrir lote");
                            } else {
                                toast.success("Lote reaberto com sucesso!");
                                queryClient.invalidateQueries({ queryKey: ["detalhes_lote", id] });
                            }
                        }}
                    >
                        Reabrir Lote
                    </Button>
                ) : (
                    <Button
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 w-full md:w-auto"
                        onClick={async () => {
                            const { error } = await supabase
                                .from('lotes')
                                .update({
                                    finalizado: true,
                                    manually_reopened: false
                                })
                                .eq('id', lote.id);

                            if (error) {
                                toast.error("Erro ao finalizar lote");
                            } else {
                                toast.success("Lote finalizado com sucesso!");
                                queryClient.invalidateQueries({ queryKey: ["detalhes_lote", id] });
                            }
                        }}
                    >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Finalizar Lote
                    </Button>
                )}
            </div>

            <div className="space-y-6">
                {/* Informações Gerais */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Informações Gerais</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Número do Lote</p>
                                <p className="text-lg font-semibold">#{lote.numero_lote}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Nome do Lote</p>
                                <p className="text-lg font-semibold break-words">{lote.nome_lote}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Produto</p>
                                <p className="text-lg font-semibold break-words">
                                    {lote.produto?.nome || "N/A"}
                                    {lote.produto?.sku && (
                                        <span className="text-sm text-muted-foreground ml-2 block sm:inline">
                                            ({lote.produto.sku})
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Status</p>
                                <div className="mt-1">
                                    {lote.finalizado ? (
                                        <Badge variant="default" className="bg-green-500">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Finalizado
                                        </Badge>
                                    ) : (
                                        <Badge variant="default" className="bg-blue-500">
                                            <Loader2 className="h-3 w-3 mr-1" />
                                            Em Andamento
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 mt-8">
                            {/* 1. Totais Gerais (Agregados) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Custo Total <span className="whitespace-nowrap">(Mat + M.O. + Terc.)</span></p>
                                        <p className="text-2xl font-bold text-emerald-700 mt-1">
                                            {formatarCusto(custoAgregadoTotal)}
                                        </p>
                                    </div>
                                    <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 hidden md:flex">
                                        <DollarSign className="h-5 w-5 text-emerald-600" />
                                    </div>
                                </div>
                                <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Custo Unitário <span className="whitespace-nowrap">(Mat + M.O. + Terc.)</span></p>
                                        <p className="text-2xl font-bold text-emerald-700 mt-1">
                                            {formatarCusto(custoAgregadoUnit)}
                                        </p>
                                    </div>
                                    <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 hidden md:flex">
                                        <Calculator className="h-5 w-5 text-emerald-600" />
                                    </div>
                                </div>
                                <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Tempo Total Lote</p>
                                        <p className="text-2xl font-bold text-emerald-700 mt-1">
                                            {formatarTempoProdutivo(tempoTotal)}
                                        </p>
                                    </div>
                                    <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 hidden md:flex">
                                        <Clock className="h-5 w-5 text-emerald-600" />
                                    </div>
                                </div>
                                <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Tempo Unitário Médio</p>
                                        <p className="text-2xl font-bold text-emerald-700 mt-1">
                                            {formatarTempoProdutivo(tempoUnitarioGeral)}
                                        </p>
                                    </div>
                                    <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 hidden md:flex">
                                        <Clock className="h-5 w-5 text-emerald-600" />
                                    </div>
                                </div>
                            </div>

                            {/* 2. Detalhes Mão de Obra, Material e Tempo */}
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Detalhamento</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-card p-3 rounded-lg border shadow-sm">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Total M.O. Interna</span>
                                        </div>
                                        <p className="text-lg font-bold text-foreground">
                                            {formatarCusto(custoMaoDeObraTotal)}
                                        </p>
                                    </div>

                                    <div className="bg-card p-3 rounded-lg border shadow-sm">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Unitário M.O. Interna</span>
                                        </div>
                                        <p className="text-lg font-bold text-foreground">
                                            {formatarCusto(custoUnitMaoDeObra)}
                                        </p>
                                    </div>

                                    <div className="bg-card p-3 rounded-lg border shadow-sm">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Total Terceirizada</span>
                                        </div>
                                        <p className="text-lg font-bold text-foreground">
                                            {formatarCusto(custoTerceirizadoTotal)}
                                        </p>
                                    </div>

                                    <div className="bg-card p-3 rounded-lg border shadow-sm">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Unitário Terceirizada</span>
                                        </div>
                                        <p className="text-lg font-bold text-foreground">
                                            {formatarCusto(custoUnitTerceirizado)}
                                        </p>
                                    </div>

                                    <div className="bg-card p-3 rounded-lg border shadow-sm">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Custo Total Material</span>
                                        </div>
                                        <p className="text-lg font-bold text-foreground">
                                            {formatarCusto(custoMaterialTotal)}
                                        </p>
                                    </div>

                                    <div className="bg-card p-3 rounded-lg border shadow-sm">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <Droplet className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Custo Unitário Material</span>
                                        </div>
                                        <p className="text-lg font-bold text-foreground">
                                            {formatarCusto(custoUnitMaterial)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Detalhamento por Etapa */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Progresso por Etapa</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Etapa</TableHead>
                                    <TableHead>Progresso</TableHead>
                                    <TableHead>Tempo</TableHead>
                                    <TableHead>Hora Extra</TableHead>
                                    <TableHead>Tempo Total</TableHead>
                                    <TableHead>Tempo Unit. (Médio)</TableHead>
                                    <TableHead>Custo Total</TableHead>
                                    <TableHead>Custo Unit.</TableHead>
                                    <TableHead>Colaboradores</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {progressoPorEtapa.map((etapa, idx) => {
                                    const tempoUnitarioEtapa = etapa.quantidade_produzida > 0 ? etapa.tempo_total / etapa.quantidade_produzida : 0;
                                    const custoUnitarioEtapa = etapa.quantidade_produzida > 0 ? etapa.custo_total / etapa.quantidade_produzida : 0;

                                    return (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium">
                                                {etapa.is_terceirizado ? (
                                                    <Badge variant="outline" className="mr-2 text-xs bg-amber-50 text-amber-700 border-amber-200">
                                                        Terceirizado
                                                    </Badge>
                                                ) : null}
                                                {etapa.subetapa_nome || etapa.etapa_nome}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm font-medium">
                                                    {etapa.quantidade_produzida} / {etapa.quantidade_total}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                    {formatarTempoProdutivo(etapa.tempo_normal)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    {etapa.tempo_extra > 0 ? (
                                                        <Badge variant="destructive" className="text-xs">
                                                            {formatarTempoProdutivo(etapa.tempo_extra)}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">-</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 font-semibold">
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                    {formatarTempoProdutivo(etapa.tempo_total)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-muted-foreground text-sm">
                                                    {formatarTempoProdutivo(tempoUnitarioEtapa)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-green-600 font-medium text-sm">
                                                    {formatarCusto(etapa.custo_total)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-orange-600 text-sm">
                                                    {formatarCusto(custoUnitarioEtapa)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {etapa.colaboradores.length > 0 ? (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="link" className="p-0 h-auto font-normal text-foreground hover:text-primary">
                                                                <div className="flex items-center gap-1">
                                                                    <Users className="h-3 w-3 text-muted-foreground" />
                                                                    {etapa.colaboradores.length} {etapa.is_terceirizado ? (etapa.colaboradores.length === 1 ? 'terceirizado' : 'terceirizados') : (etapa.colaboradores.length === 1 ? 'colaborador' : 'colaboradores')}
                                                                </div>
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-80">
                                                            <div className="space-y-2">
                                                                <h4 className="font-medium text-sm border-b pb-2 mb-2">Colaboradores na etapa</h4>
                                                                {etapa.colaboradores_detalhes?.map((colab, i) => (
                                                                    <div key={i} className="flex justify-between items-center text-sm border-b border-border/40 pb-1 last:border-0 last:pb-0">
                                                                        <span className="font-medium">{colab.nome}</span>
                                                                        <div className="flex flex-col items-end">
                                                                            {colab.quantidade !== undefined && (
                                                                                <span className="text-xs font-semibold text-primary">
                                                                                    {colab.quantidade} un
                                                                                </span>
                                                                            )}
                                                                            <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                                                                <Clock className="h-3 w-3" />
                                                                                {formatarTempoProdutivo(colab.tempo)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Consumo de Matéria Prima */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Consumo de Matéria Prima</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Material</TableHead>
                                    <TableHead className="text-right">Quantidade</TableHead>
                                    <TableHead className="text-right">Preço Unit.</TableHead>
                                    <TableHead className="text-right">Custo Total</TableHead>
                                    <TableHead className="text-right">Custo p/ Peça</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {consumos?.length > 0 ? (
                                    Object.values(consumos.reduce((acc: any, curr: any) => {
                                        const id = curr.material?.id || 'unknown';
                                        if (!acc[id]) acc[id] = { material: curr.material, itens: [] };
                                        acc[id].itens.push(curr);
                                        return acc;
                                    }, {})).map((grupo: any) => (
                                        <>
                                            {/* Linha do Material (Título) */}
                                            <TableRow key={`header-${grupo.material?.id}`} className="bg-muted/20 hover:bg-muted/30">
                                                <TableCell colSpan={5} className="py-3">
                                                    <div className="flex items-center gap-2 font-medium">
                                                        {grupo.material?.codigo && (
                                                            <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-muted-foreground/20">
                                                                {grupo.material.codigo}
                                                            </span>
                                                        )}
                                                        <span className="text-base text-card-foreground">
                                                            {grupo.material?.nome || "Material sem nome"}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {/* Linhas das Cores (Detalhes) */}
                                            {grupo.itens.map((consumo: any) => {
                                                const custoUnit = consumo.material?.preco_custo || 0;
                                                const custoTotal = (consumo.quantidade_real || 0) * custoUnit;
                                                const custoPorPeca = quantidadeParaCalculo > 0 ? custoTotal / quantidadeParaCalculo : 0;

                                                return (
                                                    <TableRow key={consumo.id} className="hover:bg-transparent">
                                                        <TableCell className="pl-6 py-1">
                                                            <div className="flex items-center pl-4 h-full">
                                                                <span className="text-sm text-muted-foreground">
                                                                    {consumo.cor?.nome || "Única / Padrão"}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right py-1 text-muted-foreground">
                                                            {consumo.quantidade_real} {consumo.material?.unidade_medida}
                                                        </TableCell>
                                                        <TableCell className="text-right py-1 text-muted-foreground">{formatarCusto(custoUnit)}</TableCell>
                                                        <TableCell className="text-right py-1 text-muted-foreground">{formatarCusto(custoTotal)}</TableCell>
                                                        <TableCell className="text-right font-medium text-indigo-600 py-1">
                                                            {formatarCusto(custoPorPeca)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                                            Nenhum material lançado para este lote.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
