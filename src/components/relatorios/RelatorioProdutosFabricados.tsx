import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { usePrintReport } from "@/hooks/usePrintReport";
import { formatarTempoProdutivo } from "@/lib/timeUtils";
import { agruparPorEtapa } from "@/lib/loteUtils";
import { startOfDay, endOfDay, isWithinInterval, parseISO, format } from "date-fns";
import { Package, ChevronDown, ChevronRight, Printer, Search } from "lucide-react";
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
  const [filtroProduto, setFiltroProduto] = useState("");

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
      // 1. Buscar a subetapa "EMBALAGEM" da empresa
      const { data: subEmbalagem, error: errSub } = await supabase
        .from("subetapas")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("nome", "embalagem")
        .maybeSingle();

      if (errSub) throw errSub;
      if (!subEmbalagem) return []; // Se não existe subetapa EMBALAGEM, não há dados

      const embalagemId = subEmbalagem.id;

      // 2. Buscar produções da subetapa EMBALAGEM no período
      const { data: prodsEmbalagem, error: err1 } = await supabase
        .from("producoes_com_tempo")
        .select("lote_id, quantidade_produzida, tempo_produtivo_minutos, data_fim")
        .eq("subetapa_id", embalagemId)
        .gte("data_fim", dataInicio)
        .lte("data_fim", dataFim);

      if (err1) throw err1;
      if (!prodsEmbalagem || prodsEmbalagem.length === 0) return [];

      // 3. Buscar os lotes dessas produções
      const loteIds = [...new Set(prodsEmbalagem.map(p => p.lote_id).filter(Boolean))];

      const { data: lotes, error: err2 } = await supabase
        .from("lotes")
        .select(`
          id, numero_lote, nome_lote, quantidade_total, produto_id,
          produto:produtos (nome, sku)
        `)
        .in("id", loteIds)
        .eq("empresa_id", empresaId);

      if (err2) throw err2;
      const validLotes = lotes || [];

      // 4. Buscar etapas da empresa (uma vez — mesmo que o DetalhesLote faz)
      const { data: todasEtapas } = await supabase
        .from("etapas")
        .select(`id, nome, ordem, subetapas(id, nome)`)
        .eq("empresa_id", empresaId)
        .order("ordem");

      // 5. Buscar produto_etapas para todos os produtos envolvidos
      const produtoIds = [...new Set(validLotes.map(l => l.produto_id).filter(Boolean))];
      let allProdutoEtapas: any[] = [];
      if (produtoIds.length > 0) {
        const { data: pe } = await supabase
          .from("produto_etapas")
          .select("produto_id, etapa_id, subetapa_id")
          .in("produto_id", produtoIds);
        allProdutoEtapas = pe || [];
      }

      // 6. Buscar TODAS as produções dos lotes com joins completos (igual useDetalhesLote)
      let allProds: any[] = [];
      const chunkSize = 50;
      for (let i = 0; i < loteIds.length; i += chunkSize) {
        const chunk = loteIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("producoes_com_tempo")
          .select(`
            *,
            etapa:etapas(nome, ordem),
            subetapa:subetapas(nome),
            entidade:entidade(nome),
            servico:entidade_servicos(nome, valor)
          `)
          .in("lote_id", chunk);

        if (error) throw error;
        if (data) allProds.push(...data);
      }

      // 7. Agrupar por produto
      const agrupamento: Record<string, any> = {};

      validLotes.forEach(lote => {
         const prodId = lote.produto_id;
         if (!prodId) return;

         // Produções de EMBALAGEM deste lote no período
         const prodsDoLote = prodsEmbalagem.filter(p => p.lote_id === lote.id);
         if (prodsDoLote.length === 0) return;

         // Quantidade fabricada = soma do que foi lançado na embalagem
         const qtdFabricada = prodsDoLote.reduce((s, p) => s + (p.quantidade_produzida || 0), 0);
         if (qtdFabricada === 0) return;

         // === TEMPO UNITÁRIO: EXATAMENTE IGUAL AO DETALHES DO LOTE ===
         // Filtrar etapas pelo roteiro do produto (mesma lógica useDetalhesLote linhas 47-68)
         const produtoEtapas = allProdutoEtapas.filter(pe => pe.produto_id === prodId);
         let etapasFiltradas = [...(todasEtapas || [])];
         
         if (produtoEtapas.length > 0) {
           etapasFiltradas = etapasFiltradas.filter(etapa =>
             produtoEtapas.some(pe => pe.etapa_id === etapa.id)
           );
           etapasFiltradas = etapasFiltradas.map(etapa => {
             const configsDaEtapa = produtoEtapas.filter(pe => pe.etapa_id === etapa.id);
             const temRestricaoSubetapa = configsDaEtapa.some(pe => pe.subetapa_id !== null);
             if (temRestricaoSubetapa) {
               return {
                 ...etapa,
                 subetapas: etapa.subetapas.filter(sub =>
                   configsDaEtapa.some(pe => pe.subetapa_id === sub.id)
                 )
               };
             }
             return etapa;
           });
         }

         // Usar agruparPorEtapa (mesma função do DetalhesLote)
         const producoesDoLote = allProds.filter(p => p.lote_id === lote.id);
         const progressoPorEtapa = agruparPorEtapa(
           producoesDoLote as any[],
           lote.quantidade_total,
           etapasFiltradas
         );

         // tempoUnitarioGeral = Σ (etapa.tempo_total / etapa.quantidade_produzida) — DetalhesLote linha 161-164
         const tempoMedioLote = progressoPorEtapa.reduce((acc, curr) => {
           const unitarioEtapa = curr.quantidade_produzida > 0 ? curr.tempo_total / curr.quantidade_produzida : 0;
           return acc + unitarioEtapa;
         }, 0);

         // Última data de produção (embalagem)
         const ultimaData = prodsDoLote.reduce((max, p) => {
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
           quantidade_total: qtdFabricada,
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

  const dadosFiltrados = useMemo(() => {
    if (!dadosAgrupados) return [];
    if (!filtroProduto.trim()) return dadosAgrupados;
    const termo = filtroProduto.toLowerCase();
    return dadosAgrupados.filter(item =>
      item.nome?.toLowerCase().includes(termo) ||
      item.sku?.toLowerCase().includes(termo)
    );
  }, [dadosAgrupados, filtroProduto]);

  const totalUnidades = useMemo(() => {
    return (dadosFiltrados || []).reduce((sum, item) => sum + (item.quantidade || 0), 0);
  }, [dadosFiltrados]);

  const totalLotesGeral = useMemo(() => {
    return (dadosFiltrados || []).reduce((sum, item) => sum + (item.totalLotes || 0), 0);
  }, [dadosFiltrados]);

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
          {/* Filtro e Totais */}
          {dadosAgrupados && dadosAgrupados.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div className="relative w-full sm:w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por produto ou SKU..."
                  value={filtroProduto}
                  onChange={(e) => setFiltroProduto(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Produtos:</span>
                  <span className="font-bold">{dadosFiltrados.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Lotes:</span>
                  <span className="font-bold">{totalLotesGeral}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Total Fabricado:</span>
                  <span className="font-bold text-primary text-base">{totalUnidades.toLocaleString('pt-BR')} un.</span>
                </div>
              </div>
            </div>
          )}
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : dadosFiltrados && dadosFiltrados.length > 0 ? (
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
                  {dadosFiltrados.map((item) => (
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
