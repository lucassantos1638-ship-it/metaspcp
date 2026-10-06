import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadCloud, Info, Package, Loader2, Download, Search, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EstoqueCor {
  produtoId: string;
  produtoNome: string;
  produtoSku: string;
  cor: string;
  quantidade: number;
}

export default function EstoqueProdutos() {
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();
  const [inventario, setInventario] = useState<EstoqueCor[]>([]);

  useEffect(() => {
    const migrateColors = async () => {
      if (!empresaId) return;
      const keys = Object.keys(localStorage).filter(k => k.startsWith('produto_cores_') && !k.includes('data'));
      for (const k of keys) {
        const prodId = k.replace('produto_cores_', '');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prodId)) continue;
        const stored = localStorage.getItem(k);
        if (stored) {
          try {
            const cores = JSON.parse(stored);
            if (Array.isArray(cores) && cores.length > 0) {
              const { data: existing } = await supabase.from('produto_cores').select('id').eq('produto_id', prodId);
              if (!existing || existing.length === 0) {
                const toInsert = cores.map((c) => ({
                  produto_id: prodId,
                  codigo: c.codigo || '',
                  descricao: c.descricao,
                  empresa_id: empresaId
                }));
                await supabase.from('produto_cores').insert(toInsert);
              }
            }
          } catch(e){}
        }
      }
    };
    migrateColors();
  }, [empresaId]);

  const [dataAtualizacao, setDataAtualizacao] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [dialogUploadOpen, setDialogUploadOpen] = useState(false);
  const [dialogManualOpen, setDialogManualOpen] = useState(false);
  const [manualProdutoId, setManualProdutoId] = useState("");
  const [manualProdutoCores, setManualProdutoCores] = useState<any[]>([]);
  const [manualCoresQtd, setManualCoresQtd] = useState<Record<string, string>>({});

  // Load from local storage on mount
  useEffect(() => {
    if (empresaId) {
      const stored = localStorage.getItem(`estoque_cores_${empresaId}`);
      const storedDate = localStorage.getItem(`estoque_cores_data_${empresaId}`);
      if (stored) setInventario(JSON.parse(stored));
      if (storedDate) setDataAtualizacao(storedDate);
    }
  }, [empresaId]);

  useEffect(() => {
      if (manualProdutoId) {
          try {
              const p = produtos?.find((prod: any) => prod.id === manualProdutoId);
              let cores = p?.produto_cores || [];
              if (!Array.isArray(cores)) cores = [];
                const coresDoInventario = inventario.filter(i => i.produtoId === manualProdutoId);
              const initial: Record<string, string> = {};

              if (cores.length === 0) {
                  const inv = coresDoInventario.find(i => i.cor === "Única" || i.cor === "Sem cor definida");
                  initial["Única"] = inv ? String(inv.quantidade) : "0";
                  setManualProdutoCores([{ descricao: "Única" }]);
              } else {
                  cores.forEach((c: any) => {
                      const inv = coresDoInventario.find(i => i.cor === c.descricao);
                      initial[c.descricao] = inv ? String(inv.quantidade) : "0";
                  });
                  setManualProdutoCores(cores);
              }
              setManualCoresQtd(initial);
          } catch(e) {}
      } else {
          setManualProdutoCores([]);
          setManualCoresQtd({});
      }
  }, [manualProdutoId, inventario]);

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["produtos-estoque", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("produtos")
          .select(`
            id, 
            nome, 
            sku, 
            estoque,
            produto_cores(codigo, descricao),
            produto_materiais(
              consumo_padrao,
              material:materiais(nome, unidade_medida, codigo)
            )
          `)
          .eq("empresa_id", empresaId)
          .eq("ativo", true)
          .order("nome")
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data) {
          allData = [...allData, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }
      return allData;
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!produtos || produtos.length === 0) {
      toast.error("Nenhum produto cadastrado no sistema para vincular.");
      return;
    }

    setIsProcessing(true);
    try {
      const dataBuf = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuf);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet);

      if (data.length === 0) {
        toast.error("Planilha vazia.");
        setIsProcessing(false);
        return;
      }

      const novosEstoquesCores: EstoqueCor[] = [];
      const mapaTotalPorProduto: Record<string, number> = {};
      
      let produtosEncontrados = 0;

      for (const row of data as any[]) {
        let sku = '';
        let nomeProduto = '';
        let corCodigo = '';
        let corNome = '';
        let quantidade = 0;

        for (const key of Object.keys(row)) {
            const normalizedKey = key.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            if (normalizedKey.includes('artigo') || normalizedKey.includes('sku') || normalizedKey.includes('codigo do produto') || normalizedKey === 'codigo') sku = String(row[key]).trim();
            if (normalizedKey.includes('desc') || normalizedKey.includes('nome do produto')) nomeProduto = String(row[key]).trim();
            if (normalizedKey === 'cor' || normalizedKey.includes('nome da cor') || normalizedKey.includes('desc cor') || normalizedKey.includes('descricao cor')) corNome = String(row[key]).trim();
            if (normalizedKey.includes('cod cor') || normalizedKey.includes('codigo cor') || normalizedKey.includes('codigo da cor')) corCodigo = String(row[key]).trim();
            if (normalizedKey.includes('quantidade') || normalizedKey.includes('qtd') || normalizedKey.includes('saldo') || normalizedKey.includes('estoque')) quantidade = Number(row[key]) || 0;
        }

        const identificador = sku || nomeProduto;
        if (!identificador) continue;

        const corFinal = corNome || "Única";

        const produtoDb = produtos.find(
          p => p.sku?.toLowerCase() === identificador.toLowerCase() || p.nome.toLowerCase() === identificador.toLowerCase()
        );

        if (produtoDb) {
          let corFinal = corNome || "Única";

          if (produtoDb.produto_cores && produtoDb.produto_cores.length > 0) {
            const coresCadastradas = produtoDb.produto_cores;
            
            let matchedCor = null;
            
            if (corCodigo) {
              matchedCor = coresCadastradas.find((c: any) => c.codigo && String(c.codigo).trim() === corCodigo);
            }
            if (!matchedCor && corNome) {
              matchedCor = coresCadastradas.find((c: any) => c.descricao && String(c.descricao).toLowerCase().trim() === corNome.toLowerCase());
            }
            if (!matchedCor && corNome) {
              matchedCor = coresCadastradas.find((c: any) => c.codigo && String(c.codigo).trim() === corNome);
            }

            if (matchedCor) {
              corFinal = matchedCor.descricao;
            }
          }

          novosEstoquesCores.push({
            produtoId: produtoDb.id,
            produtoNome: produtoDb.nome,
            produtoSku: produtoDb.sku || "",
            cor: corFinal,
            quantidade
          });
          mapaTotalPorProduto[produtoDb.id] = (mapaTotalPorProduto[produtoDb.id] || 0) + quantidade;
          produtosEncontrados++;
        }
      }

      if (produtosEncontrados === 0) {
        toast.error("Nenhum produto da planilha foi encontrado no sistema. Verifique a coluna de código/SKU.");
        setIsProcessing(false);
        return;
      }

      let totalAtualizados = 0;
      let totalZerados = 0;

      const promises = produtos.map(prod => {
        const novoEstoque = mapaTotalPorProduto[prod.id] || 0;
        if (novoEstoque > 0) totalAtualizados++;
        else totalZerados++;

        return supabase
          .from("produtos")
          .update({ estoque: novoEstoque })
          .eq("id", prod.id);
      });

      for (let i = 0; i < promises.length; i += 50) {
        await Promise.all(promises.slice(i, i + 50));
      }

      const now = new Date().toISOString();
      localStorage.setItem(`estoque_cores_${empresaId}`, JSON.stringify(novosEstoquesCores));
      localStorage.setItem(`estoque_cores_data_${empresaId}`, now);
      
      setInventario(novosEstoquesCores);
      setDataAtualizacao(now);
      queryClient.invalidateQueries({ queryKey: ["produtos"] });

      toast.success(`Estoque atualizado! ${totalAtualizados} produtos com saldo e ${totalZerados} zerados.`);
      setDialogUploadOpen(false);
    } catch (err: any) {
      toast.error("Erro ao processar planilha: " + err.message);
    } finally {
      setIsProcessing(false);
      e.target.value = ''; 
    }
  };

  const handleManualAdd = async () => {
    if (!manualProdutoId) {
        toast.error("Selecione um produto.");
        return;
    }
    
    setIsProcessing(true);
    try {
        const prod = produtos?.find((p: any) => p.id === manualProdutoId);
        if (!prod) return;
        
        let current = [...inventario];
        
        Object.entries(manualCoresQtd).forEach(([corNome, qtdStr]) => {
            const qtd = Number(qtdStr);
            const index = current.findIndex(c => c.produtoId === manualProdutoId && c.cor === corNome);
            if (index >= 0) {
                current[index].quantidade = qtd;
            } else {
                current.push({
                    produtoId: prod.id,
                    produtoNome: prod.nome,
                    produtoSku: prod.sku || "",
                    cor: corNome,
                    quantidade: qtd
                });
            }
        });

        const totalEstoque = current.filter(c => c.produtoId === prod.id).reduce((acc, c) => acc + c.quantidade, 0);

        await supabase.from("produtos").update({ estoque: totalEstoque }).eq("id", prod.id);

        localStorage.setItem(`estoque_cores_${empresaId}`, JSON.stringify(current));
        const now = new Date().toISOString();
        localStorage.setItem(`estoque_cores_data_${empresaId}`, now);
        
        setInventario(current);
        setDataAtualizacao(now);
        setDialogManualOpen(false);
        toast.success("Estoque manual adicionado com sucesso!");
        
        setManualProdutoId("");
        queryClient.invalidateQueries({ queryKey: ["produtos-estoque"] });
    } catch (e) {
        console.error(e);
        toast.error("Erro ao salvar estoque manual.");
    } finally {
        setIsProcessing(false);
    }
  };

  const allRows = useMemo(() => {
    if (!produtos) return [];
    
    return produtos.map((prod) => {
      let coresDefinidas: any[] = prod.produto_cores || [];

      const coresDoInventario = inventario.filter(i => i.produtoId === prod.id);
      
      const materiasNomes = prod.produto_materiais?.map((pm: any) => pm.material?.nome).join(' | ') || 'Sem materiais';
      const materiasQtdsExcel = prod.produto_materiais?.map((pm: any) => pm.consumo_padrao).join(' | ') || '-';

      const materiaisHtmlNomes = prod.produto_materiais && prod.produto_materiais.length > 0 ? (
        <div className="flex flex-col gap-1">
          {prod.produto_materiais.map((pm: any, idx: number) => (
            <span key={idx} className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md w-fit whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]">
              {pm.material?.nome}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic">Sem materiais</span>
      );

      const materiaisHtmlQtds = prod.produto_materiais && prod.produto_materiais.length > 0 ? (
        <div className="flex flex-col gap-1">
          {prod.produto_materiais.map((pm: any, idx: number) => (
            <span key={idx} className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
              {pm.consumo_padrao} {pm.material?.unidade_medida || 'un'}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic">-</span>
      );

      const mapCores = new Map<string, any>();

      coresDefinidas.forEach(c => {
        const nomeCor = c.descricao.toUpperCase();
        mapCores.set(nomeCor, {
          cor: c.descricao, // keep original case if preferred, or uppercase
          codigo: c.codigo || '-',
          estoque: 0
        });
      });

      coresDoInventario.forEach(item => {
        const nomeCor = item.cor.toUpperCase();
        if (mapCores.has(nomeCor)) {
            mapCores.get(nomeCor).estoque = item.quantidade;
        } else {
            mapCores.set(nomeCor, {
              cor: item.cor,
              codigo: '-',
              estoque: item.quantidade
            });
        }
      });

      const todasCores = Array.from(mapCores.values());
      const estoqueTotal = todasCores.length > 0 
        ? todasCores.reduce((acc, curr) => acc + curr.estoque, 0)
        : (prod.estoque || 0);

      return {
        id: prod.id,
        sku: prod.sku || '-',
        nome: prod.nome,
        estoqueTotal,
        materiaisHtmlNomes,
        materiaisHtmlQtds,
        materiasNomes,
        materiasQtdsExcel,
        materiaisOriginais: prod.produto_materiais || [],
        cores: todasCores.length > 0 ? todasCores : [{ cor: 'Sem cor definida', estoque: prod.estoque || 0 }]
      };
    });
  }, [produtos, inventario]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allRows.filter(row => 
      row.nome.toLowerCase().includes(term) || 
      row.sku.toLowerCase().includes(term) ||
      row.cores.some(c => c.cor.toLowerCase().includes(term))
    );
  }, [allRows, searchTerm]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDownloadExcel = () => {
    if (filteredRows.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }
    
    // Gerar a estrutura plana (linha por cor) para o Excel
    const exportData = filteredRows.flatMap(r => 
      r.cores.map(c => ({
        "SKU": r.sku,
        "Produto": r.nome,
        "Cor": c.cor,
        "Quantidade em Estoque": c.estoque
      }))
    );

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    XLSX.writeFile(wb, `Estoque_Produtos_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Estoque de Produtos</h1>
          <p className="text-muted-foreground mt-1">
            Inventário e gerenciamento do estoque detalhado por cor
          </p>
          <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm shadow-sm border ${dataAtualizacao ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            <Info className={`w-4 h-4 ${dataAtualizacao ? 'text-emerald-600' : 'text-amber-600'}`} />
            <span>
              {dataAtualizacao ? (
                <>Última atualização via planilha: <strong>{format(parseISO(dataAtualizacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></>
              ) : (
                <>Nenhuma planilha de inventário foi enviada ainda.</>
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou código..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 w-[250px]"
            />
          </div>
          
          <Button variant="outline" onClick={handleDownloadExcel} className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Baixar Excel
          </Button>

          <Dialog open={dialogManualOpen} onOpenChange={setDialogManualOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Info className="w-4 h-4 mr-2" />
                Lançamento Manual
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Lançamento Manual de Estoque</DialogTitle>
                <DialogDescription>
                  Selecione o produto, a cor e digite o estoque atual total dessa cor.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label>Produto</Label>
                      <Select value={manualProdutoId} onValueChange={setManualProdutoId}>
                          <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                              {produtos?.map((p: any) => (
                                  <SelectItem key={p.id} value={p.id}>{p.sku ? `${p.sku} - ` : ''}{p.nome}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  
                  {manualProdutoId && manualProdutoCores.length > 0 && (
                      <div className="space-y-3 mt-4 border rounded-md p-3 max-h-[300px] overflow-y-auto">
                          <Label className="text-muted-foreground text-xs uppercase font-bold">Cores Disponíveis</Label>
                          {manualProdutoCores.map((cor: any) => (
                              <div key={cor.descricao} className="flex items-center gap-3 bg-muted/30 p-2 rounded">
                                  <div className="flex-1 font-medium text-sm truncate">{cor.descricao}</div>
                                  <div className="w-24">
                                      <Input 
                                          type="number" 
                                          placeholder="0"
                                          className="h-8"
                                          value={manualCoresQtd[cor.descricao] || ""}
                                          onChange={e => setManualCoresQtd(prev => ({ ...prev, [cor.descricao]: e.target.value }))}
                                      />
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogManualOpen(false)}>Cancelar</Button>
                  <Button onClick={handleManualAdd} disabled={isProcessing}>
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Salvar Estoque
                  </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogUploadOpen} onOpenChange={setDialogUploadOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto bg-primary text-primary-foreground">
                <UploadCloud className="w-4 h-4 mr-2" />
                Subir Inventário (Excel)
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>Subir Inventário de Produtos</DialogTitle>
                <DialogDescription>
                  Sua planilha Excel deve conter as seguintes colunas (a ordem não importa) para que o sistema registre os estoques por cor:
                </DialogDescription>
              </DialogHeader>
              
              <div className="bg-muted p-4 rounded-md overflow-x-auto border border-border">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="pb-2 font-semibold">Código do Produto</th>
                      <th className="pb-2 font-semibold">Descrição</th>
                      <th className="pb-2 font-semibold">Código da Cor</th>
                      <th className="pb-2 font-semibold">Nome da Cor</th>
                      <th className="pb-2 font-semibold text-right">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 text-muted-foreground">CAM-001</td>
                      <td className="py-2 text-muted-foreground">Camiseta</td>
                      <td className="py-2 text-muted-foreground">123</td>
                      <td className="py-2 text-muted-foreground">Azul</td>
                      <td className="py-2 text-right font-mono font-medium">50</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-muted-foreground">CAM-001</td>
                      <td className="py-2 text-muted-foreground">Camiseta</td>
                      <td className="py-2 text-muted-foreground">124</td>
                      <td className="py-2 text-muted-foreground">Verde</td>
                      <td className="py-2 text-right font-mono font-medium">35</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                * Produtos que estiverem na planilha mas não no sistema serão ignorados.<br/>
                * Produtos ausentes na planilha terão o estoque total **zerado**.
              </p>

              <DialogFooter className="mt-2">
                <Label htmlFor="upload-inventario-produtos" className="cursor-pointer w-full">
                  <div className={`flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium text-sm transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    {isProcessing ? 'Processando...' : 'Selecionar e Enviar Planilha'}
                  </div>
                  <Input 
                    id="upload-inventario-produtos" 
                    type="file" 
                    accept=".xlsx,.xls,.csv" 
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                  />
                </Label>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10 px-2"></TableHead>
                <TableHead className="w-[120px]">SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right w-[150px]">Estoque Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleRow(row.id)}>
                      <TableCell className="px-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full p-0">
                          {expandedRows[row.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.sku}</TableCell>
                      <TableCell className="text-xs font-medium">{row.nome}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.estoqueTotal}
                      </TableCell>
                    </TableRow>
                    
                    {expandedRows[row.id] && (
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={4} className="p-0 border-b">
                          <div className="p-4 pl-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            <div>
                              <h4 className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase">Cores em Estoque</h4>
                              <div className="rounded-md border text-[11px] overflow-hidden">
                                <Table>
                                  <TableHeader className="bg-muted/30">
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="py-1 h-auto px-3">Código</TableHead>
                                      <TableHead className="py-1 h-auto px-3">Cor</TableHead>
                                      <TableHead className="py-1 h-auto px-3 text-right">Estoque</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {row.cores.map((c: any, i: number) => (
                                      <TableRow key={i} className="hover:bg-muted/30">
                                        <TableCell className="py-1.5 px-3 font-mono text-muted-foreground">
                                          {c.codigo || '-'}
                                        </TableCell>
                                        <TableCell className="py-1.5 px-3 font-medium">
                                          {c.cor === 'Sem cor definida' ? <span className="italic text-muted-foreground">Sem cor definida</span> : c.cor}
                                        </TableCell>
                                        <TableCell className="py-1.5 px-3 text-right font-bold">
                                          {c.estoque}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>

                            <div>
                              <h4 className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase">Matérias-Primas Utilizadas</h4>
                              {row.materiaisOriginais && row.materiaisOriginais.length > 0 ? (
                                <div className="flex flex-col gap-2 max-w-md">
                                  {row.materiaisOriginais.map((pm: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-1.5 px-3 rounded-md border bg-card shadow-sm">
                                      <span className="text-[10px] font-medium text-muted-foreground">
                                        {pm.material?.codigo ? <span className="font-mono text-[11px] font-bold text-slate-500 mr-2">{pm.material.codigo} -</span> : null}
                                        {pm.material?.nome}
                                      </span>
                                      <span className="text-xs font-bold ml-3">
                                        {pm.consumo_padrao} {pm.material?.unidade_medida || 'un'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Sem materiais vinculados</span>
                              )}
                            </div>

                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
