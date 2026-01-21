import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmpresaId } from "@/hooks/useEmpresaId";

interface AtividadeMeta {
    nome: string;
    tipo: "Etapa" | "Subetapa";
    produzido: number;
    meta: number;
    falta: number;
    percentual: number;
}

interface ColaboradorProgresso {
    colaborador: {
        id: string;
        nome: string;
    };
    atividades: AtividadeMeta[];
}

const ListaProgressoMetas = () => {
    const empresaId = useEmpresaId();
    const dataAtual = new Date();
    const mesAtualFormatado = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, "0")}`;
    const [mesAno, setMesAno] = useState(mesAtualFormatado);
    const [searchTerm, setSearchTerm] = useState("");

    const { data: progresso, isLoading } = useQuery({
        queryKey: ["progresso-metas-lista", mesAno, empresaId],
        enabled: !!mesAno && !!empresaId,
        queryFn: async (): Promise<ColaboradorProgresso[]> => {
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
          meta,
          etapas(nome),
          subetapas(nome)
        `)
                .eq("empresa_id", empresaId);

            if (!colaboradores || !metas) return [];

            // 3. Para cada colaborador, buscar suas produções e calcular progresso
            const progressoPromises = colaboradores.map(async (colaborador) => {
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

                if (!producoes || producoes.length === 0) {
                    return null;
                }

                const atividadesMap = new Map<string, AtividadeMeta>();

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
                            tipo: prod.subetapa_id ? "Subetapa" : "Etapa",
                            produzido: 0,
                            meta: metaConfig?.meta || 0,
                            falta: 0,
                            percentual: 0
                        });
                    }

                    const atual = atividadesMap.get(chave)!;
                    atual.produzido += prod.quantidade_produzida;
                });

                const atividadesCalc: AtividadeMeta[] = Array.from(atividadesMap.values()).map((a) => ({
                    ...a,
                    falta: Math.max(0, a.meta - a.produzido),
                    percentual: a.meta > 0 ? (a.produzido / a.meta) * 100 : 0
                }));

                const atividadesComMeta = atividadesCalc.filter((a) => a.meta > 0);

                if (atividadesComMeta.length === 0) return null;

                return {
                    colaborador,
                    atividades: atividadesComMeta
                };
            });

            const results = await Promise.all(progressoPromises);
            return results.filter((item): item is ColaboradorProgresso => item !== null);
        },
    });

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle>Acompanhamento de Metas</CardTitle>
                        <CardDescription>Progresso individual por atividade no mês selecionado</CardDescription>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Input
                            placeholder="Buscar colaborador..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-[200px]"
                        />
                        <Input
                            type="month"
                            value={mesAno}
                            onChange={(e) => setMesAno(e.target.value)}
                            className="w-full sm:w-[180px]"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center py-8">Carregando dados...</div>
                ) : !progresso || progresso.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Nenhuma meta em andamento encontrada para este período.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {progresso
                            .filter(item => item.colaborador.nome.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map((item) => (
                                <div key={item.colaborador.id} className="border rounded-md p-3 text-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                            {item.colaborador.nome.charAt(0)}
                                        </div>
                                        <h3 className="font-semibold text-base">{item.colaborador.nome}</h3>
                                    </div>

                                    {/* Desktop Table View */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="h-8">
                                                    <TableHead className="h-8 py-1">Atividade</TableHead>
                                                    <TableHead className="h-8 py-1 text-right">Meta</TableHead>
                                                    <TableHead className="h-8 py-1 text-right">Produzido</TableHead>
                                                    <TableHead className="h-8 py-1 text-right">Falta</TableHead>
                                                    <TableHead className="h-8 py-1 w-[200px]">Progresso</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {item.atividades.map((ativ: AtividadeMeta, idx: number) => (
                                                    <TableRow key={idx} className="h-8">
                                                        <TableCell className="py-1 font-medium">{ativ.nome}</TableCell>
                                                        <TableCell className="py-1 text-right">{ativ.meta}</TableCell>
                                                        <TableCell className="py-1 text-right">{ativ.produzido}</TableCell>
                                                        <TableCell className="py-1 text-right">
                                                            {ativ.falta > 0 ? (
                                                                <span className="text-red-500 font-semibold">{ativ.falta}</span>
                                                            ) : (
                                                                <span className="text-green-500 font-bold">✓</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-1">
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between text-[10px]">
                                                                    <span>{ativ.percentual.toFixed(1)}%</span>
                                                                    {ativ.percentual >= 100 && <span className="text-green-600 font-bold">Meta Batida!</span>}
                                                                </div>
                                                                <Progress
                                                                    value={Math.min(ativ.percentual, 100)}
                                                                    className={ativ.percentual >= 100 ? "bg-green-100 h-1.5" : "h-1.5"}
                                                                    indicatorClassName={ativ.percentual >= 100 ? "bg-green-500" : ""}
                                                                />
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Mobile List View */}
                                    <div className="md:hidden space-y-3 pt-2">
                                        {item.atividades.map((ativ: AtividadeMeta, idx: number) => (
                                            <div key={idx} className="bg-muted/30 rounded p-2.5">
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <span className="font-medium text-sm text-foreground/90">{ativ.nome}</span>
                                                    {ativ.falta <= 0 && <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-0.5 rounded-full">Batida!</span>}
                                                </div>

                                                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                                    <span>Meta: <strong className="text-foreground">{ativ.meta}</strong></span>
                                                    <span>Feito: <strong className="text-foreground">{ativ.produzido}</strong></span>
                                                    <span>Falta: <strong className={ativ.falta > 0 ? "text-red-500" : "text-green-500"}>{ativ.falta > 0 ? ativ.falta : "✓"}</strong></span>
                                                </div>

                                                <div className="space-y-1">
                                                    <Progress
                                                        value={Math.min(ativ.percentual, 100)}
                                                        className={ativ.percentual >= 100 ? "bg-green-100 h-2" : "h-2"}
                                                        indicatorClassName={ativ.percentual >= 100 ? "bg-green-500" : ""}
                                                    />
                                                    <div className="text-right text-[10px] font-bold text-primary">
                                                        {ativ.percentual.toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 flex items-center justify-end gap-3 border-t pt-2">
                                        <span className="font-bold text-sm">Pontuação Total:</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-lg font-bold text-primary">
                                                {item.atividades.reduce((acc, curr) => acc + curr.percentual, 0).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ListaProgressoMetas;
