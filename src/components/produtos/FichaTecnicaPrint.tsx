import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatarCusto } from "@/lib/custoUtils";
import { formatarTempoProdutivo } from "@/lib/timeUtils";
import ReportA4Layout from "@/components/common/ReportA4Layout";

interface FichaTecnicaPrintProps {
    produto: any;
    etapas: any[];
    materiais: any[];
    metricas: any[];
    tempoTotalMedio: number;
    custoProducaoMedio: number;
    custoMaterialTotal: number;
    ultimosLotes?: any[];
}

export default function FichaTecnicaPrint({
    produto,
    etapas,
    materiais,
    metricas,
    tempoTotalMedio,
    custoProducaoMedio,
    custoMaterialTotal,
    ultimosLotes = []
}: FichaTecnicaPrintProps) {
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

    const custoProd = custoProducaoMedio || 0;
    const custoMat = custoMaterialTotal || 0;
    const custoTotalGeral = custoProd + custoMat;

    const dataAtual = new Date().toLocaleDateString('pt-BR');

    return (
        <ReportA4Layout title="Ficha Técnica de Produto" empresa={empresa}>
            {/* Página 1: Resumo e Materiais */}
            <div className="w-full bg-white relative print:box-border">

                {/* Info do Produto */}
                <div className="mb-6 bg-muted/10 p-4 rounded-lg border border-border/50">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">PRODUTO</span>
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-2xl font-bold text-primary">{produto?.nome}</h3>
                                <div className="text-sm font-mono mt-1 text-muted-foreground">SKU: {produto?.sku}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Status</div>
                                <div className="font-semibold">{produto?.ativo ? "Ativo" : "Inativo"}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5 Stats Boxes */}
                <div className="grid grid-cols-5 gap-3 mb-8">
                    <div className="border border-border rounded-lg p-3 bg-white text-center shadow-sm flex flex-col justify-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Estoque Atual</div>
                        <div className="text-xl font-bold text-foreground">
                            {Number(produto?.estoque || 0).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">un</span>
                        </div>
                    </div>
                    <div className="border border-border rounded-lg p-3 bg-white text-center shadow-sm flex flex-col justify-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Custo Total Unitário</div>
                        <div className="text-xl font-bold text-foreground">
                            {formatarCusto(custoTotalGeral)}
                        </div>
                        <div className="text-[8px] text-muted-foreground mt-1 leading-tight">Matéria Prima + Produção</div>
                    </div>
                    <div className="border border-border rounded-lg p-3 bg-white text-center shadow-sm flex flex-col justify-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Custo Matéria Prima</div>
                        <div className="text-xl font-bold text-foreground">
                            {formatarCusto(custoMat)}
                        </div>
                    </div>
                    <div className="border border-border rounded-lg p-3 bg-white text-center shadow-sm flex flex-col justify-center">
                        <div className="text-[10px] uppercase font-bold text-primary mb-1">Custo Produção Unitário</div>
                        <div className="text-xl font-bold text-primary">
                            {formatarCusto(custoProd)}
                        </div>
                    </div>
                    <div className="border border-border rounded-lg p-3 bg-white text-center shadow-sm flex flex-col justify-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Tempo Médio Produção</div>
                        <div className="text-xl font-bold text-foreground">
                            {formatarTempoProdutivo(tempoTotalMedio)}
                        </div>
                    </div>
                </div>

                {/* Materiais Table */}
                <div className="mb-6">
                    <h4 className="text-base font-bold text-foreground mb-2 border-b pb-1">Composição de Materiais (Receita)</h4>
                    <div className="rounded-md border border-border">
                        <table className="w-full text-xs text-left border-collapse [&_th]:border [&_th]:border-border [&_td]:border [&_td]:border-border/50">
                            <thead className="bg-[#4a72a5] text-white">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">Material</th>
                                    <th className="px-3 py-2 font-semibold text-right w-24">Quantidade</th>
                                    <th className="px-3 py-2 font-semibold text-right w-24">Custo Un.</th>
                                    <th className="px-3 py-2 font-semibold text-right w-24">Custo Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {materiais?.map((item: any, idx: number) => (
                                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-muted/5' : 'bg-white'}>
                                        <td className="px-3 py-1.5 font-medium text-foreground">
                                            {item.material?.nome} <span className="text-[9px] text-muted-foreground ml-1">({item.material?.codigo})</span>
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                            {Number(item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} <span className="text-[9px]">{item.material?.unidade_medida}</span>
                                        </td>
                                        <td className="px-3 py-1.5 text-right text-muted-foreground">{formatarCusto(item.material?.preco_custo || 0)}</td>
                                        <td className="px-3 py-1.5 text-right font-semibold">{formatarCusto((item.material?.preco_custo || 0) * item.quantidade)}</td>
                                    </tr>
                                ))}
                                {(!materiais || materiais.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground italic">Nenhum material vinculado à receita deste produto.</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-muted/20 font-bold border-t-2 border-border">
                                <tr>
                                    <td colSpan={3} className="px-3 py-2 text-right text-[11px] uppercase">Custo Total de Materiais</td>
                                    <td className="px-3 py-2 text-right text-primary text-sm">{formatarCusto(custoMat)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            {/* Quebra de página explicita se houver etapas para mostrar na segunda folha, dependendo do tamanho. 
                Aqui iteramos a ideia de que a impressão deve rolar suave, com a classe break-before-page */}
            <div className="w-full bg-white relative break-before-page pt-8">
                {/* Header Mini para paginas seguintes */}
                <div className="flex justify-between items-center border-b pb-2 mb-6 opacity-70">
                    <span className="text-xs font-medium">{produto?.nome} - SKU: {produto?.sku}</span>
                    <span className="text-xs">Ficha Técnica - Continuação</span>
                </div>

                {/* Etapas Table */}
                <div className="mb-8">
                    <h4 className="text-base font-bold text-foreground mb-2 border-b pb-1">Roteiro de Produção (Etapas)</h4>
                    <div className="rounded-md border border-border">
                        <table className="w-full text-xs text-left border-collapse [&_th]:border [&_th]:border-border [&_td]:border [&_td]:border-border/50">
                            <thead className="bg-[#4a72a5] text-white">
                                <tr>
                                    <th className="px-3 py-2 font-semibold w-10 text-center">#</th>
                                    <th className="px-3 py-2 font-semibold">Macro-Etapa</th>
                                    <th className="px-3 py-2 font-semibold">Subetapa (Operação)</th>
                                    <th className="px-3 py-2 font-semibold text-center w-20">Obrigatória</th>
                                    <th className="px-3 py-2 font-semibold text-right w-32">Tempo Médio/Pç</th>
                                    <th className="px-3 py-2 font-semibold text-right w-32">Custo Médio/Pç</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {etapas?.map((e: any, idx: number) => {
                                    const m = metricas?.find((me: any) => me.subetapa_nome === e.subetapa?.nome || me.etapa_nome === e.etapa?.nome);

                                    return (
                                        <tr key={e.id} className={idx % 2 === 0 ? 'bg-muted/5' : 'bg-white'}>
                                            <td className="px-3 py-2 text-center text-muted-foreground font-medium">{e.ordem}º</td>
                                            <td className="px-3 py-2 font-semibold">{e.etapa?.nome}</td>
                                            <td className="px-3 py-2 text-foreground">{e.subetapa?.nome || "-"}</td>
                                            <td className="px-3 py-2 text-center text-muted-foreground">
                                                {e.obrigatoria ? 'Sim' : 'Não'}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium text-primary">
                                                {m && m.tempo_medio_por_peca_minutos > 0 ? formatarTempoProdutivo(m.tempo_medio_por_peca_minutos) : "-"}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium text-green-700">
                                                {m && m.custo_medio_por_peca > 0 ? formatarCusto(m.custo_medio_por_peca) : "-"}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(!etapas || etapas.length === 0) && (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground italic">Nenhum roteiro de produção definido.</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-muted/20 font-bold border-t-2 border-border">
                                <tr>
                                    <td colSpan={4} className="px-3 py-2 text-right text-[11px] uppercase">Totais de Produção (Estimativa Baseada em Histórico)</td>
                                    <td className="px-3 py-2 text-right text-primary text-sm">{formatarTempoProdutivo(tempoTotalMedio)}</td>
                                    <td className="px-3 py-2 text-right text-green-700 text-sm">{formatarCusto(custoProd)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Últimos Lotes Analisados */}
                {ultimosLotes && ultimosLotes.length > 0 && (
                    <div className="mb-6 page-break-inside-avoid">
                        <h4 className="text-base font-bold text-foreground mb-2 border-b pb-1">Últimos Lotes Analisados</h4>
                        <div className="rounded-md border border-border">
                            <table className="w-full text-xs text-left border-collapse [&_th]:border [&_th]:border-border [&_td]:border [&_td]:border-border/50">
                                <thead className="bg-[#4a72a5] text-white">
                                    <tr>
                                        <th className="px-3 py-2 font-semibold">Lote</th>
                                        <th className="px-3 py-2 font-semibold text-right w-32">Tempo/Pç</th>
                                        <th className="px-3 py-2 font-semibold text-right w-32">Custo/Pç</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {ultimosLotes.slice(0, 3).map((l: any, idx: number) => (
                                        <tr key={l.id} className={idx % 2 === 0 ? 'bg-muted/5' : 'bg-white'}>
                                            <td className="px-3 py-1.5 font-medium text-blue-600">
                                                {l.numero_lote} <span className="text-[9px] text-muted-foreground ml-1 font-normal">({new Date(l.created_at).toLocaleDateString('pt-BR')})</span>
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-medium">
                                                {formatarTempoProdutivo(l.tempo_por_peca || 0)}
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-medium">
                                                {formatarCusto(l.custo_por_peca || 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-muted/20 font-bold border-t-2 border-border">
                                    <tr>
                                        <td className="px-3 py-2 text-right text-[11px] uppercase">Média Geral (Estes Lotes)</td>
                                        <td className="px-3 py-2 text-right text-primary text-sm">{formatarTempoProdutivo(tempoTotalMedio)}</td>
                                        <td className="px-3 py-2 text-right text-green-700 text-sm">{formatarCusto(custoProd)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </ReportA4Layout>
    );
}
