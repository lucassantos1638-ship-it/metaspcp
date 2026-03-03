import React from 'react';
import ReportA4Layout from '../common/ReportA4Layout';
import { format } from "date-fns";
import { formatarMoeda } from "@/lib/utils";

const formatarTempo = (minutos: number) => {
    if (isNaN(minutos) || !isFinite(minutos)) return "-";
    const h = Math.floor(minutos / 60);
    const m = Math.floor(minutos % 60);
    return `${h}h ${m}min`;
};

interface Totais {
    qtdProduzida: number;
    tempoNormal: number;
    tempoExtra: number;
    custoTotal: number;
    custoExtraTotal: number;
    custoNormal: number;
}

interface Grupo {
    id: string;
    titulo: string;
    subtitulo: string | null;
    qtd: number;
    minutosNormais: number;
    minutosExtras: number;
    custoNormal: number;
    custoExtra: number;
}

interface DesempenhoRelatorioA4Props {
    empresa: any;
    totais: Totais | null;
    grupos: Grupo[];
    dataInicio: Date | undefined;
    dataFim: Date | undefined;
    colaboradorIds: string[];
    colaboradores: any[];
}

export default function DesempenhoRelatorioA4({
    empresa,
    totais,
    grupos,
    dataInicio,
    dataFim,
    colaboradorIds,
    colaboradores
}: DesempenhoRelatorioA4Props) {
    if (!totais) return null;

    const mediaTempoPorUnidade = totais.qtdProduzida > 0
        ? (totais.tempoNormal + totais.tempoExtra) / totais.qtdProduzida
        : 0;

    const mediaCustoPorUnidade = totais.qtdProduzida > 0
        ? totais.custoTotal / totais.qtdProduzida
        : 0;

    const nomesColaboradores = colaboradorIds.length === 1
        ? colaboradores?.find(c => c.id === colaboradorIds[0])?.nome
        : `${colaboradorIds.length} colaboradores selecionados`;

    return (
        <ReportA4Layout title="Relatório de Desempenho" empresa={empresa}>
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm border-b pb-4">
                <div>
                    <h3 className="font-bold text-gray-700">Período de Análise</h3>
                    <p>{dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Início"} até {dataFim ? format(dataFim, "dd/MM/yyyy") : "Fim"}</p>
                </div>
                <div>
                    <h3 className="font-bold text-gray-700">Colaborador(es)</h3>
                    <p>{nomesColaboradores || "Nenhum colaborador especificado"}</p>
                </div>
            </div>

            <h3 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-gray-200 pb-1">Resumo Global</h3>
            <div className="grid grid-cols-5 gap-2 mb-6 text-center">
                <div className="p-2 bg-gray-50 border rounded">
                    <div className="text-xs text-gray-500 uppercase font-bold">Qtd Total</div>
                    <div className="font-bold text-lg">{totais.qtdProduzida || 0} un</div>
                </div>
                <div className="p-2 bg-gray-50 border rounded">
                    <div className="text-xs text-gray-500 uppercase font-bold">Custo Total</div>
                    <div className="font-bold text-lg text-green-700">{formatarMoeda(totais.custoTotal || 0)}</div>
                </div>
                <div className="p-2 bg-gray-50 border rounded">
                    <div className="text-xs text-gray-500 uppercase font-bold">Tempo Total</div>
                    <div className="font-bold text-lg">{formatarTempo((totais.tempoNormal || 0) + (totais.tempoExtra || 0))}</div>
                </div>
                <div className="p-2 bg-gray-50 border rounded">
                    <div className="text-xs text-gray-500 uppercase font-bold">Custo/Unidade</div>
                    <div className="font-bold text-lg text-purple-700">{formatarMoeda(mediaCustoPorUnidade || 0)}</div>
                </div>
                <div className="p-2 bg-gray-50 border rounded">
                    <div className="text-xs text-gray-500 uppercase font-bold">Tempo/Unidade</div>
                    <div className="font-bold text-lg text-purple-700">
                        {(() => {
                            const segundosTotal = mediaTempoPorUnidade * 60;
                            if (isNaN(segundosTotal) || !isFinite(segundosTotal) || segundosTotal === 0) return "-";
                            const m = Math.floor(segundosTotal / 60);
                            const s = Math.round(segundosTotal % 60);
                            return `${m}m ${s}s`;
                        })()}
                    </div>
                </div>
            </div>

            <h3 className="text-lg font-bold text-gray-800 mb-3 border-b-2 border-gray-200 pb-1">Detalhamento por Atividade</h3>
            <table className="w-full text-sm border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-100 uppercase text-xs text-left">
                        <th className="border border-gray-300 p-2">Descrição</th>
                        <th className="border border-gray-300 p-2 text-center">Quantidade</th>
                        <th className="border border-gray-300 p-2 text-center">Tempo Executado</th>
                        <th className="border border-gray-300 p-2 text-center">Tempo Médio/Un</th>
                        <th className="border border-gray-300 p-2 text-right">Custo Total</th>
                    </tr>
                </thead>
                <tbody>
                    {(grupos || []).map((grupo) => {
                        const tempoGrupo = (grupo.minutosNormais || 0) + (grupo.minutosExtras || 0);
                        const custoGrupo = (grupo.custoNormal || 0) + (grupo.custoExtra || 0);
                        const tempUnit = (grupo.qtd && grupo.qtd > 0) ? tempoGrupo / grupo.qtd : 0;

                        return (
                            <tr key={grupo.id} className="border-b border-gray-200 break-inside-avoid">
                                <td className="p-2 border border-gray-300 font-medium">
                                    {grupo.titulo}
                                    {grupo.subtitulo && (
                                        <div className="text-xs text-gray-500 font-normal">{grupo.subtitulo}</div>
                                    )}
                                </td>
                                <td className="p-2 border border-gray-300 text-center">{Math.round(grupo.qtd || 0)} un</td>
                                <td className="p-2 border border-gray-300 text-center">{formatarTempo(tempoGrupo)}</td>
                                <td className="p-2 border border-gray-300 text-center">
                                    {(() => {
                                        const secTot = tempUnit * 60;
                                        if (isNaN(secTot) || !isFinite(secTot) || secTot === 0) return "-";
                                        const mx = Math.floor(secTot / 60);
                                        const sx = Math.round(secTot % 60);
                                        return `${mx}m ${sx}s`;
                                    })()}
                                </td>
                                <td className="p-2 border border-gray-300 text-right text-green-700 font-semibold">
                                    {formatarMoeda(custoGrupo)}
                                </td>
                            </tr>
                        );
                    })}
                    {(!grupos || grupos.length === 0) && (
                        <tr>
                            <td colSpan={5} className="p-4 text-center text-gray-500 border border-gray-300">
                                Nenhuma produção encontrada para este período/filtro.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </ReportA4Layout>
    );
}
