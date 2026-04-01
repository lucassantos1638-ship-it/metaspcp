import React from "react";
import ReportA4Layout from "@/components/common/ReportA4Layout";
import { Progress } from "@/components/ui/progress";

interface MetasRelatorioA4Props {
    empresa: any;
    mesAno: string;
    progresso: any[]; // ColaboradorProgresso[]
}

export default function MetasRelatorioA4({
    empresa,
    mesAno,
    progresso
}: MetasRelatorioA4Props) {
    const [ano, mes] = mesAno.split("-");
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const nomeMes = meses[parseInt(mes) - 1];

    return (
        <ReportA4Layout title={`Relatório de Metas - ${nomeMes}/${ano}`} empresa={empresa}>
            <div className="mb-8 break-inside-avoid">
                <h3 className="text-sm font-bold text-[#1D4ED8] mb-3 uppercase border-b border-gray-200 pb-1 break-after-avoid">Acompanhamento de Metas</h3>
                
                {progresso.map((item, idx) => {
                    const pontuacaoTotal = item.atividades.reduce((acc: number, curr: any) => acc + curr.percentual, 0).toFixed(1);
                    return (
                        <div key={idx} className="mb-6 break-inside-avoid">
                            <h4 className="font-bold text-gray-800 mb-2">{item.colaborador.nome}</h4>
                            <table className="w-full text-sm text-left border-collapse mb-2 border border-gray-300">
                                <thead className="bg-gray-100 text-gray-800 border-b border-gray-300">
                                    <tr>
                                        <th className="py-2 px-3 font-semibold border-r border-gray-300">Atividade</th>
                                        <th className="py-2 px-3 font-semibold text-right border-r border-gray-300">Meta</th>
                                        <th className="py-2 px-3 font-semibold text-right border-r border-gray-300">Produzido</th>
                                        <th className="py-2 px-3 font-semibold text-right border-r border-gray-300">Falta</th>
                                        <th className="py-2 px-3 font-semibold w-[150px]">Progresso</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {item.atividades.map((ativ: any, aIdx: number) => (
                                        <tr key={aIdx} className="border-b border-gray-100 hover:bg-gray-50 break-inside-avoid text-gray-600">
                                            <td className="py-1 px-3 border-r border-gray-200">{ativ.nome}</td>
                                            <td className="py-1 px-3 text-right border-r border-gray-200">{ativ.meta}</td>
                                            <td className="py-1 px-3 text-right border-r border-gray-200">{ativ.produzido}</td>
                                            <td className="py-1 px-3 text-right border-r border-gray-200">
                                                {ativ.falta > 0 ? (
                                                    <span className="text-red-500 font-semibold">{ativ.falta}</span>
                                                ) : (
                                                    <span className="text-green-500 font-bold">✓</span>
                                                )}
                                            </td>
                                            <td className="py-1 px-3">
                                                <div className="flex justify-between text-[10px] mb-1">
                                                    <span>{ativ.percentual.toFixed(1)}%</span>
                                                </div>
                                                <Progress
                                                    value={Math.min(ativ.percentual, 100)}
                                                    className={ativ.percentual >= 100 ? "bg-green-100 h-1.5" : "h-1.5"}
                                                    indicatorClassName={ativ.percentual >= 100 ? "bg-green-500" : "bg-primary"}
                                                    style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tbody className="bg-gray-50 border-t-2 border-gray-300 break-inside-avoid">
                                    <tr>
                                        <td colSpan={4} className="py-2 px-3 text-right font-bold border-r border-gray-200">Pontuação Total:</td>
                                        <td className="py-2 px-3 font-bold text-[#1D4ED8]">
                                            {pontuacaoTotal}%
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>
        </ReportA4Layout>
    );
}
