import React, { Fragment } from "react";
import { formatarCusto } from "@/lib/custoUtils";
import { formatarTempoProdutivo } from "@/lib/timeUtils";
import ReportA4Layout from "@/components/common/ReportA4Layout";

interface LoteRelatorioA4Props {
    lote: any;
    empresa: any;
    quantidadeParaCalculo: number;
    custoAgregadoTotal: number;
    custoAgregadoUnit: number;
    tempoTotal: number;
    tempoUnitarioGeral: number;
    progressoPorEtapa: any[];
    consumos: any[];
}

export default function LoteRelatorioA4({
    lote,
    empresa,
    quantidadeParaCalculo,
    custoAgregadoTotal,
    custoAgregadoUnit,
    tempoTotal,
    tempoUnitarioGeral,
    progressoPorEtapa,
    consumos
}: LoteRelatorioA4Props) {
    const gruposConsumo = consumos?.length > 0 ? Object.values(consumos.reduce((acc: any, curr: any) => {
        const id = curr.material?.id || 'unknown';
        if (!acc[id]) acc[id] = { material: curr.material, itens: [] };
        acc[id].itens.push(curr);
        return acc;
    }, {})) : [];

    // Agrupamento de Subetapas por Etapa para Totais Parciais
    const etapasAgrupadas = progressoPorEtapa?.reduce((acc: any, curr: any) => {
        const id = curr.etapa_nome || 'avulso';
        if (!acc[id]) {
            acc[id] = { nome: curr.etapa_nome, itens: [], tempo_total: 0, custo_total: 0, quantidade_produzida: 0 };
        }
        acc[id].itens.push(curr);
        acc[id].tempo_total += (curr.tempo_total || 0);
        acc[id].custo_total += (curr.custo_total || 0);
        acc[id].quantidade_produzida += (curr.quantidade_produzida || 0);
        return acc;
    }, {});

    const gruposEtapas = etapasAgrupadas ? Object.values(etapasAgrupadas) : [];

    return (
        <ReportA4Layout title="Relatório do Lote" empresa={empresa}>
            {/* Informações Gerais */}
            <div className="mb-8 break-inside-avoid">
                <h3 className="text-sm font-bold text-[#1D4ED8] mb-3 uppercase border-b border-gray-200 pb-1 break-after-avoid">Informações Gerais</h3>
                <div className="grid grid-cols-2 gap-x-4">
                    <div>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Lote:</span> {lote.numero_lote || lote.nome}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Produto:</span> {lote.produto?.nome}</p>
                        <p className="text-sm mb-1">
                            <span className="font-semibold text-gray-600">Data de Início:</span> {
                                lote.data_inicio ? new Date(lote.data_inicio).toLocaleDateString('pt-BR') :
                                    (lote.created_at ? new Date(lote.created_at).toLocaleDateString('pt-BR') : 'Não informada')
                            }
                        </p>
                        <p className="text-sm mb-1">
                            <span className="font-semibold text-gray-600">Data de Conclusão:</span> {
                                lote.data_conclusao ? new Date(lote.data_conclusao).toLocaleDateString('pt-BR') : 'Em andamento'
                            }
                        </p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Quantidade Produzida:</span> {quantidadeParaCalculo} un.</p>
                    </div>
                    <div>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Custo Total (Lote):</span> {formatarCusto(custoAgregadoTotal)}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Custo Unitário Médio:</span> {formatarCusto(custoAgregadoUnit)}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Tempo Total:</span> {formatarTempoProdutivo(tempoTotal)}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Tempo Unit. Médio:</span> {formatarTempoProdutivo(tempoUnitarioGeral)}</p>
                    </div>
                </div>
            </div>

            {/* Progresso por Etapa */}
            <div className="mb-8">
                <h3 className="text-sm font-bold text-[#1D4ED8] mb-3 uppercase border-b border-gray-200 pb-1 break-after-avoid">Progresso por Etapa</h3>
                <table className="w-full text-sm text-left border-collapse mb-2 border border-gray-300">
                    <thead className="bg-gray-100 text-gray-800 border-b border-gray-300">
                        <tr>
                            <th className="py-2 px-3 font-semibold border-r border-gray-300">Etapa</th>
                            <th className="py-2 px-3 font-semibold text-center border-r border-gray-300">Progresso</th>
                            <th className="py-2 px-3 font-semibold text-right border-r border-gray-300">Tempo Total</th>
                            <th className="py-2 px-3 font-semibold text-right border-r border-gray-300">Custo Total</th>
                            <th className="py-2 px-3 font-semibold text-right">Temp. Unit.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gruposEtapas.length > 0 ? (
                            gruposEtapas.map((grupo: any, grupoIdx: number) => {
                                const tempoUnitGrupo = grupo.itens.reduce((sum: number, etapa: any) => {
                                    return sum + (etapa.quantidade_produzida > 0 ? etapa.tempo_total / etapa.quantidade_produzida : 0);
                                }, 0);

                                return (
                                    <Fragment key={grupoIdx}>
                                        {/* Linhas das Subetapas deste Grupo */}
                                        {grupo.itens.map((etapa: any, idx: number) => {
                                            const qtdeProduzida = etapa.quantidade_produzida || 0;
                                            const qtdeTotal = etapa.quantidade_total || 0;
                                            const tempoUnit = qtdeProduzida > 0 ? etapa.tempo_total / qtdeProduzida : 0;

                                            return (
                                                <tr key={`${grupoIdx}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50 break-inside-avoid text-gray-600">
                                                    <td className="py-1 px-3 border-r border-gray-200 pl-6 border-l-2 border-l-blue-300">
                                                        {etapa.subetapa_nome || "Processo"}
                                                    </td>
                                                    <td className="py-1 px-3 text-center border-r border-gray-200">
                                                        {qtdeProduzida} / {qtdeTotal}
                                                    </td>
                                                    <td className="py-1 px-3 text-right border-r border-gray-200">
                                                        {formatarTempoProdutivo(etapa.tempo_total)}
                                                    </td>
                                                    <td className="py-1 px-3 text-right border-r border-gray-200">
                                                        {formatarCusto(etapa.custo_total)}
                                                    </td>
                                                    <td className="py-1 px-3 text-right">
                                                        {formatarTempoProdutivo(tempoUnit)}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* Subtotal da Etapa Pai */}
                                        <tr className="border-b-2 border-gray-300 bg-gray-50 break-inside-avoid font-semibold tracking-tight text-gray-800">
                                            <td className="py-2 px-3 border-r border-gray-300">
                                                {grupo.nome} <span className="text-xs font-normal text-gray-500 ml-1">(Total da Etapa)</span>
                                            </td>
                                            <td className="py-2 px-3 text-center border-r border-gray-300">
                                                -
                                            </td>
                                            <td className="py-2 px-3 text-right border-r border-gray-300 text-blue-700">
                                                {formatarTempoProdutivo(grupo.tempo_total)}
                                            </td>
                                            <td className="py-2 px-3 text-right border-r border-gray-300 text-blue-700">
                                                {formatarCusto(grupo.custo_total)}
                                            </td>
                                            <td className="py-2 px-3 text-right text-blue-700">
                                                {formatarTempoProdutivo(tempoUnitGrupo)}
                                            </td>
                                        </tr>
                                    </Fragment>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={5} className="py-4 px-3 text-center text-gray-500 italic border-b border-gray-200">Nenhuma etapa ou acompanhamento registrado neste lote.</td>
                            </tr>
                        )}
                    </tbody>
                    <tbody className="bg-gray-50 border-t-2 border-gray-300 break-inside-avoid">
                        <tr>
                            <td colSpan={2} className="py-2 px-3 text-right font-bold border-r border-gray-200">Total Produção:</td>
                            <td className="py-2 px-3 text-right font-bold border-r border-gray-200">
                                {formatarTempoProdutivo(tempoTotal)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-[#1D4ED8]">
                                {formatarCusto(progressoPorEtapa?.reduce((acc: number, curr: any) => acc + (curr.custo_total || 0), 0) || 0)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold">
                                {formatarTempoProdutivo(tempoUnitarioGeral)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Consumo de Matéria Prima */}
            {
                consumos && consumos.length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-[#1D4ED8] mb-3 uppercase border-b border-gray-200 pb-1 break-after-avoid">Consumo de Matéria Prima</h3>
                        <table className="w-full text-sm text-left border-collapse mb-2 border border-gray-300">
                            <thead className="bg-gray-100 text-gray-800 border-b border-gray-300">
                                <tr>
                                    <th className="py-2 px-3 font-semibold border-r border-gray-300">Material</th>
                                    <th className="py-2 px-3 font-semibold text-center border-r border-gray-300">Quantidade</th>
                                    <th className="py-2 px-3 font-semibold text-right border-r border-gray-300">Preço Unit.</th>
                                    <th className="py-2 px-3 font-semibold text-right">Custo Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gruposConsumo.map((grupo: any, idx: number) => {
                                    const totalDeConsumosQtdeTotal = grupo.itens?.reduce((acc: number, curr: any) => acc + (curr.quantidade_real || 0), 0) || 0;
                                    const custoUnitPadrao = grupo.material?.preco_custo || 0;
                                    const valorEmGasto = totalDeConsumosQtdeTotal * custoUnitPadrao;

                                    return (
                                        <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 break-inside-avoid">
                                            <td className="py-2 px-3 border-r border-gray-200 font-medium">
                                                {grupo.material?.nome || "Material sem nome"}
                                            </td>
                                            <td className="py-2 px-3 text-center border-r border-gray-200">
                                                {totalDeConsumosQtdeTotal} {grupo.material?.unidade_medida}
                                            </td>
                                            <td className="py-2 px-3 text-right border-r border-gray-200">
                                                {formatarCusto(custoUnitPadrao)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-medium">
                                                {formatarCusto(valorEmGasto)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            {/* Totais de Material, conforme regras, se quiser podemos somar no final da tabela. Como solicitou manter enxuto e organizado: */}
                            {/* Totais de Material, usamos tbody no lugar de tfoot para evitar repetição em impressões com mais de uma página */}
                            <tbody className="bg-gray-50 border-t-2 border-gray-300 break-inside-avoid">
                                <tr>
                                    <td colSpan={3} className="py-2 px-3 text-right font-bold border-r border-gray-200">Total em Matéria Prima:</td>
                                    <td className="py-2 px-3 text-right font-bold text-[#1D4ED8]">
                                        {formatarCusto(
                                            Number(
                                                gruposConsumo.reduce((accTotal: number, grupo: any) => {
                                                    const totalQtde = grupo.itens?.reduce((acc: number, curr: any) => acc + (Number(curr.quantidade_real) || 0), 0) || 0;
                                                    return accTotal + (totalQtde * (Number(grupo.material?.preco_custo) || 0));
                                                }, 0)
                                            )
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )
            }
        </ReportA4Layout>
    );
}
