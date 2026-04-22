import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { usePrintReport } from "@/hooks/usePrintReport";
import { formatarTempoProdutivo } from "@/lib/timeUtils";
import { startOfDay, endOfDay, isWithinInterval, parseISO, format } from "date-fns";
import { Package, ChevronDown, ChevronRight, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import ProdutosFabricadosRelatorioA4 from "@/components/relatorios/ProdutosFabricadosRelatorioA4";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const RelatorioProdutosFabricados = () => {
  const empresaId = useEmpresaId();
  
  const hojeStr = new Date().toISOString().split('T')[0];
  const primeiroDiaMesStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState<string>(primeiroDiaMesStr);
  const [dataFim, setDataFim] = useState<string>(hojeStr);
  const [expandido, setExpandido] = useState<string | null>(null);
  const { isPrinting, triggerPrint } = usePrintReport();
  const [printMode, setPrintMode] = useState<"detalhado" | "resumido">("detalhado");

  const { data: empresa } = useQuery({
    queryKey: ["configuracoes-empresa-print", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("nome, cnpj").eq("id", empresaId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: dadosAgrupados, isLoading } = useQuery({
    queryKey: ["relatorio-produtos-fabricados", empresaId, dataInicio, dataFim],
    enabled: !!empresaId && !!dataInicio && !!dataFim,
    queryFn: async () => {
      // 1. Buscar produções no período para encontrar lotes ativos
      const { data: prodsRange, error: err1 } = await supabase
        .from("producoes_com_tempo")
        .select("lote_id")
        .gte("data_fim", dataInicio)
        .lte("data_fim", dataFim);

      if (err1) throw err1;
      if (!prodsRange || prodsRange.length === 0) return [];

      const activeLoteIds = [...new Set(prodsRange.map(p => p.lote_id).filter(Boolean))];

      // 2. Buscar os lotes ativos
      const { data: lotes, error: err2 } = await supabase
        .from("lotes")
        .select(`
          id, numero_lote, nome_lote, quantidade_total, produto_id,
          produto:produtos (nome, sku)
        `)
        .in("id", activeLoteIds)
        .eq("empresa_id", empresaId);

      if (err2) throw err2;
      const validLotes = lotes || [];
      const validLoteIds = validLotes.map(l => l.id);
      
      if (validLoteIds.length === 0) return [];

      // 3. Buscar TODAS as produções desses lotes (em chunks) para cálculo correto do tempo médio
      let allProds: any[] = [];
      const chunkSize = 50;
      for (let i = 0; i < validLoteIds.length; i += chunkSize) {
        const chunk = validLoteIds.slice(i, i + chunkSize);
        let hasMore = true;
        let page = 0;
        const pageSize = 1000;
        while (hasMore) {
          const { data, error } = await supabase
            .from("producoes_com_tempo")
            .select("lote_id, etapa_id, subetapa_id, quantidade_produzida, tempo_produtivo_minutos, data_fim")
            .in("lote_id", chunk)
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) throw error;
          if (data && data.length > 0) {
            allProds.push(...data);
            if (data.length < pageSize) hasMore = false;
            else page++;
          } else {
            hasMore = false;
          }
        }
      }

      // 4. Buscar todas as etapas da empresa (tabela global) para saber a ordem correta
      const { data: etapasGlobais, error: err4 } = await supabase
        .from("etapas")
        .select("id, nome, ordem")
        .eq("empresa_id", empresaId)
        .order("ordem", { ascending: false });

      if (err4) throw err4;

      // 5. Para cada lote, encontrar a última etapa (maior ordem global) que teve produção,
      //    e dentro dela, a última subetapa produzida
      const agrupamento: Record<string, any> = {};

      validLotes.forEach(lote => {
         const prodId = lote.produto_id;
         if (!prodId) return;

         const prodDoLote = allProds.filter(p => p.lote_id === lote.id);
         if (prodDoLote.length === 0) return;
         
         // Descobrir qual a última etapa global que tem produção neste lote
         let lastEtapaId: string | null = null;
         for (const etapa of (etapasGlobais || [])) {
            const temProd = prodDoLote.some(p => p.etapa_id === etapa.id);
            if (temProd) {
               lastEtapaId = etapa.id;
               break; // etapasGlobais já está ordenado DESC, então o primeiro match é a maior ordem
            }
         }
         if (!lastEtapaId) return;

         // Dentro da última etapa, encontrar a última subetapa com produção
         const prodsUltimaEtapa = prodDoLote.filter(p => p.etapa_id === lastEtapaId);
         const subetapaIds = [...new Set(prodsUltimaEtapa.map(p => p.subetapa_id).filter(Boolean))];
         
         let lastSubetapaId: string | null = null;
         if (subetapaIds.length > 1) {
            // Buscar a ordem dessas subetapas no produto_etapas para pegar a de maior ordem
            // Ou se não achar, pegar pela última produção registrada
            const prodEtapasDoLote = prodDoLote.filter(p => p.etapa_id === lastEtapaId);
            // Pegar a subetapa que aparece por último cronologicamente
            let maxDate = "";
            subetapaIds.forEach(subId => {
               const prodsSubetapa = prodEtapasDoLote.filter(p => p.subetapa_id === subId);
               const maxDataSub = prodsSubetapa.reduce((max, p) => {
                  if (!p.data_fim) return max;
                  return p.data_fim > max ? p.data_fim : max;
               }, "");
               if (maxDataSub > maxDate) {
                  maxDate = maxDataSub;
                  lastSubetapaId = subId;
               }
            });
         } else if (subetapaIds.length === 1) {
            lastSubetapaId = subetapaIds[0];
         }

         // Filtrar produções da última subetapa da última etapa
         const lastStepProds = prodsUltimaEtapa.filter(p => 
            (p.subetapa_id || null) === (lastSubetapaId || null)
         );

         const lastStepProdsInRange = lastStepProds.filter(p => {
             if (!p.data_fim) return false;
             // p.data_fim costuma vir no formato YYYY-MM-DD. 
             // Ajustar comparação caso venha com horas (YYYY-MM-DDTHH:MM:SS)
             const dataFimProd = p.data_fim.split('T')[0];
             return dataFimProd >= dataInicio && dataFimProd <= dataFim;
         });
         
         console.log(`Lote ${lote.numero_lote}:`, { lastStepProds: lastStepProds.length, inRange: lastStepProdsInRange.length });

         // Se a última etapa não foi tocada neste período, ignoramos o lote neste relatório
         if (lastStepProdsInRange.length === 0) return;

         // A quantidade fabricada é a soma do que foi produzido na última etapa/subetapa.
         // Como algumas subetapas (ex: dobrar fronha) possuem multiplicadores (2 fronhas por jogo),
         // a soma pode passar muito do total do lote (ex: 1350 fronhas num lote de 741 jogos).
         // Para evitar essa distorção no relatório, limitamos a quantidade ao total esperado do lote.
         const sumQtd = lastStepProds.reduce((s, p) => s + (p.quantidade_produzida || 0), 0);
         let qtdFabricada = sumQtd;
         const loteQtdTotal = lote.quantidade_total || 0;
         
         if (qtdFabricada > loteQtdTotal && loteQtdTotal > 0) {
            qtdFabricada = loteQtdTotal;
         }

         if (qtdFabricada === 0) return;

         // Calcular o Tempo Médio Unitário do Lote (todas as etapas)
         const mapEtapas = new Map<string, { t: number, q: number, records: any[] }>();
         prodDoLote.forEach(p => {
           const key = `${p.etapa_id}-${p.subetapa_id || 'main'}`;
           if (!mapEtapas.has(key)) mapEtapas.set(key, { t: 0, q: 0, records: [] });
           const obj = mapEtapas.get(key)!;
           obj.t += p.tempo_produtivo_minutos || 0;
           obj.q += p.quantidade_produzida || 0;
           obj.records.push(p);
         });

         const tempoMedioLote = Array.from(mapEtapas.values()).reduce((sum, obj) => {
           let qtd = obj.q;
           if (qtd > loteQtdTotal * 1.2) {
             const registrosFull = obj.records.filter(p => (Number(p.quantidade_produzida) || 0) >= loteQtdTotal * 0.9);
             if (registrosFull.length > 1) {
               qtd = Math.max(...obj.records.map(p => Number(p.quantidade_produzida) || 0));
             }
           }
           return sum + (qtd > 0 ? obj.t / qtd : 0);
         }, 0);

         const ultimaData = lastStepProdsInRange.reduce((max, p) => {
             if (!p.data_fim) return max;
             const d = p.data_fim.split('T')[0];
             return d > max ? d : max;
         }, "0000-00-00");

         // Adicionar ao agrupamento
         if (!agrupamento[prodId]) {
           agrupamento[prodId] = {
             produtoId: prodId,
             nome: lote.produto?.nome || "Produto Desconhecido",
             sku: lote.produto?.sku || "",
             quantidade: 0,
             tempoTotalMinutos: 0,
             totalLotes: 0,
             lotesRelacionados: []
           };
         }

         agrupamento[prodId].quantidade += qtdFabricada;
         agrupamento[prodId].totalLotes += 1;
         agrupamento[prodId].tempoTotalMinutos += tempoMedioLote;
         agrupamento[prodId].lotesRelacionados.push({
           ...lote,
           quantidade_total: qtdFabricada, // Mostra a qtd da última etapa em vez da expectativa do lote
           tempoMedioLote,
           ultimaData
         });
      });

      return Object.values(agrupamento).map((item: any) => {
        const tempoMedio = item.totalLotes > 0 ? item.tempoTotalMinutos / item.totalLotes : 0;
        return { ...item, tempoMedio };
      }).sort((a, b) => b.quantidade - a.quantidade);
    }
  });

  return (
    <>
      <div className="print:hidden">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos Fabricados
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 items-end">
              <div className="flex items-center gap-2">
                <Label htmlFor="data-inicio" className="whitespace-nowrap">De:</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-[140px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="data-fim" className="whitespace-nowrap">Até:</Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-[140px]"
                />
              </div>
              {dadosAgrupados && dadosAgrupados.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Printer className="h-4 w-4" />
                      Imprimir
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setPrintMode("detalhado"); setTimeout(triggerPrint, 50); }}>
                      Detalhado (com lotes)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setPrintMode("resumido"); setTimeout(triggerPrint, 50); }}>
                      Resumido (só produtos)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : dadosAgrupados && dadosAgrupados.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Lotes Concluídos</TableHead>
                    <TableHead className="text-right">Quantidade Total (Unid.)</TableHead>
                    <TableHead className="text-right">Tempo Médio Unitário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosAgrupados.map((item) => (
                    <React.Fragment key={item.produtoId}>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandido(expandido === item.produtoId ? null : item.produtoId)}
                      >
                        <TableCell>
                          {expandido === item.produtoId ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.nome}
                          {item.sku && <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{item.sku}</span>}
                        </TableCell>
                        <TableCell className="text-right">{item.totalLotes}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{item.quantidade}</TableCell>
                        <TableCell className="text-right text-muted-foreground font-medium">
                          {formatarTempoProdutivo(item.tempoMedio)}
                        </TableCell>
                      </TableRow>
                      
                      {expandido === item.produtoId && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={5} className="p-0">
                            <div className="px-10 py-4">
                              <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Lotes Fabricados:</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {item.lotesRelacionados.map(lote => (
                                  <div key={lote.id} className="bg-background border rounded p-2 text-sm flex justify-between items-center">
                                    <div className="flex flex-col">
                                      <span className="font-medium">{lote.numero_lote}</span>
                                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{lote.nome_lote}</span>
                                      {lote.ultimaData && lote.ultimaData !== "0000-00-00" && (
                                        <span className="text-[10px] text-muted-foreground mt-0.5">
                                          Fabricado em: {format(parseISO(lote.ultimaData), 'dd/MM/yyyy')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <Badge variant="outline" className="font-bold">{lote.quantidade_total} un.</Badge>
                                      <span className="text-[11px] text-blue-600/80 font-medium text-right mt-1">
                                        Médio: {formatarTempoProdutivo(lote.tempoMedioLote)}/un
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Nenhum produto fabricado no período selecionado.</p>
          )}
        </CardContent>
      </Card>
      </div>

      {isPrinting && dadosAgrupados && (
        <ProdutosFabricadosRelatorioA4
          dados={dadosAgrupados}
          empresa={empresa}
          dataInicio={dataInicio}
          dataFim={dataFim}
          modo={printMode}
        />
      )}
    </>
  );
};

export default RelatorioProdutosFabricados;
