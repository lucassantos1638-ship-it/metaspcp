import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ColaboradorDesempenho {
    colaboradorId: string;
    colaboradorNome: string;
    totalPercentual: number;
    atividades: string[];
}

const getStatusEmoji = (percentual: number) => {
    if (percentual >= 100) return "✅";
    if (percentual >= 90) return "🔥";
    return "📈";
};

const getStatusText = (percentual: number) => {
    if (percentual >= 100) return "Meta Batida";
    if (percentual >= 90) return "Acima de 90%";
    return "Em Progresso";
};

const ListaResumidaMetas = () => {
    const empresaId = useEmpresaId();
    const dataAtual = new Date();
    const mesAtualFormatado = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, "0")}`;
    const [mesAno, setMesAno] = useState(mesAtualFormatado);

    const { data: ranking, isLoading } = useQuery({
        queryKey: ["metas-agrupadas-v2", mesAno, empresaId],
        enabled: !!mesAno && !!empresaId,
        queryFn: async (): Promise<ColaboradorDesempenho[]> => {
            const [ano, mes] = mesAno.split("-");
            const dataInicio = `${ano}-${mes}-01`;
            const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
            const dataFim = `${ano}-${mes}-${ultimoDia}`;

            // 1. Buscar colaboradores ativos
            const { data: colaboradores } = await supabase
                .from("colaboradores")
                .select("id, nome")
                .eq("empresa_id", empresaId)
                .eq("ativo", true)
                .order("nome");

            // 2. Buscar definições de metas
            const { data: metas } = await supabase
                .from("metas")
                .select(`
          etapa_id,
          subetapa_id,
          meta
        `)
                .eq("empresa_id", empresaId);

            if (!colaboradores || !metas) return [];

            const listaAgrupada: ColaboradorDesempenho[] = [];

            for (const colaborador of colaboradores) {
                // Buscar produção do colaborador
                const { data: producoes } = await supabase
                    .from("producoes")
                    .select(`
            etapa_id,
            subetapa_id,
            quantidade_produzida,
            etapas(nome),
            subetapas(nome)
          `)
                    .eq("colaborador_id", colaborador.id)
                    .gte("data_inicio", dataInicio)
                    .lte("data_inicio", dataFim);

                if (!producoes || producoes.length === 0) continue;

                // Agrupar produção e coletar nomes
                const atividadesMap = new Map();

                producoes.forEach((prod: any) => {
                    const chave = prod.subetapa_id
                        ? `sub-${prod.subetapa_id}`
                        : `etapa-${prod.etapa_id}`;

                    const metaConfig = metas.find((m: any) =>
                        prod.subetapa_id
                            ? m.subetapa_id === prod.subetapa_id
                            : (m.etapa_id === prod.etapa_id && !m.subetapa_id)
                    );

                    if (!atividadesMap.has(chave)) {
                        atividadesMap.set(chave, {
                            nome: prod.subetapa_id ? prod.subetapas?.nome : prod.etapas?.nome,
                            produzido: 0,
                            meta: metaConfig?.meta || 0,
                        });
                    }

                    const atual = atividadesMap.get(chave);
                    atual.produzido += prod.quantidade_produzida;
                });

                // Calcular Score Total e listar atividades
                let totalPercentual = 0;
                let temMetasDefinidas = false;
                const atividadesNomes: string[] = [];

                atividadesMap.forEach((dados) => {
                    if (dados.meta > 0) {
                        const percentual = (dados.produzido / dados.meta) * 100;
                        totalPercentual += percentual;
                        temMetasDefinidas = true;
                        if (dados.nome) atividadesNomes.push(dados.nome);
                    }
                });

                if (temMetasDefinidas) {
                    listaAgrupada.push({
                        colaboradorId: colaborador.id,
                        colaboradorNome: colaborador.nome,
                        totalPercentual: totalPercentual,
                        atividades: atividadesNomes
                    });
                }
            }

            return listaAgrupada.sort((a, b) => b.totalPercentual - a.totalPercentual);
        },
    });

    const handlePrint = () => {
        window.print();
    };

    const [ano, mes] = mesAno.split("-");
    const dataReferencia = new Date(parseInt(ano), parseInt(mes) - 1, 1);
    const mesExtenso = format(dataReferencia, "MMMM 'de' yyyy", { locale: ptBR });

    return (
        <>
            <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 2cm;
          }
          body {
            visibility: hidden;
            background: white;
          }
          #printable-content {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          #printable-content table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          #printable-content th, #printable-content td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          #printable-content th {
            background-color: #f3f3f3 !important;
            font-weight: bold;
          }
          /* Ensure headers repeat on new pages */
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; }
          
          /* Hide interactive elements */
          .no-print { display: none !important; }
        }
      `}</style>

            {/* Visible Content */}
            <Card className="no-print">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <CardTitle>Metas</CardTitle>
                            <CardDescription>Acompanhamento mensal: {mesExtenso}</CardDescription>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Input
                                type="month"
                                value={mesAno}
                                onChange={(e) => setMesAno(e.target.value)}
                                className="w-full sm:w-[180px]"
                            />
                            <Button onClick={handlePrint} variant="outline" className="gap-2">
                                <Printer className="h-4 w-4" />
                                Imprimir
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8">Carregando...</div>
                    ) : !ranking || ranking.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Nenhuma meta registrada neste período.
                        </div>
                    ) : (
                        <>
                            {/* Desktop View (Table) */}
                            <div className="hidden md:block rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[200px]">Colaborador</TableHead>
                                            <TableHead>Atividades Realizadas</TableHead>
                                            <TableHead className="text-center w-[150px]">Status</TableHead>
                                            <TableHead className="text-right w-[150px]">Pontuação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ranking.map((item) => (
                                            <TableRow key={item.colaboradorId} className="h-10">
                                                <TableCell className="font-medium py-2">{item.colaboradorNome}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground py-2">
                                                    {item.atividades.join(", ")}
                                                </TableCell>
                                                <TableCell className="text-center py-2">
                                                    <Badge variant={item.totalPercentual >= 100 ? "default" : "secondary"} className="h-6">
                                                        {getStatusEmoji(item.totalPercentual)} {getStatusText(item.totalPercentual)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-lg py-2">
                                                    {item.totalPercentual.toFixed(1)}%
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile View (Cards) */}
                            <div className="md:hidden space-y-3">
                                {ranking.map((item) => (
                                    <div key={item.colaboradorId} className="bg-card rounded-lg border p-4 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold text-base">{item.colaboradorNome}</h3>
                                            <div className="text-right">
                                                <span className="block font-bold text-xl text-primary">{item.totalPercentual.toFixed(1)}%</span>
                                            </div>
                                        </div>

                                        <Badge variant={item.totalPercentual >= 100 ? "default" : "secondary"} className="mb-3 w-fit">
                                            {getStatusEmoji(item.totalPercentual)} {getStatusText(item.totalPercentual)}
                                        </Badge>

                                        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                                            <span className="font-semibold text-foreground block mb-1">Atividades:</span>
                                            {item.atividades.length > 0 ? item.atividades.join(", ") : "Nenhuma atividade"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Printable Content (Hidden on screen) */}
            <div id="printable-content" className="hidden print:block">
                <div className="mb-6 border-b pb-4">
                    <h1 className="text-2xl font-bold uppercase text-center mb-2">Relatório de Metas</h1>
                    <div className="flex justify-between text-sm text-gray-600">
                        <p><strong>Mês de Referência:</strong> {mesExtenso}</p>
                        <p><strong>Data de Emissão:</strong> {format(dataAtual, "dd/MM/yyyy HH:mm")}</p>
                    </div>
                </div>

                {ranking && ranking.length > 0 && (
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="text-left p-2 border">Colaborador</th>
                                <th className="text-left p-2 border">Atividades Realizadas</th>
                                <th className="text-center p-2 border">Status</th>
                                <th className="text-right p-2 border">Pontuação (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ranking.map((item) => (
                                <tr key={item.colaboradorId}>
                                    <td className="p-2 border">{item.colaboradorNome}</td>
                                    <td className="p-2 border text-sm">{item.atividades.join(", ")}</td>
                                    <td className="p-2 border text-center">
                                        {getStatusText(item.totalPercentual)}
                                    </td>
                                    <td className="p-2 border text-right font-bold">
                                        {item.totalPercentual.toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                <div className="mt-8 pt-8 border-t text-center text-xs text-gray-500">
                    <p>Relatório gerado automaticamente pelo sistema Meta PCP.</p>
                </div>
            </div>
        </>
    );
};

export default ListaResumidaMetas;
