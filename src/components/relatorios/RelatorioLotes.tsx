import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatarTempoProdutivo, formatarData } from "@/lib/timeUtils";
import { calcularCusto, formatarCusto } from "@/lib/custoUtils";
import { FullscreenWrapper } from "@/components/ui/fullscreen-wrapper";
import { useEmpresaId } from "@/hooks/useEmpresaId";

const RelatorioLotes = () => {
  const empresaId = useEmpresaId();
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [mesAno, setMesAno] = useState<string>("");
  const [numeroLote, setNumeroLote] = useState<string>("");
  const [loteExpandido, setLoteExpandido] = useState<string | null>(null);

  const { data: lotes, isLoading } = useQuery({
    queryKey: ["relatorio-lotes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: detalhesLote } = useQuery({
    queryKey: ["detalhes-lote", loteExpandido, empresaId],
    enabled: !!loteExpandido && !!empresaId,
    queryFn: async () => {
      if (!loteExpandido) return null;

      try {
        const { data: etapas, error: errorEtapas } = await supabase
          .from("etapas")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("ordem");

        if (errorEtapas) throw errorEtapas;

        // Fetch from producoes_com_tempo which includes pre-calculated times and costs
        const { data: producoes, error: errorProducoes } = await supabase
          .from("producoes_com_tempo")
          .select("*")
          .eq("lote_id", loteExpandido)
          .order("created_at", { ascending: true }); // Ensure order for consistent reduction if needed

        if (errorProducoes) throw errorProducoes;

        const detalhes = await Promise.all(
          (etapas || []).map(async (etapa) => {
            const producoesEtapa = (producoes || []).filter(
              (p) => p.etapa_id === etapa.id
            );

            const produzido = producoesEtapa.reduce(
              (sum, p) => sum + (p.quantidade_produzida || 0),
              0
            );

            const tempo = producoesEtapa.reduce(
              (sum, p) => sum + (p.minutos_normais || 0) + (p.minutos_extras || 0),
              0
            );

            // Calculate exact cost using normal and extra hours
            const custoEtapaVal = producoesEtapa.reduce((sum, p) => {
              const custoNormal = (p.minutos_normais || 0) * ((p.colaborador_custo_hora || 0) / 60);
              const custoExtra = (p.minutos_extras || 0) * ((p.colaborador_custo_extra || 0) / 60);
              return sum + custoNormal + custoExtra;
            }, 0);

            const { data: subetapas } = await supabase
              .from("subetapas")
              .select("*")
              .eq("etapa_id", etapa.id);

            const subdetalhes = (subetapas || []).map((sub) => {
              const prodSub = (producoes || []).filter((p) => p.subetapa_id === sub.id);

              const tempoSub = prodSub.reduce(
                (sum, p) => sum + (p.minutos_normais || 0) + (p.minutos_extras || 0),
                0
              );

              const custoSubVal = prodSub.reduce((sum, p) => {
                const custoNormal = (p.minutos_normais || 0) * ((p.colaborador_custo_hora || 0) / 60);
                const custoExtra = (p.minutos_extras || 0) * ((p.colaborador_custo_extra || 0) / 60);
                return sum + custoNormal + custoExtra;
              }, 0);

              return {
                nome: sub.nome,
                produzido: prodSub.reduce((sum, p) => sum + (p.quantidade_produzida || 0), 0),
                tempo: tempoSub,
                custo: custoSubVal,
              };
            });

            return {
              etapa: etapa.nome,
              produzido,
              tempo,
              custo: custoEtapaVal,
              subetapas: subdetalhes,
            };
          })
        );

        const lote = lotes?.find((l) => l.id === loteExpandido);
        const tempoTotal = detalhes.reduce((sum, d) => sum + d.tempo, 0);
        const custoTotal = detalhes.reduce((sum, d) => sum + d.custo, 0);

        return {
          lote,
          etapas: detalhes,
          tempoTotal,
          custoTotal,
        };
      } catch (error) {
        console.error("Critical error in details query:", error);
        throw error;
      }
    },
  });

  const lotesFiltrados = lotes?.filter((lote) => {
    if (statusFiltro === "finalizados" && !lote.finalizado) return false;
    if (statusFiltro === "pendentes" && lote.finalizado) return false;
    if (numeroLote && !lote.numero_lote.toLowerCase().includes(numeroLote.toLowerCase())) return false;
    if (mesAno) {
      const [ano, mes] = mesAno.split("-");
      const dataLote = new Date(lote.created_at);
      if (dataLote.getFullYear() !== parseInt(ano) || dataLote.getMonth() + 1 !== parseInt(mes)) {
        return false;
      }
    }
    return true;
  });

  return (
    <FullscreenWrapper title="Relatório de Lotes">
      <Card>
        <CardHeader>
          <CardTitle>Relatório de Lotes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="finalizados">Finalizados</SelectItem>
                <SelectItem value="pendentes">Pendentes</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="month"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              placeholder="Mês/Ano"
            />

            <Input
              type="text"
              value={numeroLote}
              onChange={(e) => setNumeroLote(e.target.value)}
              placeholder="Buscar por número do lote"
            />
          </div>

          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : lotesFiltrados && lotesFiltrados.length > 0 ? (
            <div className="space-y-4">
              {lotesFiltrados.map((lote) => (
                <Collapsible
                  key={lote.id}
                  open={loteExpandido === lote.id}
                  onOpenChange={(open) => setLoteExpandido(open ? lote.id : null)}
                >
                  <Card>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div className="flex items-center gap-4">
                          {loteExpandido === lote.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div className="text-left">
                            <h3 className="font-semibold">Lote {lote.numero_lote}</h3>
                            <p className="text-sm text-muted-foreground">{lote.nome_lote}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            Criado em {formatarData(lote.created_at.split("T")[0])}
                          </span>
                          <Badge variant={lote.finalizado ? "default" : "secondary"}>
                            {lote.finalizado ? "Finalizado" : "Em andamento"}
                          </Badge>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                          <div>
                            <p className="text-sm text-muted-foreground">Quantidade Total</p>
                            <p className="text-2xl font-bold">{lote.quantidade_total}</p>
                          </div>
                          {detalhesLote && (
                            <>
                              <div>
                                <p className="text-sm text-muted-foreground">Tempo Total</p>
                                <p className="text-2xl font-bold">
                                  {formatarTempoProdutivo(detalhesLote.tempoTotal)}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Custo Total</p>
                                <p className="text-2xl font-bold text-green-600">
                                  {formatarCusto(detalhesLote.custoTotal)}
                                </p>
                              </div>
                            </>
                          )}
                        </div>

                        {detalhesLote && (
                          <div className="overflow-x-auto -mx-4 sm:mx-0">
                            <Table className="min-w-[640px]">
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Etapa</TableHead>
                                  <TableHead className="text-right">Planejado</TableHead>
                                  <TableHead className="text-right">Produzido</TableHead>
                                  <TableHead className="text-right">Faltante</TableHead>
                                  <TableHead className="text-right">Tempo</TableHead>
                                  <TableHead className="text-right">Custo</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {detalhesLote.etapas.map((etapa, idx) => (
                                  <>
                                    <TableRow key={idx}>
                                      <TableCell className="font-medium">{etapa.etapa}</TableCell>
                                      <TableCell className="text-right">{lote.quantidade_total}</TableCell>
                                      <TableCell className="text-right">{etapa.produzido}</TableCell>
                                      <TableCell className="text-right">
                                        {lote.quantidade_total - etapa.produzido}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatarTempoProdutivo(etapa.tempo)}
                                      </TableCell>
                                      <TableCell className="text-right text-green-600 font-semibold">
                                        {formatarCusto(etapa.custo)}
                                      </TableCell>
                                      <TableCell>
                                        <Badge
                                          variant={
                                            etapa.produzido >= lote.quantidade_total
                                              ? "default"
                                              : "secondary"
                                          }
                                        >
                                          {etapa.produzido >= lote.quantidade_total
                                            ? "Concluída"
                                            : "Em andamento"}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                    {etapa.subetapas.map((sub, subIdx) => (
                                      <TableRow key={`${idx}-${subIdx}`} className="bg-muted/50">
                                        <TableCell className="pl-8 text-sm">↳ {sub.nome}</TableCell>
                                        <TableCell className="text-right text-sm">
                                          {lote.quantidade_total}
                                        </TableCell>
                                        <TableCell className="text-right text-sm">{sub.produzido}</TableCell>
                                        <TableCell className="text-right text-sm">
                                          {lote.quantidade_total - sub.produzido}
                                        </TableCell>
                                        <TableCell className="text-right text-sm">
                                          {formatarTempoProdutivo(sub.tempo)}
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-green-600">
                                          {formatarCusto(sub.custo)}
                                        </TableCell>
                                        <TableCell />
                                      </TableRow>
                                    ))}
                                  </>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhum lote encontrado</p>
          )}
        </CardContent>
      </Card>
    </FullscreenWrapper>
  );
};

export default RelatorioLotes;
