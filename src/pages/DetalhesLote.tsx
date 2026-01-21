import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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
import { Package, Clock, Users, CheckCircle2, Loader2, DollarSign, Calculator, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DetalhesLote() {
    const { id } = useParams();
    const navigate = useNavigate();
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

    const { lote, progressoPorEtapa, tempoTotal, quantidadeProduzida } = data;

    // Calcular totais
    // Calcular totais
    const custoTotalGeral = progressoPorEtapa.reduce((acc, curr) => acc + curr.custo_total, 0);

    // Soma dos unitários de cada etapa (visão de custo do processo produzido)
    const custoUnitarioGeral = progressoPorEtapa.reduce((acc, curr) => {
        const unitarioEtapa = curr.quantidade_produzida > 0 ? curr.custo_total / curr.quantidade_produzida : 0;
        return acc + unitarioEtapa;
    }, 0);

    // Soma dos tempos unitários de cada etapa
    const tempoUnitarioGeral = progressoPorEtapa.reduce((acc, curr) => {
        const unitarioEtapa = curr.quantidade_produzida > 0 ? curr.tempo_total / curr.quantidade_produzida : 0;
        return acc + unitarioEtapa;
    }, 0);

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate(-1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Package className="h-6 w-6" />
                    Detalhes do Lote
                </h1>
            </div>

            <div className="space-y-6">
                {/* Informações Gerais */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Informações Gerais</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Número do Lote</p>
                                <p className="text-lg font-semibold">#{lote.numero_lote}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Nome do Lote</p>
                                <p className="text-lg font-semibold">{lote.nome_lote}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Produto</p>
                                <p className="text-lg font-semibold">
                                    {lote.produto?.nome || "N/A"}
                                    {lote.produto?.sku && (
                                        <span className="text-sm text-muted-foreground ml-2">
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

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                            <div className="flex items-center gap-2">
                                <Clock className="h-8 w-8 text-blue-500/20 text-blue-600 p-1.5 bg-blue-50 rounded-lg" />
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tempo Total</p>
                                    <p className="font-bold text-xl">{formatarTempoProdutivo(tempoTotal)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-8 w-8 text-green-500/20 text-green-600 p-1.5 bg-green-50 rounded-lg" />
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Custo Total</p>
                                    <p className="font-bold text-xl text-green-600">{formatarCusto(custoTotalGeral)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calculator className="h-8 w-8 text-orange-500/20 text-orange-600 p-1.5 bg-orange-50 rounded-lg" />
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Custo Unit.</p>
                                    <p className="font-bold text-xl text-orange-600">{formatarCusto(custoUnitarioGeral)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-8 w-8 text-purple-500/20 text-purple-600 p-1.5 bg-purple-50 rounded-lg" />
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tempo Unit.</p>
                                    <p className="font-bold text-xl text-purple-600">{formatarTempoProdutivo(tempoUnitarioGeral)}</p>
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

                                    // Custo unitário da etapa também baseado na produção real da etapa (quanto custou fazer cada uma)
                                    const custoUnitarioEtapa = etapa.quantidade_produzida > 0 ? etapa.custo_total / etapa.quantidade_produzida : 0;

                                    return (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium">
                                                {etapa.subetapa_nome || etapa.etapa_nome}
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex justify-between text-xs text-muted-foreground">
                                                            <span>{etapa.quantidade_produzida} / {etapa.quantidade_total}</span>
                                                            <span>{etapa.percentual}%</span>
                                                        </div>
                                                        <Progress value={etapa.percentual} className="h-2 w-full" />
                                                    </div>
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
                                                <div className="flex items-center gap-1">
                                                    <Users className="h-3 w-3 text-muted-foreground" />
                                                    {etapa.colaboradores.length > 0
                                                        ? etapa.colaboradores.join(", ")
                                                        : "Não iniciado"}
                                                </div>
                                            </TableCell>

                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
