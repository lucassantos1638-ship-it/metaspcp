import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadCloud, Info, Loader2, Download, Search, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MediaCor {
  produtoId: string;
  produtoNome: string;
  produtoSku: string;
  cor: string;
  codigoCor?: string;
  quantidade: number;
}

export default function Media3Meses() {
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();
  const [inventario, setInventario] = useState<MediaCor[]>([]);

  const [dataAtualizacao, setDataAtualizacao] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [dialogUploadOpen, setDialogUploadOpen] = useState(false);
  const [dialogManualOpen, setDialogManualOpen] = useState(false);
  const [manualProdutoId, setManualProdutoId] = useState("");
  const [manualProdutoCores, setManualProdutoCores] = useState<any[]>([]);
  const [manualCoresQtd, setManualCoresQtd] = useState<Record<string, string>>({});

  // Load from local storage on mount and sync on storage/focus
  useEffect(() => {
    const carregar = () => {
      if (empresaId) {
        const stored = localStorage.getItem(`media_vendas_3m_${empresaId}`);
        const storedDate = localStorage.getItem(`media_vendas_3m_data_${empresaId}`);
        if (stored) {
          try {
            setInventario(JSON.parse(stored));
          } catch(e) {}
        }
        if (storedDate) setDataAtualizacao(storedDate);
      }
    };

    carregar();
    window.addEventListener("storage", carregar);
    window.addEventListener("focus", carregar);
    window.addEventListener("media_vendas_3m_updated", carregar);
    return () => {
      window.removeEventListener("storage", carregar);
      window.removeEventListener("focus", carregar);
      window.removeEventListener("media_vendas_3m_updated", carregar);
    };
  }, [empresaId]);

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
            const inv = coresDoInventario.find(i => 
              (c.codigo && (i.codigoCor === c.codigo || i.cor === c.codigo)) ||
              i.cor === c.descricao
            );
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
  }, [manualProdutoId, inventario, produtos]);

  // Sanitiza dados caso haja itens com cor gravada como código numérico ou duplicados
  useEffect(() => {
    if (!produtos || produtos.length === 0 || !empresaId) return;
    const stored = localStorage.getItem(`media_vendas_3m_${empresaId}`);
    if (!stored) return;

    try {
      const items: MediaCor[] = JSON.parse(stored);
      if (!Array.isArray(items) || items.length === 0) return;

      let changed = false;
      const mapaUnico = new Map<string, MediaCor>();

      items.forEach((item) => {
        const prod = produtos.find((p: any) => p.id === item.produtoId || (item.produtoSku && p.sku === item.produtoSku));
        let corFinal = item.cor ? String(item.cor).trim() : "Única";
        let codCorFinal = item.codigoCor ? String(item.codigoCor).trim() : "-";

        if (prod && Array.isArray(prod.produto_cores) && prod.produto_cores.length > 0) {
          const matchCod = prod.produto_cores.find((c: any) =>
            c.codigo && (c.codigo === codCorFinal || c.codigo === corFinal)
          );
          if (matchCod) {
            if (corFinal !== matchCod.descricao || codCorFinal !== matchCod.codigo) {
              corFinal = matchCod.descricao;
              codCorFinal = matchCod.codigo || "-";
              changed = true;
            }
          } else {
            const matchDesc = prod.produto_cores.find((c: any) =>
              c.descricao && c.descricao.trim().toLowerCase() === corFinal.toLowerCase()
            );
            if (matchDesc && matchDesc.codigo && codCorFinal !== matchDesc.codigo) {
              codCorFinal = matchDesc.codigo;
              changed = true;
            }
          }
        }

        const key = `${item.produtoId}__${codCorFinal}__${corFinal.toUpperCase()}`;
        if (mapaUnico.has(key)) {
          const existing = mapaUnico.get(key)!;
          if (Number(item.quantidade) > Number(existing.quantidade)) {
            existing.quantidade = item.quantidade;
          }
          changed = true;
        } else {
          mapaUnico.set(key, {
            ...item,
            cor: corFinal,
            codigoCor: codCorFinal,
            quantidade: Number(item.quantidade) || 0
          });
        }
      });

      if (changed) {
        const sanitizado = Array.from(mapaUnico.values());
        setInventario(sanitizado);
        localStorage.setItem(`media_vendas_3m_${empresaId}`, JSON.stringify(sanitizado));
        window.dispatchEvent(new Event("media_vendas_3m_updated"));
      }
    } catch (e) {
      console.error("Erro na sanitização de média 3 meses:", e);
    }
  }, [produtos, empresaId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!produtos || produtos.length === 0) {
      toast.error("Nenhum produto cadastrado no sistema para vincular.");
      return;
    }

    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      if (rows.length < 2) {
        toast.error("Planilha vazia ou sem cabeçalhos.");
        setIsProcessing(false);
        return;
      }

      const headers = rows[0].map(h => String(h || "").toLowerCase());
      
      let idxProduto = -1;
      let idxCodCor = -1;
      let idxNomeCor = -1;
      let idxQtd = -1;

      headers.forEach((h, idx) => {
        const norm = h.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (norm === "descor" || norm.includes("desc cor") || norm.includes("descricao cor") || norm.includes("nome da cor") || norm.includes("nome cor")) {
          idxNomeCor = idx;
        } else if (norm === "cor" || norm.includes("cod cor") || norm.includes("codigo cor") || norm.includes("codigo da cor") || norm.includes("codcor")) {
          idxCodCor = idx;
        } else if (norm === "codigo" || norm.includes("sku") || norm.includes("codigo do produto") || norm.includes("referencia") || norm.includes("artigo")) {
          idxProduto = idx;
        } else if (idxProduto === -1 && (norm.includes("descricao") || norm.includes("produto") || norm.includes("nome"))) {
          idxProduto = idx;
        } else if (norm.includes("media") || norm.includes("quantidade") || norm.includes("qtd") || norm.includes("qtde") || norm.includes("saldo") || norm.includes("estoque")) {
          idxQtd = idx;
        }
      });

      if (idxProduto === -1 || idxQtd === -1) {
        toast.error("A planilha deve conter pelo menos as colunas: Código do Produto e Média/Quantidade.");
        setIsProcessing(false);
        return;
      }

      if (idxCodCor === -1 && idxNomeCor !== -1) {
        idxCodCor = idxNomeCor;
      }

      const novosEstoquesCores: MediaCor[] = [];
      const mapaTotalPorProduto: Record<string, number> = {};
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[idxProduto]) continue;

        const identificador = String(row[idxProduto]).trim();
        const codCorPlanilha = idxCodCor !== -1 && row[idxCodCor] !== undefined && row[idxCodCor] !== null ? String(row[idxCodCor]).trim() : "";
        const nomeCorPlanilha = idxNomeCor !== -1 && row[idxNomeCor] !== undefined && row[idxNomeCor] !== null ? String(row[idxNomeCor]).trim() : "";
        const quantidade = Number(row[idxQtd]) || 0;

        const produtoDb = produtos.find(
          p => p.sku?.toLowerCase().trim() === identificador.toLowerCase() || p.nome.toLowerCase().trim() === identificador.toLowerCase()
        );

        if (produtoDb) {
          const coresCadastradas = produtoDb.produto_cores || [];
          let matchedCor: any = null;

          if (codCorPlanilha) {
            matchedCor = coresCadastradas.find((c: any) => 
              c.codigo && String(c.codigo).trim().toLowerCase() === codCorPlanilha.toLowerCase()
            );
          }

          if (!matchedCor && nomeCorPlanilha) {
            matchedCor = coresCadastradas.find((c: any) => 
              c.codigo && String(c.codigo).trim().toLowerCase() === nomeCorPlanilha.toLowerCase()
            );
          }

          if (!matchedCor && nomeCorPlanilha) {
            matchedCor = coresCadastradas.find((c: any) => 
              c.descricao && String(c.descricao).trim().toLowerCase() === nomeCorPlanilha.toLowerCase()
            );
          }

          if (!matchedCor && codCorPlanilha) {
            matchedCor = coresCadastradas.find((c: any) => 
              c.descricao && String(c.descricao).trim().toLowerCase() === codCorPlanilha.toLowerCase()
            );
          }

          let corFinal = "Única";
          let codCorFinal = "-";

          if (matchedCor) {
            corFinal = matchedCor.descricao;
            codCorFinal = matchedCor.codigo || "-";
          } else if (nomeCorPlanilha) {
            corFinal = nomeCorPlanilha;
            codCorFinal = codCorPlanilha || "-";
          } else if (codCorPlanilha) {
            corFinal = codCorPlanilha;
            codCorFinal = codCorPlanilha;
          }

          novosEstoquesCores.push({
            produtoId: produtoDb.id,
            produtoNome: produtoDb.nome,
            produtoSku: produtoDb.sku || "",
            cor: corFinal,
            codigoCor: codCorFinal,
            quantidade
          });
          mapaTotalPorProduto[produtoDb.id] = (mapaTotalPorProduto[produtoDb.id] || 0) + quantidade;
        }
      }

      let totalAtualizados = 0;
      let totalZerados = 0;

      produtos.forEach(prod => {
        const novoEstoque = mapaTotalPorProduto[prod.id] || 0;
        if (novoEstoque > 0) totalAtualizados++;
        else totalZerados++;
      });

      const now = new Date().toISOString();
      localStorage.setItem(`media_vendas_3m_${empresaId}`, JSON.stringify(novosEstoquesCores));
      localStorage.setItem(`media_vendas_3m_data_${empresaId}`, now);
      window.dispatchEvent(new Event("media_vendas_3m_updated"));
      
      setInventario(novosEstoquesCores);
      setDataAtualizacao(now);

      toast.success(`Média atualizada! ${totalAtualizados} produtos com média e ${totalZerados} zerados.`);
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
        const corObj = manualProdutoCores.find(c => c.descricao === corNome);
        const codCor = corObj?.codigo || "";
        const index = current.findIndex(c => c.produtoId === manualProdutoId && (c.cor === corNome || (codCor && (c.codigoCor === codCor || c.cor === codCor))));
        if (index >= 0) {
          current[index].quantidade = qtd;
          current[index].cor = corNome;
          if (codCor) current[index].codigoCor = codCor;
        } else {
          current.push({
            produtoId: prod.id,
            produtoNome: prod.nome,
            produtoSku: prod.sku || "",
            cor: corNome,
            codigoCor: codCor,
            quantidade: qtd
          });
        }
      });

      localStorage.setItem(`media_vendas_3m_${empresaId}`, JSON.stringify(current));
      const now = new Date().toISOString();
      localStorage.setItem(`media_vendas_3m_data_${empresaId}`, now);
      window.dispatchEvent(new Event("media_vendas_3m_updated"));
      
      setInventario(current);
      setDataAtualizacao(now);
      setDialogManualOpen(false);
      toast.success("Média manual salva com sucesso!");
      
      setManualProdutoId("");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar média manual.");
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

      const mapCores = new Map<string, any>();

      coresDefinidas.forEach(c => {
        const cod = c.codigo ? String(c.codigo).trim() : '-';
        const desc = c.descricao ? String(c.descricao).trim() : 'Sem cor definida';
        const key = `${cod}__${desc.toUpperCase()}`;
        mapCores.set(key, {
          cor: desc,
          codigo: cod,
          estoque: 0
        });
      });

      coresDoInventario.forEach(item => {
        const itemCod = item.codigoCor ? String(item.codigoCor).trim() : '';
        const itemCor = item.cor ? String(item.cor).trim() : '';

        let target: any = null;
        if (itemCod && itemCod !== '-') {
          target = Array.from(mapCores.values()).find(c => c.codigo && c.codigo.toLowerCase() === itemCod.toLowerCase());
        }
        if (!target && itemCor) {
          target = Array.from(mapCores.values()).find(c => c.codigo && c.codigo.toLowerCase() === itemCor.toLowerCase());
        }
        if (!target && itemCor) {
          target = Array.from(mapCores.values()).find(c => c.cor && c.cor.toLowerCase() === itemCor.toLowerCase());
        }

        if (target) {
          target.estoque = item.quantidade;
        } else {
          const key = `${itemCod || '-'}__${itemCor.toUpperCase()}`;
          mapCores.set(key, {
            cor: itemCor || 'Sem cor definida',
            codigo: itemCod || '-',
            estoque: item.quantidade
          });
        }
      });

      const todasCores = Array.from(mapCores.values());
      const estoqueTotal = todasCores.length > 0 
        ? todasCores.reduce((acc, curr) => acc + curr.estoque, 0)
        : 0;

      return {
        id: prod.id,
        sku: prod.sku || '-',
        nome: prod.nome,
        estoqueTotal,
        materiasNomes,
        materiasQtdsExcel,
        materiaisOriginais: prod.produto_materiais || [],
        cores: todasCores.length > 0 ? todasCores : [{ cor: 'Sem cor definida', estoque: 0 }]
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
    
    const exportData = filteredRows.flatMap(r => 
      r.cores.map(c => ({
        "SKU": r.sku,
        "Produto": r.nome,
        "Código da Cor": c.codigo || "-",
        "Cor": c.cor,
        "Média (3 meses)": c.estoque
      }))
    );

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Media 3 Meses");
    XLSX.writeFile(wb, `Media_3_Meses_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Média (3 meses)</h1>
          <p className="text-muted-foreground mt-1">
            Gerenciamento e controle da média de vendas detalhada por cor
          </p>
          <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm shadow-sm border ${dataAtualizacao ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            <Info className={`w-4 h-4 ${dataAtualizacao ? 'text-indigo-600' : 'text-amber-600'}`} />
            <span>
              {dataAtualizacao ? (
                <>Última atualização via planilha: <strong>{format(parseISO(dataAtualizacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></>
              ) : (
                <>Nenhuma planilha de média enviada ainda.</>
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
                <DialogTitle>Lançamento Manual de Média</DialogTitle>
                <DialogDescription>
                  Selecione o produto, a cor e digite a média de vendas dessa cor.
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
                              {produtos?.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                      {p.sku ? `[${p.sku}] ` : ''}{p.nome}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>

                  {manualProdutoId && (
                      <div className="space-y-3 pt-2 border-t">
                          <Label className="text-xs text-muted-foreground">Média das Cores</Label>
                          {manualProdutoCores.map((c, i) => (
                              <div key={i} className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium">{c.descricao}</span>
                                  <Input 
                                      type="number" 
                                      className="w-24 text-right" 
                                      value={manualCoresQtd[c.descricao] || ""} 
                                      onChange={e => setManualCoresQtd(prev => ({
                                          ...prev,
                                          [c.descricao]: e.target.value
                                      }))}
                                      placeholder="0"
                                  />
                              </div>
                          ))}
                      </div>
                  )}
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogManualOpen(false)}>Cancelar</Button>
                  <Button onClick={handleManualAdd} disabled={isProcessing || !manualProdutoId}>
                      Salvar Média
                  </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogUploadOpen} onOpenChange={setDialogUploadOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto bg-primary text-primary-foreground">
                <UploadCloud className="w-4 h-4 mr-2" />
                Subir Média (Excel)
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Subir Média de Vendas (3 meses)</DialogTitle>
                <DialogDescription>
                  Sua planilha Excel deve conter as seguintes colunas (a ordem não importa) para registrar a média por cor:
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
                      <th className="pb-2 font-semibold text-right">Média / Quantidade</th>
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
                * Produtos ausentes na planilha terão a média total zerada.
              </p>

              <DialogFooter className="mt-2">
                <Label htmlFor="upload-media-produtos" className="cursor-pointer w-full">
                  <div className={`flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium text-sm transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    {isProcessing ? 'Processando...' : 'Selecionar e Enviar Planilha'}
                  </div>
                  <Input 
                    id="upload-media-produtos" 
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
                <TableHead className="text-right w-[150px]">Média Total</TableHead>
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
                      <TableCell className="text-right font-semibold text-indigo-700">
                        {row.estoqueTotal}
                      </TableCell>
                    </TableRow>
                    
                    {expandedRows[row.id] && (
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={4} className="p-0 border-b">
                          <div className="p-4 pl-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            <div>
                              <h4 className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase">Cores e Médias</h4>
                              <div className="rounded-md border text-[11px] overflow-hidden">
                                <Table>
                                  <TableHeader className="bg-muted/30">
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="py-1 h-auto px-3">Código</TableHead>
                                      <TableHead className="py-1 h-auto px-3">Cor</TableHead>
                                      <TableHead className="py-1 h-auto px-3 text-right">Média (3 meses)</TableHead>
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
                                        <TableCell className="py-1.5 px-3 text-right font-bold text-indigo-700">
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
