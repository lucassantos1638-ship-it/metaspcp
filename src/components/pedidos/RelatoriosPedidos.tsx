import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, Loader2, TrendingUp, Users, CalendarDays, Filter } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const RelatoriosPedidos = () => {
  const empresaId = useEmpresaId();

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["pedidos_relatorios", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select(`
          id,
          data_criacao,
          cliente_id,
          entidade (nome),
          pedido_itens ( subtotal )
        `)
        .eq("empresa_id", empresaId);

      if (error) throw error;

      return data.map((d: any) => ({
        id: d.id,
        data_criacao: d.data_criacao,
        cliente_id: d.cliente_id,
        cliente_nome: d.entidade?.nome || "Desconhecido",
        total: d.pedido_itens?.reduce((acc: number, item: any) => acc + Number(item.subtotal), 0) || 0
      }));
    },
  });

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const pedidosFiltrados = useMemo(() => {
    if (!pedidos) return [];
    return pedidos.filter(p => {
      if (dataInicio && new Date(p.data_criacao) < new Date(dataInicio)) return false;
      
      if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        if (new Date(p.data_criacao) > fim) return false;
      }
      return true;
    });
  }, [pedidos, dataInicio, dataFim]);

  // Agregações
  const faturamentoMensal = useMemo(() => {
    if (!pedidosFiltrados) return [];
    
    const meses: Record<string, number> = {};
    
    pedidosFiltrados.forEach(p => {
      const mesAno = format(parseISO(p.data_criacao), "MM/yyyy");
      meses[mesAno] = (meses[mesAno] || 0) + p.total;
    });

    // Ordenar do mais recente pro mais antigo (baseado string MM/YYYY n é perfeito, ideal ordenar por Date, mas serve p visual)
    const sortedKeys = Object.keys(meses).sort((a, b) => {
      const [mA, yA] = a.split("/");
      const [mB, yB] = b.split("/");
      return new Date(Number(yB), Number(mB) - 1).getTime() - new Date(Number(yA), Number(mA) - 1).getTime();
    });

    return sortedKeys.map(k => ({ mes: k, total: meses[k] }));
  }, [pedidosFiltrados]);

  const clientesRanking = useMemo(() => {
    if (!pedidosFiltrados) return [];

    const clientes: Record<string, { nome: string, totalFaturado: number, qtdPedidos: number, ultimaCompra: string }> = {};

    pedidosFiltrados.forEach(p => {
      if (!clientes[p.cliente_id]) {
        clientes[p.cliente_id] = { nome: p.cliente_nome, totalFaturado: 0, qtdPedidos: 0, ultimaCompra: p.data_criacao };
      }
      
      clientes[p.cliente_id].totalFaturado += p.total;
      clientes[p.cliente_id].qtdPedidos += 1;
      
      if (new Date(p.data_criacao) > new Date(clientes[p.cliente_id].ultimaCompra)) {
        clientes[p.cliente_id].ultimaCompra = p.data_criacao;
      }
    });

    return Object.values(clientes).sort((a, b) => b.totalFaturado - a.totalFaturado);
  }, [pedidosFiltrados]);

  // Funções de exportação
  const exportarFaturamento = () => {
    try {
      const data = faturamentoMensal.map(item => ({
        "Mês/Ano": item.mes,
        "Total Faturado (R$)": item.total
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Faturamento Mensal");
      XLSX.writeFile(wb, "Relatorio_Faturamento.xlsx");
      toast.success("Excel gerado com sucesso!");
    } catch (e) {
      toast.error("Erro ao gerar Excel");
    }
  };

  const exportarClientes = () => {
    try {
      const data = clientesRanking.map(item => ({
        "Cliente": item.nome,
        "Qtd. Pedidos": item.qtdPedidos,
        "Total Faturado (R$)": item.totalFaturado,
        "Data Última Compra": format(parseISO(item.ultimaCompra), "dd/MM/yyyy HH:mm")
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ranking Clientes");
      XLSX.writeFile(wb, "Relatorio_Clientes.xlsx");
      toast.success("Excel gerado com sucesso!");
    } catch (e) {
      toast.error("Erro ao gerar Excel");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/30 border rounded-lg items-end">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-full sm:w-auto mb-2 sm:mb-0">
          <Filter className="w-4 h-4" />
          Filtro de Data:
        </div>
        <div className="flex flex-col gap-1.5 flex-1 sm:max-w-[200px]">
          <Label htmlFor="dataInicio" className="text-xs">Data Inicial</Label>
          <Input 
            id="dataInicio"
            type="date" 
            value={dataInicio} 
            onChange={e => setDataInicio(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 sm:max-w-[200px]">
          <Label htmlFor="dataFim" className="text-xs">Data Final</Label>
          <Input 
            id="dataFim"
            type="date" 
            value={dataFim} 
            onChange={e => setDataFim(e.target.value)}
            className="h-9"
          />
        </div>
        {(dataInicio || dataFim) && (
          <Button variant="ghost" size="sm" onClick={() => { setDataInicio(""); setDataFim(""); }} className="h-9 text-xs">
            Limpar Filtros
          </Button>
        )}
      </div>

      <Tabs defaultValue="faturamento" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="faturamento"><TrendingUp className="w-4 h-4 mr-2" /> Faturamento Mensal</TabsTrigger>
          <TabsTrigger value="clientes"><Users className="w-4 h-4 mr-2" /> Análise de Clientes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="faturamento" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Faturamento por Mês</CardTitle>
                <CardDescription>Resumo de todo o valor faturado agrupado mensalmente.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportarFaturamento} className="gap-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200">
                <FileSpreadsheet className="w-4 h-4" /> Exportar Planilha
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês / Ano</TableHead>
                    <TableHead className="text-right">Total Faturado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faturamentoMensal.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{f.mes}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(f.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {faturamentoMensal.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">Nenhum dado encontrado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clientes" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Ranking de Clientes & Últimas Compras</CardTitle>
                <CardDescription>Veja quem comprou mais e quando foi a última interação.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportarClientes} className="gap-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200">
                <FileSpreadsheet className="w-4 h-4" /> Exportar Planilha
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Nº Pedidos</TableHead>
                    <TableHead className="text-right">Total Faturado</TableHead>
                    <TableHead className="text-right">Última Compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesRanking.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-center">{c.qtdPedidos}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.totalFaturado)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground flex items-center justify-end gap-2">
                        <CalendarDays className="w-3 h-3" />
                        {format(parseISO(c.ultimaCompra), "dd/MM/yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {clientesRanking.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};
