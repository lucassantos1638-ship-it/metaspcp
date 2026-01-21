import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatarTempoProdutivo, formatarData, formatarHora } from "@/lib/timeUtils";
import { FullscreenWrapper } from "@/components/ui/fullscreen-wrapper";
import { useEmpresaId } from "@/hooks/useEmpresaId";

const RelatorioCorte = () => {
  const empresaId = useEmpresaId();
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [mesAno, setMesAno] = useState<string>("");

  const { data: relatorioCorte, isLoading } = useQuery({
    queryKey: ["relatorio-corte", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data: etapaCorte } = await supabase
        .from("etapas")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("nome", "Corte")
        .single();

      if (!etapaCorte) return [];

      const { data: lotes } = await supabase
        .from("lotes")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

      if (!lotes) return [];

      const relatorio = await Promise.all(
        lotes.map(async (lote) => {
          const { data: producoes } = await supabase
            .from("producoes_com_tempo")
            .select("*")
            .eq("lote_id", lote.id)
            .eq("etapa_id", etapaCorte.id)
            .order("data_inicio", { ascending: true });

          if (!producoes || producoes.length === 0) {
            return {
              lote,
              produzido: 0,
              concluido: false,
              dataInicio: null as any,
              horaInicio: null as any,
              dataFim: null as any,
              horaFim: null as any,
              tempoTotal: 0,
            };
          }

          const produzido = producoes.reduce((sum, p) => sum + p.quantidade_produzida, 0);
          const concluido = produzido >= lote.quantidade_total;
          const primeira = producoes[0];
          const ultima = producoes[producoes.length - 1];
          const tempoTotal = producoes.reduce((sum, p) => sum + (p.tempo_produtivo_minutos || 0), 0);

          return {
            lote,
            produzido,
            concluido,
            dataInicio: primeira.data_inicio,
            horaInicio: primeira.hora_inicio,
            dataFim: ultima.data_fim,
            horaFim: ultima.hora_fim,
            tempoTotal,
          };
        })
      );

      return relatorio;
    },
  });

  const relatorioFiltrado = relatorioCorte?.filter((item) => {
    if (statusFiltro === "finalizados" && !item.concluido) return false;
    if (statusFiltro === "pendentes" && item.concluido) return false;
    if (mesAno && item.dataInicio) {
      const [ano, mes] = mesAno.split("-");
      const dataInicio = new Date(item.dataInicio);
      if (dataInicio.getFullYear() !== parseInt(ano) || dataInicio.getMonth() + 1 !== parseInt(mes)) {
        return false;
      }
    }
    return true;
  });

  return (
    <FullscreenWrapper title="Relatório de Finalização de Corte">
      <Card>
        <CardHeader>
          <CardTitle>Relatório de Finalização de Corte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : relatorioFiltrado && relatorioFiltrado.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-right">Tempo Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorioFiltrado.map((item) => (
                  <TableRow key={item.lote.id}>
                    <TableCell className="font-medium">{item.lote.numero_lote}</TableCell>
                    <TableCell>{item.lote.nome_lote}</TableCell>
                    <TableCell>
                      {item.dataInicio ? (
                        <div className="text-sm">
                          <div>{formatarData(item.dataInicio)}</div>
                          <div className="text-muted-foreground">{formatarHora(item.horaInicio!)}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.dataFim ? (
                        <div className="text-sm">
                          <div>{formatarData(item.dataFim)}</div>
                          <div className="text-muted-foreground">{formatarHora(item.horaFim!)}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.tempoTotal > 0 ? formatarTempoProdutivo(item.tempoTotal) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.concluido ? "default" : "secondary"}>
                        {item.concluido ? "Concluído" : "Em andamento"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado</p>
          )}
        </CardContent>
      </Card>
    </FullscreenWrapper>
  );
};

export default RelatorioCorte;
