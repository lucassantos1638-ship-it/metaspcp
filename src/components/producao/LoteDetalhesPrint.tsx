import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatarCusto } from "@/lib/custoUtils";
import { formatarTempoProdutivo } from "@/lib/timeUtils";

interface LoteDetalhesPrintProps {
    lote: any;
    quantidadeParaCalculo: number;
    custoAgregadoTotal: number;
    custoAgregadoUnit: number;
    tempoTotal: number;
    tempoUnitarioGeral: number;
    progressoPorEtapa: any[];
    consumos: any[];
}

export default function LoteDetalhesPrint({
    lote,
    quantidadeParaCalculo,
    custoAgregadoTotal,
    custoAgregadoUnit,
    tempoTotal,
    tempoUnitarioGeral,
    progressoPorEtapa,
    consumos
}: LoteDetalhesPrintProps) {
    const { user } = useAuth();

    const { data: empresa } = useQuery({
        queryKey: ["configuracoes-empresa-print", user?.empresa_id],
        queryFn: async () => {
            if (!user?.empresa_id) return null;
            const { data, error } = await supabase
                .from("empresas")
                .select("nome, cnpj")
                .eq("id", user.empresa_id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.empresa_id,
    });

    // Preparar dados de consumo para agrupamento
    const gruposConsumo = consumos?.length > 0 ? Object.values(consumos.reduce((acc: any, curr: any) => {
        const id = curr.material?.id || 'unknown';
        if (!acc[id]) acc[id] = { material: curr.material, itens: [] };
        acc[id].itens.push(curr);
        return acc;
    }, {})) : [];


    return (
        <div className="hidden print:block font-sans text-foreground bg-white w-full print:p-0 print:box-border mx-auto max-w-[210mm]">
            <div className="w-full bg-white relative print:box-border px-8 py-10 rounded-xl shadow-none">

                {/* Header (Logo Tópico / Empresa, CNPJ Direita) */}
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center relative overflow-hidden">
                            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-white absolute top-1.5"></div>
                            <div className="w-3 h-3 bg-white absolute bottom-1"></div>
                        </div>
                        <h1 className="text-xl font-extrabold text-[#1a2c51]">
                            {empresa?.nome || "Meta PCP"}
                        </h1>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium">
                        CNPJ: {empresa?.cnpj || "Não informado"}
                    </div>
                </div>

                {/* Título e Período/Lote */}
                <div className="mb-6">
                    <h2 className="text-[22px] font-bold text-[#20315c] mb-1 leading-tight">
                        Relatório de Detalhes do Lote
                    </h2>
                    <div className="text-[11px] text-muted-foreground font-medium">
                        Lote: #{lote?.numero_lote} - {lote?.nome_lote}
                        {lote?.produto ? ` | Produto: ${lote.produto.nome}` : ''}
                    </div>
                </div>

                {/* 4 Caixas de Resumo Livres de Cores de Fundo Fortes */}
                <div className="grid grid-cols-4 gap-3 mb-8">
                    <div className="border border-border/60 rounded-xl p-3 bg-white text-center flex flex-col justify-center py-4">
                        <div className="text-[9px] font-bold text-muted-foreground mb-1 uppercase">Total Produzido:</div>
                        <div className="text-[15px] font-bold text-[#1a2c51]">
                            {quantidadeParaCalculo} Peças
                        </div>
                    </div>
                    <div className="border border-border/60 rounded-xl p-3 bg-white text-center flex flex-col justify-center py-4">
                        <div className="text-[9px] font-bold text-muted-foreground mb-1 uppercase">Custo Total:</div>
                        <div className="text-[15px] font-bold text-[#1a2c51]">
                            {formatarCusto(custoAgregadoTotal)}
                        </div>
                    </div>
                    <div className="border border-border/60 rounded-xl p-3 bg-white text-center flex flex-col justify-center py-4">
                        <div className="text-[9px] font-bold text-muted-foreground mb-1 uppercase">Tempo Unit. Médio:</div>
                        <div className="text-[15px] font-bold text-[#1a2c51]">
                            {formatarTempoProdutivo(tempoUnitarioGeral)}
                        </div>
                    </div>
                    <div className="border border-border/60 rounded-xl p-3 bg-white text-center flex flex-col justify-center py-4">
                        <div className="text-[9px] font-bold text-muted-foreground mb-1 uppercase">Tempo Total:</div>
                        <div className="text-[15px] font-bold text-[#1a2c51]">
                            {formatarTempoProdutivo(tempoTotal)}
                        </div>
                    </div>
                </div>

                {/* Tabela de Progresso Detalhado */}
                <div className="mb-8">
                    <h3 className="text-[13px] font-bold text-[#20315c] mb-3">Progresso Detalhado</h3>
                    <div className="rounded-xl overflow-hidden shadow-none border border-transparent">
                        <table className="w-full text-[11px] text-left">
                            <thead className="bg-[#4a72a5] text-white">
                                <tr>
                                    <th className="px-4 py-2.5 font-semibold text-center w-1/4">Etapa</th>
                                    <th className="px-4 py-2.5 font-semibold text-center">Qtde (Progresso)</th>
                                    <th className="px-4 py-2.5 font-semibold text-center">Tempo Total</th>
                                    <th className="px-4 py-2.5 font-semibold text-center">Custo Total</th>
                                    <th className="px-4 py-2.5 font-semibold text-center">Temp. Unit.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {progressoPorEtapa?.length > 0 ? (
                                    progressoPorEtapa.map((etapa: any, idx: number) => {
                                        const qtdeProduzida = etapa.quantidade_produzida || 0;
                                        const qtdeTotal = etapa.quantidade_total || 0;
                                        const rowBg = idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white';
                                        const tempoUnit = qtdeProduzida > 0 ? etapa.tempo_total / qtdeProduzida : 0;

                                        return (
                                            <tr key={idx} className={rowBg}>
                                                <td className="px-4 py-2 font-bold text-[#4a72a5] uppercase text-[10px] text-center">
                                                    {etapa.subetapa_nome || etapa.etapa_nome}
                                                </td>
                                                <td className="px-4 py-2 text-center text-muted-foreground font-medium">
                                                    {qtdeProduzida} / {qtdeTotal}
                                                </td>
                                                <td className="px-4 py-2 text-center text-muted-foreground">{formatarTempoProdutivo(etapa.tempo_total)}</td>
                                                <td className="px-4 py-2 text-center text-muted-foreground font-semibold">{formatarCusto(etapa.custo_total)}</td>
                                                <td className="px-4 py-2 text-center text-muted-foreground">{formatarTempoProdutivo(tempoUnit)}</td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground italic">Nenhuma etapa ou acompanhamento registrado neste lote.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tabela de Consumo de Matéria Prima */}
                {consumos && consumos.length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-[13px] font-bold text-[#20315c] mb-3">Consumo de Matéria Prima</h3>
                        <div className="rounded-xl overflow-hidden shadow-none border border-transparent">
                            <table className="w-full text-[11px] text-left">
                                <thead className="bg-[#4a72a5] text-white">
                                    <tr>
                                        <th className="px-4 py-2.5 font-semibold text-center w-1/4">Material</th>
                                        <th className="px-4 py-2.5 font-semibold text-center">Quantidade</th>
                                        <th className="px-4 py-2.5 font-semibold text-center">Preço Unit.</th>
                                        <th className="px-4 py-2.5 font-semibold text-center">Custo Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {gruposConsumo.map((grupo: any, idx: number) => {

                                        // Somar valores para a linha do Material pai usando reduce
                                        const totalDeConsumosQtdeTotal = grupo.itens.reduce((acc: number, curr: any) => acc + (curr.quantidade_real || 0), 0);
                                        const custoUnitPadrao = grupo.material?.preco_custo || 0;
                                        const valorEmGasto = totalDeConsumosQtdeTotal * custoUnitPadrao;
                                        const rowBg = idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white';

                                        return (
                                            <tr key={idx} className={`${rowBg} border-b border-border/60 last:border-0`}>
                                                <td className="px-4 py-2 font-bold text-[#4a72a5] text-[10px] text-center">
                                                    {grupo.material?.nome || "Material sem nome"}
                                                </td>
                                                <td className="px-4 py-2 text-center text-muted-foreground font-medium">
                                                    {totalDeConsumosQtdeTotal} {grupo.material?.unidade_medida}
                                                </td>
                                                <td className="px-4 py-2 text-center text-muted-foreground">
                                                    {formatarCusto(custoUnitPadrao)}
                                                </td>
                                                <td className="px-4 py-2 text-center text-muted-foreground font-semibold">
                                                    {formatarCusto(valorEmGasto)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
