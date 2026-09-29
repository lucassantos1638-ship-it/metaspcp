import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useMateriais } from "@/hooks/useMateriais";
import { 
  Plus, 
  ArrowRightLeft, 
  Download, 
  Settings, 
  List, 
  Box, 
  Factory, 
  Droplet, 
  Clock, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle2, 
  ChevronRight, 
  Building2, 
  MoreVertical,
  FileText,
  Boxes,
  ArrowRight,
  ChevronDown,
  Layers,
  BarChart2,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { DialogNovoLoteTerceirizacao } from "@/components/terceirizacao/DialogNovoLoteTerceirizacao";
import { DialogTransferenciaTerceirizacao } from "@/components/terceirizacao/DialogTransferenciaTerceirizacao";
import { DialogImportarNFe } from "@/components/terceirizacao/DialogImportarNFe";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Entidade {
  id: string;
  nome: string;
  tipo: string;
}

export default function EstoqueTercerizacao() {
  const empresaId = useEmpresaId();
  const [activeTab, setActiveTab] = useState("producao-por-lotes");
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  // Fetch entidades that are 'terceirizado'
  const { data: entidades, isLoading } = useQuery({
    queryKey: ["entidades-terceirizadas", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("entidade")
        .select("id, nome, tipo")
        .eq("empresa_id", empresaId)
        .eq("tipo", "terceirizado");

      if (error) throw error;
      return data as Entidade[];
    },
    enabled: !!empresaId,
  });

  // Set first company as active when loaded
  React.useEffect(() => {
    if (entidades && entidades.length > 0 && !activeCompanyId) {
      setActiveCompanyId(entidades[0].id);
    }
  }, [entidades, activeCompanyId]);

  // Fetch materiais for mapping names
  const { data: materiais } = useMateriais(true);

  // Fetch lotes for the active company
  const { data: lotes, isLoading: isLoadingLotes } = useQuery({
    queryKey: ["lotes-terceiros", activeCompanyId],
    queryFn: async () => {
      if (!activeCompanyId) return [];
      const { data, error } = await supabase
        .from("lotes_terceiros")
        .select("*")
        .eq("entidade_fornecedor_id", activeCompanyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!activeCompanyId,
  });

  // Fetch movimentacoes para calcular recebido e perda por lote
  const { data: lotesMovs } = useQuery({
    queryKey: ["lotes-movimentacoes-agg", activeCompanyId, lotes?.length],
    queryFn: async () => {
      if (!lotes || lotes.length === 0) return {};
      const loteIds = lotes.map(l => l.id);
      const { data, error } = await supabase
        .from("movimentacoes_terceiros")
        .select("lote_id, tipo_movimentacao, quantidade, entidade_origem_id, entidade_destino_id")
        .in("lote_id", loteIds);
        
      if (error) throw error;
      
      const agg: Record<string, { recebido: number, perda: number, saidas: number, destinosIds: Set<string | null> }> = {};
      data.forEach(m => {
        if (!m.lote_id) return;
        if (!agg[m.lote_id]) agg[m.lote_id] = { recebido: 0, perda: 0, saidas: 0, destinosIds: new Set() };
        
        if (m.tipo_movimentacao === "RETORNO") agg[m.lote_id].recebido += Number(m.quantidade);
        if (m.tipo_movimentacao === "PERDA") agg[m.lote_id].perda += Number(m.quantidade);
        
        // Se a entidade origem é a empresa ativa, o material SAIU do lote
        if (m.entidade_origem_id === activeCompanyId) {
          agg[m.lote_id].saidas += Number(m.quantidade);
          // Register the destination of this exit
          if (m.tipo_movimentacao === "TRANSFERENCIA" || m.tipo_movimentacao === "REMESSA" || m.tipo_movimentacao === "RETORNO") {
            agg[m.lote_id].destinosIds.add(m.entidade_destino_id);
          }
        }
      });
      return agg;
    },
    enabled: !!lotes && lotes.length > 0,
  });

  // Fetch historico
  const { data: historico } = useQuery({
    queryKey: ["historico-terceiros", activeCompanyId],
    queryFn: async () => {
      if (!activeCompanyId) return [];
      const { data, error } = await supabase
        .from("movimentacoes_terceiros")
        .select(`
          id,
          tipo_movimentacao,
          quantidade,
          unidade,
          data_movimentacao,
          observacao,
          usuario_id
        `)
        .or(`entidade_origem_id.eq.${activeCompanyId},entidade_destino_id.eq.${activeCompanyId}`)
        .order("data_movimentacao", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!activeCompanyId,
  });

  // Calcula o saldo global de todos os materiais em todas as empresas
  const { data: estoqueGlobal } = useQuery({
    queryKey: ["estoque-global-terceirizacao", empresaId],
    queryFn: async () => {
      if (!empresaId) return {};
      
      const { data, error } = await supabase
        .from("movimentacoes_terceiros")
        .select("entidade_origem_id, entidade_destino_id, material_origem_id, material_destino_id, quantidade, cor_origem, cor_destino")
        .eq("empresa_id", empresaId);
        
      if (error) throw error;
      
      // Data structure: saldos[materialId][cor][entidadeId] = quantidade
      const saldos: Record<string, Record<string, Record<string, number>>> = {};
      
      const safeAdd = (matId: string, cor: string, entId: string | null, qtd: number) => {
        const companyKey = entId || "MINHA_EMPRESA";
        const corKey = cor || "Única";
        if (!saldos[matId]) saldos[matId] = {};
        if (!saldos[matId][corKey]) saldos[matId][corKey] = {};
        saldos[matId][corKey][companyKey] = (saldos[matId][corKey][companyKey] || 0) + qtd;
      };

      data.forEach(m => {
        // Entradas no destino
        if (m.material_destino_id) {
          safeAdd(m.material_destino_id, m.cor_destino, m.entidade_destino_id, Number(m.quantidade || 0));
        }
        // Saídas da origem
        if (m.material_origem_id) {
          safeAdd(m.material_origem_id, m.cor_origem, m.entidade_origem_id, -Number(m.quantidade || 0));
        }
      });
      return saldos;
    },
    enabled: !!empresaId,
  });

  // Calculate REAL balance based on all movements, GROUPED BY MATERIAL
  const { data: saldosPorMaterial } = useQuery({
    queryKey: ["saldo-empresa-materiais", activeCompanyId],
    queryFn: async () => {
      if (!activeCompanyId) return {};
      
      const { data, error } = await supabase
        .from("movimentacoes_terceiros")
        .select("tipo_movimentacao, entidade_origem_id, entidade_destino_id, material_origem_id, material_destino_id, quantidade, cor_origem, cor_destino")
        .or(`entidade_origem_id.eq.${activeCompanyId},entidade_destino_id.eq.${activeCompanyId}`);
        
      if (error) throw error;
      
      // saldos[materialId][cor] = quantidade
      const saldos: Record<string, Record<string, number>> = {};
      
      data.forEach(m => {
        // ENTRADAS no parceiro: Remessas da minha empresa, transferencias de outro parceiro
        if (m.entidade_destino_id === activeCompanyId && m.material_destino_id) {
          const cor = m.cor_destino || "Única";
          if (!saldos[m.material_destino_id]) saldos[m.material_destino_id] = {};
          saldos[m.material_destino_id][cor] = (saldos[m.material_destino_id][cor] || 0) + Number(m.quantidade || 0);
        }
        // SAIDAS do parceiro: Retornos para minha empresa, perdas, transferencias para outro parceiro
        if (m.entidade_origem_id === activeCompanyId && m.material_origem_id) {
          const cor = m.cor_origem || "Única";
          if (!saldos[m.material_origem_id]) saldos[m.material_origem_id] = {};
          saldos[m.material_origem_id][cor] = (saldos[m.material_origem_id][cor] || 0) - Number(m.quantidade || 0);
        }
      });
      return saldos;
    },
    enabled: !!activeCompanyId,
  });

  // Mapa de usuários para o histórico
  const { data: usuariosMap } = useQuery({
    queryKey: ["usuarios-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("usuarios").select("id, nome_completo");
      if (error) throw error;
      const map = new Map<string, string>();
      if (data) {
        data.forEach((u: any) => map.set(u.id, u.nome_completo));
      }
      return map;
    }
  });

  const getMaterialNome = (id: string) => {
    return materiais?.find(m => m.id === id)?.nome || "Material Desconhecido";
  };

  // Calcular métricas visuais
  const lotesAtivos = lotes?.filter(l => l.status !== "CANCELADO" && l.status !== "CONCLUIDO")?.length || 0;

  const handleDeleteLote = async (loteId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este lote e todas as movimentações ligadas a ele? Esta ação não pode ser desfeita.")) {
      return;
    }
    try {
      // Exclui movimentações atreladas ao lote
      await supabase.from("movimentacoes_terceiros").delete().eq("lote_id", loteId);
      // Exclui o lote
      const { error } = await supabase.from("lotes_terceiros").delete().eq("id", loteId);
      
      if (error) throw error;
      
      toast.success("Lote excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["lotes-terceiros"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-movimentacoes-agg"] });
      queryClient.invalidateQueries({ queryKey: ["saldo-empresa-materiais"] });
      queryClient.invalidateQueries({ queryKey: ["historico-terceiros"] });
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao excluir o lote");
    }
  };
  const getEntidadeNome = (id: string | null) => {
    if (!id) return "Minha Empresa";
    const ent = entidades?.find(e => e.id === id);
    return ent ? ent.nome : "Desconhecido";
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Estoque em Terceiros
          </h2>
          <p className="text-[11px] text-slate-500 mt-1">
            Gerencie o estoque de malhas e materiais localizados em empresas parceiras/terceirizadas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DialogNovoLoteTerceirizacao entidadeFornecedorId={activeCompanyId} />
          <DialogTransferenciaTerceirizacao activeCompanyId={activeCompanyId} />
          <Button variant="outline" size="sm" className="bg-slate-50 text-[11px] h-8">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Receber Material
          </Button>
          <Button variant="outline" size="sm" className="bg-slate-50 text-[11px] h-8">
            <Settings className="w-3.5 h-3.5 mr-1.5" />
            Registrar Transformação
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent border-b border-slate-200 w-full justify-start rounded-none h-auto p-0 space-x-6">
          <TabsTrigger 
            value="visao-geral" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-2 pt-1 px-1 text-slate-500 text-[11px]"
          >
            <Box className="w-3.5 h-3.5 mr-1.5" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger 
            value="producao-por-lotes" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-2 pt-1 px-1 text-slate-500 text-[11px]"
          >
            <Boxes className="w-3.5 h-3.5 mr-1.5" />
            Produção por Lotes
          </TabsTrigger>
          <TabsTrigger 
            value="estoque-por-empresa" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-2 pt-1 px-1 text-slate-500 text-[11px]"
          >
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            Estoque por Empresa
          </TabsTrigger>
          <TabsTrigger 
            value="movimentacoes" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none pb-2 pt-1 px-1 text-slate-500 text-[11px]"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Movimentações
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "visao-geral" && (
        <Card className="border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
              <Box className="w-4 h-4 text-blue-600" />
              Visão Global de Estoque em Terceiros
            </div>
            <DialogImportarNFe />
          </div>
          <ScrollArea className="w-full">
            <Table className="text-[11px] [&_td]:p-2 [&_th]:p-2">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600 min-w-[200px]">MATERIAL</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-center whitespace-nowrap bg-blue-50/30">MINHA EMPRESA</TableHead>
                  {entidades?.map(ent => (
                    <TableHead key={ent.id} className="font-semibold text-slate-600 text-center whitespace-nowrap">{ent.nome}</TableHead>
                  ))}
                  <TableHead className="font-bold text-slate-700 text-center whitespace-nowrap bg-slate-100">TOTAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estoqueGlobal && Object.keys(estoqueGlobal).length > 0 ? (
                  Object.entries(estoqueGlobal).map(([matId, coresObj]) => {
                    const material = materiais?.find(m => m.id === matId);
                    if (!material) return null;
                    
                    let materialTotalMat = 0;
                    
                    const hasStockMat = Object.values(coresObj).some(saldos => Object.values(saldos).some(v => v > 0.001));
                    if (!hasStockMat) return null;

                    return (
                      <React.Fragment key={matId}>
                        {Object.entries(coresObj).map(([cor, saldos], idx) => {
                          const hasStockCor = Object.values(saldos).some(v => v > 0.001);
                          if (!hasStockCor) return null;

                          let totalCor = 0;
                          Object.values(saldos).forEach(v => {
                            if (v > 0.001) totalCor += v;
                          });

                          return (
                            <TableRow key={`${matId}-${cor}`} className={idx === 0 ? "bg-slate-50/50" : "hover:bg-slate-50"}>
                              <TableCell className={`text-slate-700 ${idx === 0 ? "font-bold" : "font-medium pl-6"}`}>
                                {idx === 0 && <span className="block mb-1">{material.nome}</span>}
                                <span className={`text-[10px] ${idx === 0 ? "text-slate-500 font-normal" : "text-emerald-700"}`}>{cor}</span>
                              </TableCell>
                              <TableCell className="text-center font-semibold text-slate-600 bg-blue-50/30">
                                {saldos["MINHA_EMPRESA"] > 0.001 ? `${saldos["MINHA_EMPRESA"].toFixed(2)} ${material.unidade_medida || 'KG'}` : "-"}
                              </TableCell>
                              {entidades?.map(ent => (
                                <TableCell key={ent.id} className="text-center">
                                  {saldos[ent.id] > 0.001 ? (
                                    <span className="text-emerald-700 font-bold">{saldos[ent.id].toFixed(2)} {material.unidade_medida || 'KG'}</span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </TableCell>
                              ))}
                              <TableCell className="text-center font-bold text-slate-800 bg-slate-100">
                                {totalCor > 0.001 ? `${totalCor.toFixed(2)} ${material.unidade_medida || 'KG'}` : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={entidades ? entidades.length + 3 : 4} className="h-32 text-center text-slate-500">
                      Nenhum estoque encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}

      {activeTab !== "visao-geral" && (
        <div className="flex flex-col space-y-6 mt-6">
          {/* Company Tabs */}
          <div className="w-full relative">
        <ScrollArea className="w-full whitespace-nowrap pb-4">
          <div className="flex w-max space-x-2">
            {isLoading ? (
              <span className="text-[11px] text-slate-500">Carregando parceiros...</span>
            ) : entidades && entidades.length > 0 ? (
              entidades.map((entidade) => (
                <button
                  key={entidade.id}
                  onClick={() => setActiveCompanyId(entidade.id)}
                  className={`flex items-center px-3 py-1.5 text-[11px] font-medium rounded-md border transition-colors ${
                    activeCompanyId === entidade.id 
                      ? 'bg-blue-50/50 border-blue-200 text-slate-800' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  {entidade.nome}
                </button>
              ))
            ) : (
              <span className="text-[11px] text-slate-500">Nenhuma empresa terceirizada encontrada.</span>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-md">
                <Box className="w-4 h-4" />
              </div>
              <p className="text-[11px] font-medium text-slate-600">Estoque no Parceiro</p>
            </div>
            <div className="space-y-1">
              {saldosPorMaterial && Object.keys(saldosPorMaterial).length > 0 ? (
                Object.entries(saldosPorMaterial)
                  .map(([matId, coresObj]) => {
                    const hasStockMat = Object.values(coresObj).some(qty => qty > 0.001);
                    if (!hasStockMat) return null;

                    return (
                      <div key={matId} className="border-b border-slate-100 last:border-0 pb-2 mb-2 last:mb-0">
                        <div className="font-bold text-slate-800 text-[11px] mb-1 truncate" title={getMaterialNome(matId)}>
                          {getMaterialNome(matId)}
                        </div>
                        {Object.entries(coresObj)
                          .filter(([_, qty]) => qty > 0.001)
                          .map(([cor, qty]) => (
                            <div key={`${matId}-${cor}`} className="flex justify-between items-center text-xs pl-3 py-0.5">
                              <span className="font-medium text-slate-600 truncate max-w-[180px]" title={cor}>
                                {cor}
                              </span>
                              <span className="font-bold text-emerald-700">{qty.toFixed(2)} KG</span>
                            </div>
                          ))}
                      </div>
                    );
                  })
              ) : (
                <p className="text-sm font-medium text-slate-400">Nenhum estoque no momento</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 text-blue-600 rounded-md">
                <FileText className="w-4 h-4" />
              </div>
              <p className="text-[11px] font-medium text-slate-600">Lotes em Aberto/Produção</p>
            </div>
            <p className="text-lg font-bold text-slate-900">{lotesAtivos}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Lotes ativos no momento para este parceiro</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
            <Box className="w-4 h-4 text-blue-600" />
            Produção por Lotes
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input 
                placeholder="Buscar por lote, produto ou empresa..." 
                className="pl-8 w-[250px] h-7 text-[11px]"
              />
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[11px] px-2">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              Filtros
            </Button>
          </div>
        </div>
        <div className="max-h-[280px] overflow-auto">
          <Table className="text-[11px] [&_td]:p-2 [&_th]:p-2">
            <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-semibold text-slate-500">LOTE</TableHead>
                <TableHead className="text-[10px] font-semibold text-slate-500">PRODUTO</TableHead>
                <TableHead className="text-[10px] font-semibold text-slate-500">ENVIADO PARA</TableHead>
                <TableHead className="text-[10px] font-semibold text-slate-500">SALDO ATUAL</TableHead>
                <TableHead className="text-[10px] font-semibold text-slate-500">RECEBIDO</TableHead>
                <TableHead className="text-[10px] font-semibold text-slate-500">PERDA</TableHead>
                <TableHead className="text-[10px] font-semibold text-slate-500">STATUS</TableHead>
                <TableHead className="text-[10px] font-semibold text-slate-500">INÍCIO</TableHead>
                <TableHead className="text-[10px] font-semibold text-slate-500 text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLotes ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-slate-500">
                    Carregando lotes...
                  </TableCell>
                </TableRow>
              ) : lotes && lotes.length > 0 ? (
                lotes.map((lote) => (
                  <TableRow key={lote.id}>
                    <TableCell className="font-medium">{lote.codigo_lote}</TableCell>
                    <TableCell>
                      {lote.material_original_id !== lote.produto_atual_id ? (
                        <div className="flex flex-col">
                          <span className="text-slate-400 text-[9px] line-through">{getMaterialNome(lote.material_original_id)}</span>
                          <span className="font-semibold text-blue-700">
                            {getMaterialNome(lote.produto_atual_id || lote.material_original_id)}
                            {lote.cor_atual && lote.cor_atual !== "Única" && ` - ${lote.cor_atual}`}
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium">
                          {getMaterialNome(lote.material_original_id)}
                          {lote.cor_original && lote.cor_original !== "Única" && ` - ${lote.cor_original}`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium text-[10px]">
                      {lotesMovs?.[lote.id]?.destinosIds && lotesMovs[lote.id].destinosIds.size > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {Array.from(lotesMovs[lote.id].destinosIds).map((destId, i) => (
                            <span key={i} className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded inline-block w-fit whitespace-nowrap">
                              Envio {getEntidadeNome(destId)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Nenhum envio</span>
                      )}
                    </TableCell>
                      <TableCell>
                        <span className="font-bold text-emerald-700">
                          {Math.max(0, Number(lote.quantidade_inicial) - (lotesMovs?.[lote.id]?.saidas || 0)).toFixed(2)} {lote.unidade}
                        </span>
                      </TableCell>
                      <TableCell>{lotesMovs?.[lote.id]?.recebido || 0} {lote.unidade}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{lotesMovs?.[lote.id]?.perda || 0} {lote.unidade}</span>
                          {(lotesMovs?.[lote.id]?.perda || 0) > 0 && lote.quantidade_inicial > 0 && (
                            <span className="text-[9px] text-red-500 font-medium">
                              ({((Number(lotesMovs[lote.id].perda) / Number(lote.quantidade_inicial)) * 100).toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      </TableCell>
                    <TableCell>
                      {lote.status === "ABERTO" && (
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] px-1.5 py-0 h-5">
                          Aberto
                        </Badge>
                      )}
                      {lote.status === "EM_PRODUCAO" && (
                        <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0 h-5">
                          Em produção
                        </Badge>
                      )}
                      {lote.status === "CONCLUIDO" && (
                        <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0 h-5">
                          Concluído
                        </Badge>
                      )}
                      {lote.status === "CANCELADO" && (
                        <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-5">
                          Cancelado
                        </Badge>
                      )}
                      {/* Adicionando fallback para outros status parecidos com a imagem */}
                      {!["ABERTO", "EM_PRODUCAO", "CONCLUIDO", "CANCELADO"].includes(lote.status) && (
                        <Badge className={`text-[10px] px-1.5 py-0 h-5 ${
                          lote.status.toLowerCase().includes('parcial') ? "bg-orange-100 text-orange-700 border border-orange-200" :
                          lote.status.toLowerCase().includes('aguardando') ? "bg-slate-100 text-slate-600 border border-slate-200" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {lote.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(lote.data_inicio).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 font-medium text-slate-600">
                          <Eye className="w-3 h-3 mr-1" />
                          Ver lote
                        </Button>
                        <DialogTransferenciaTerceirizacao 
                          activeCompanyId={activeCompanyId}
                          initialData={{
                            tipoMov: "TRANSFERENCIA",
                            loteOrigemId: lote.id,
                            materialId: lote.produto_atual_id || lote.material_original_id,
                          }}
                          trigger={
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 font-medium text-slate-600">
                              <ArrowRightLeft className="w-3 h-3 mr-1" />
                              Transferir
                            </Button>
                          }
                        />
                        <DialogTransferenciaTerceirizacao 
                          activeCompanyId={activeCompanyId}
                          initialData={{
                            tipoMov: "RETORNO",
                            loteOrigemId: lote.id,
                            materialId: lote.produto_atual_id || lote.material_original_id,
                            saldoDoLote: Math.max(0, Number(lote.quantidade_inicial) - (lotesMovs?.[lote.id]?.saidas || 0))
                          }}
                          trigger={
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 font-medium text-slate-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Receber
                            </Button>
                          }
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteLote(lote.id)}
                          title="Excluir Lote"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Boxes className="w-8 h-8 text-slate-300 mb-2" />
                      <p>Nenhum lote registrado para esta empresa no momento.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Histórico da Empresa */}
      <Card className="border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
            <Clock className="w-4 h-4 text-blue-600" />
            Histórico de Movimentações na Empresa
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Registro de todas as atividades, envios, recebimentos e produções relacionadas a este parceiro.
          </p>
        </div>
        <CardContent className="p-0">
          <div className="max-h-[300px] overflow-auto p-5">
            {historico && historico.length > 0 ? (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[9px] before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent pl-8">
                {historico.map((mov: any, index: number) => (
                  <div key={mov.id || index} className="relative flex items-center group is-active">
                    <div className={`flex items-center justify-center w-2.5 h-2.5 rounded-full border-2 border-white absolute left-[-26px] ${index === 0 ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                    <div className="flex flex-col bg-slate-50 border border-slate-100 rounded-md p-3 w-full relative">
                      <span className={`text-[10px] font-semibold ${index === 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                        {new Date(mov.data_movimentacao).toLocaleDateString('pt-BR')} às {new Date(mov.data_movimentacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[11px] font-medium text-slate-800 mt-0.5">
                        {mov.tipo_movimentacao} de {mov.quantidade} {mov.unidade}
                      </span>
                      {mov.observacao && (
                        <span className="text-[10px] text-slate-500 mt-1 block">{mov.observacao}</span>
                      )}
                      {mov.usuario_id && (
                         <span className="text-[9px] text-slate-400 mt-1.5 block border-t border-slate-200 pt-1">
                           Registrado por: {usuariosMap?.get(mov.usuario_id) || 'Usuário do sistema'}
                         </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Clock className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                <p className="text-[11px]">Nenhum histórico de movimentação registrado para esta empresa.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
      )}
    </div>
  );
}
