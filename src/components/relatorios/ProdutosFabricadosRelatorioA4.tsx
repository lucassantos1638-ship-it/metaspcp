import React from "react";
import { formatarTempoProdutivo } from "@/lib/timeUtils";
import ReportA4Layout from "@/components/common/ReportA4Layout";

interface ProdutosFabricadosRelatorioA4Props {
    dados: any[];
    empresa: any;
    dataInicio: string;
    dataFim: string;
    modo?: "detalhado" | "resumido";
}

function formatarData(dateStr: string) {
    if (!dateStr || dateStr === "0000-00-00") return "-";
    const [ano, mes, dia] = dateStr.split("-");
    return `${dia}/${mes}/${ano}`;
}

export default function ProdutosFabricadosRelatorioA4({
    dados,
    empresa,
    dataInicio,
    dataFim,
    modo = "detalhado",
}: ProdutosFabricadosRelatorioA4Props) {
    const totalQuantidade = dados.reduce((sum, item) => sum + (item.quantidade || 0), 0);
    const totalLotes = dados.reduce((sum, item) => sum + (item.totalLotes || 0), 0);

    return (
        <ReportA4Layout title="Relatório de Produtos Fabricados" empresa={empresa}>
            {/* Período */}
            <div className="mb-6 break-inside-avoid">
                <h3 className="text-sm font-bold text-[#1D4ED8] mb-3 uppercase border-b border-gray-200 pb-1 break-after-avoid">Informações do Período</h3>
                <div className="grid grid-cols-2 gap-x-4">
                    <div>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Período:</span> {formatarData(dataInicio)} a {formatarData(dataFim)}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Total de Produtos:</span> {dados.length}</p>
                    </div>
                    <div>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Total de Lotes:</span> {totalLotes}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Total de Unidades Fabricadas:</span> {totalQuantidade.toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            </div>

            {/* Tabela de Produtos */}
            <div className="mb-6">
                <h3 className="text-sm font-bold text-[#1D4ED8] mb-3 uppercase border-b border-gray-200 pb-1 break-after-avoid">Produtos Fabricados</h3>
                <table className="w-full text-sm text-left border-collapse mb-2 border border-gray-300">
                    <thead className="bg-gray-100 text-gray-800 border-b border-gray-300">
                        <tr>
                            <th className="py-2 px-3 font-semibold border-r border-gray-300">Produto</th>
                            <th className="py-2 px-3 font-semibold text-center border-r border-gray-300">Lotes</th>
                            <th className="py-2 px-3 font-semibold text-right border-r border-gray-300">Qtd. Fabricada</th>
                            <th className="py-2 px-3 font-semibold text-right">Tempo Médio Unit.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dados.map((item, idx) => (
                            <React.Fragment key={idx}>
                                {/* Linha do Produto */}
                                <tr className={`border-b${modo === "detalhado" ? "-2" : ""} border-gray-300 bg-gray-50 break-inside-avoid font-semibold text-gray-800`}>
                                    <td className="py-2 px-3 border-r border-gray-300">
                                        {item.nome}
                                        {item.sku && <span className="text-xs font-normal text-gray-500 ml-2">({item.sku})</span>}
                                    </td>
                                    <td className="py-2 px-3 text-center border-r border-gray-300">{item.totalLotes}</td>
                                    <td className="py-2 px-3 text-right border-r border-gray-300 text-blue-700 font-bold">{item.quantidade.toLocaleString('pt-BR')}</td>
                                    <td className="py-2 px-3 text-right text-blue-700">{formatarTempoProdutivo(item.tempoMedio)}</td>
                                </tr>

                                {/* Linhas dos Lotes (apenas no modo detalhado) */}
                                {modo === "detalhado" && item.lotesRelacionados?.map((lote: any, loteIdx: number) => (
                                    <tr key={`${idx}-${loteIdx}`} className="border-b border-gray-100 hover:bg-gray-50 break-inside-avoid text-gray-600">
                                        <td className="py-1 px-3 border-r border-gray-200 pl-6 border-l-2 border-l-blue-300">
                                            <span className="font-medium">{lote.numero_lote}</span>
                                            {lote.nome_lote && <span className="text-xs text-gray-400 ml-2">- {lote.nome_lote}</span>}
                                            {lote.ultimaData && lote.ultimaData !== "0000-00-00" && (
                                                <span className="text-xs text-gray-400 ml-2">(Fabricado: {formatarData(lote.ultimaData)})</span>
                                            )}
                                        </td>
                                        <td className="py-1 px-3 text-center border-r border-gray-200">-</td>
                                        <td className="py-1 px-3 text-right border-r border-gray-200">{(lote.quantidade_total || 0).toLocaleString('pt-BR')}</td>
                                        <td className="py-1 px-3 text-right">{formatarTempoProdutivo(lote.tempoMedioLote)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                    {/* Totais */}
                    <tbody className="bg-gray-50 border-t-2 border-gray-300 break-inside-avoid">
                        <tr>
                            <td className="py-2 px-3 font-bold border-r border-gray-300">TOTAL</td>
                            <td className="py-2 px-3 text-center font-bold border-r border-gray-300">{totalLotes}</td>
                            <td className="py-2 px-3 text-right font-bold text-[#1D4ED8] border-r border-gray-300">{totalQuantidade.toLocaleString('pt-BR')}</td>
                            <td className="py-2 px-3 text-right font-bold text-[#1D4ED8]">-</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </ReportA4Layout>
    );
}
