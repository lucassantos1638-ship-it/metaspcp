import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadCloud, Info, Package, Loader2, Download, Search, ChevronDown, ChevronUp, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
interface EstoqueCorMaterial {
  materialId: string;
  materialNome: string;
  materialCodigo: string;
  cor: string;
  quantidade: number;
}

export default function EstoqueMateriais() {
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();
  const [inventario, setInventario] = useState<EstoqueCorMaterial[]>([]);
  const [dataAtualizacao, setDataAtualizacao] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [dialogUploadOpen, setDialogUploadOpen] = useState(false);
  const [dialogManualOpen, setDialogManualOpen] = useState(false);
  const [manualMaterialId, setManualMaterialId] = useState("");
  const [manualCor, setManualCor] = useState("");
  const [manualQuantidade, setManualQuantidade] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);

  useEffect(() => {
    if (empresaId) {
      const stored = localStorage.getItem(`estoque_materiais_cores_${empresaId}`);
      const storedDate = localStorage.getItem(`estoque_materiais_cores_data_${empresaId}`);
      if (stored) setInventario(JSON.parse(stored));
      if (storedDate) setDataAtualizacao(storedDate);
    }
  }, [empresaId]);

  const { data: materiais, isLoading } = useQuery({
    queryKey: ["materiais-estoque", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select(`
          id, 
          nome, 
          codigo, 
          estoque_fabrica,
          unidade_medida,
          produto_materiais(
            consumo_padrao,
            produto:produtos(nome, sku)
          ),
          materiais_cores(
            nome,
            codigo
          )
        `)
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as any[];
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!materiais || materiais.length === 0) {
      toast.error("Nenhum material cadastrado no sistema para vincular.");
      return;
    }

    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet) as any[];

      if (rows.length === 0) {
        toast.error("Planilha vazia.");
        setIsProcessing(false);
        return;
      }

      const novosEstoquesCores: EstoqueCorMaterial[] = [];
      const mapaTotalPorMaterial: Record<string, number> = {};
      
      for (const row of rows) {
          let nomeMaterial = null;
          let codigoMaterial = null;
          let cor = "Única";
          let quantidade = 0;

          for (const key of Object.keys(row)) {
              const val = row[key];
              const normalizedKey = key.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              
              if (normalizedKey.includes('material') || normalizedKey.includes('nome')) {
                  nomeMaterial = val;
              }
              if (normalizedKey === 'codigo') {
                  codigoMaterial = val;
              }
              if (normalizedKey === 'cor') {
                  cor = val;
              }
              if (normalizedKey.includes('quantidade') || normalizedKey.includes('qtd') || normalizedKey.includes('estoque') || normalizedKey.includes('saldo')) {
                  quantidade = Number(val) || 0;
              }
          }

          const identificador = String(nomeMaterial || codigoMaterial || "").trim();
          if (!identificador) continue;

          const materialDb = materiais.find(
              m => m.nome.toLowerCase() === identificador.toLowerCase() || m.codigo?.toLowerCase() === identificador.toLowerCase()
          );

          if (materialDb) {
              novosEstoquesCores.push({
                  materialId: materialDb.id,
                  materialNome: materialDb.nome,
                  materialCodigo: materialDb.codigo || "",
                  cor: String(cor).trim(),
                  quantidade
              });
              mapaTotalPorMaterial[materialDb.id] = (mapaTotalPorMaterial[materialDb.id] || 0) + quantidade;
          }
      }

      if (novosEstoquesCores.length === 0) {
          toast.error("Nenhum material correspondente encontrado. Verifique as colunas (Material, Cor, Quantidade).");
          setIsProcessing(false);
          return;
      }

      let totalAtualizados = 0;
      let totalZerados = 0;

      const promises = materiais.map(mat => {
        const novoEstoque = mapaTotalPorMaterial[mat.id] || 0;
        if (novoEstoque > 0) totalAtualizados++;
        else totalZerados++;

        return supabase
          .from("materiais")
          .update({ estoque_fabrica: novoEstoque })
          .eq("id", mat.id);
      });

      for (let i = 0; i < promises.length; i += 50) {
        await Promise.all(promises.slice(i, i + 50));
      }

      const now = new Date().toISOString();
      localStorage.setItem(`estoque_materiais_cores_${empresaId}`, JSON.stringify(novosEstoquesCores));
      localStorage.setItem(`estoque_materiais_cores_data_${empresaId}`, now);
      
      setInventario(novosEstoquesCores);
      setDataAtualizacao(now);
      queryClient.invalidateQueries({ queryKey: ["materiais"] });
      queryClient.invalidateQueries({ queryKey: ["materiais-estoque"] });

      toast.success(`Estoque atualizado! ${totalAtualizados} materiais com saldo e ${totalZerados} zerados.`);
      setDialogUploadOpen(false);
    } catch (err: any) {
      toast.error("Erro ao processar planilha: " + err.message);
    } finally {
      setIsProcessing(false);
      e.target.value = ''; 
    }
  };

  const handleManualAdd = async () => {
    if (!manualMaterialId || !manualCor || !manualQuantidade) {
        toast.error("Preencha todos os campos.");
        return;
    }
    
    setIsProcessing(true);
    try {
        const mat = materiais?.find(m => m.id === manualMaterialId);
        if (!mat) return;
        
        let current = [...inventario];
        const index = current.findIndex(c => c.materialId === manualMaterialId && c.cor === manualCor);
        
        if (index >= 0) {
            current[index].quantidade = Number(manualQuantidade);
        } else {
            current.push({
                materialId: mat.id,
                materialNome: mat.nome,
                materialCodigo: mat.codigo || "",
                cor: manualCor,
                quantidade: Number(manualQuantidade)
            });
        }

        const totalFabrica = current.filter(c => c.materialId === mat.id).reduce((acc, c) => acc + c.quantidade, 0);

        await supabase.from("materiais").update({ estoque_fabrica: totalFabrica }).eq("id", mat.id);

        localStorage.setItem(`estoque_materiais_cores_${empresaId}`, JSON.stringify(current));
        const now = new Date().toISOString();
        localStorage.setItem(`estoque_materiais_cores_data_${empresaId}`, now);
        
        setInventario(current);
        setDataAtualizacao(now);
        setDialogManualOpen(false);
        toast.success("Estoque manual adicionado com sucesso!");
        
        setManualMaterialId("");
        setManualCor("");
        setManualQuantidade("");
        queryClient.invalidateQueries({ queryKey: ["materiais-estoque"] });
    } catch (e) {
        console.error(e);
        toast.error("Erro ao salvar estoque manual.");
    } finally {
        setIsProcessing(false);
    }
  };

  const allRows = useMemo(() => {
    if (!materiais) return [];
    
    return materiais.map((mat) => {
      let coresDefinidas = mat.materiais_cores?.map((c: any) => ({ descricao: c.nome, codigo: c.codigo })) || [];

      const coresDoInventario = inventario.filter(i => i.materialId === mat.id);
      
      const mapCores = new Map<string, any>();

      coresDefinidas.forEach(c => {
        const nomeCor = c.descricao.toUpperCase().trim();
        mapCores.set(nomeCor, {
          codigo: c.codigo || '-',
          cor: c.descricao, // keep original case
          estoque: 0
        });
      });

      coresDoInventario.forEach(item => {
        const nomeCor = item.cor.toUpperCase().trim();
        if (mapCores.has(nomeCor)) {
            mapCores.get(nomeCor).estoque = item.quantidade;
        } else {
            mapCores.set(nomeCor, {
              codigo: '-',
              cor: item.cor,
              estoque: item.quantidade
            });
        }
      });

      const todasCores = Array.from(mapCores.values());
      const estoqueTotal = todasCores.length > 0 
        ? todasCores.reduce((acc, curr) => acc + curr.estoque, 0)
        : (mat.estoque_fabrica || 0);

      return {
        id: mat.id,
        codigo: mat.codigo || '-',
        nome: mat.nome,
        unidade_medida: mat.unidade_medida || '-',
        estoqueTotal,
        produtosVinculados: mat.produto_materiais || [],
        cores: todasCores.length > 0 ? todasCores : [{ cor: 'Sem cor definida', estoque: mat.estoque_fabrica || 0 }]
      };
    });
  }, [materiais, inventario]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allRows.filter(row => 
      row.nome.toLowerCase().includes(term) || 
      row.codigo.toLowerCase().includes(term) ||
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
    
    // Gerar a estrutura plana (linha por cor)
    const exportData = filteredRows.flatMap(r => 
      r.cores.map(c => ({
        "Código": r.codigo,
        "Material": r.nome,
        "Cor": c.cor,
        "Quantidade em Estoque": c.estoque
      }))
    );

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    XLSX.writeFile(wb, `Estoque_Materiais_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Estoque de Materiais</h1>
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
                  Selecione o material, a cor e digite o estoque atual total dessa cor.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label>Material</Label>
                      <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                          <PopoverTrigger asChild>
                              <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={comboboxOpen}
                                  className="w-full justify-between font-normal"
                              >
                                  {manualMaterialId && materiais
                                      ? (() => {
                                          const selected = materiais.find((m) => m.id === manualMaterialId);
                                          return selected ? `${selected.codigo ? `${selected.codigo} - ` : ''}${selected.nome}` : "Selecione o material...";
                                      })()
                                      : "Selecione o material..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full sm:w-[400px] p-0" align="start">
                              <Command>
                                  <CommandInput placeholder="Buscar material por nome ou código..." />
                                  <CommandList>
                                      <CommandEmpty>Nenhum material encontrado.</CommandEmpty>
                                      <CommandGroup>
                                          {materiais?.map((m) => (
                                              <CommandItem
                                                  key={m.id}
                                                  value={`${m.codigo || ''} ${m.nome}`}
                                                  onSelect={() => {
                                                      setManualMaterialId(m.id);
                                                      setManualCor(""); // Reset color when material changes
                                                      setComboboxOpen(false);
                                                  }}
                                              >
                                                  <Check
                                                      className={cn(
                                                          "mr-2 h-4 w-4",
                                                          manualMaterialId === m.id ? "opacity-100" : "opacity-0"
                                                      )}
                                                  />
                                                  {m.codigo ? <span className="font-mono text-muted-foreground mr-2">{m.codigo}</span> : null}
                                                  {m.nome}
                                              </CommandItem>
                                          ))}
                                      </CommandGroup>
                                  </CommandList>
                              </Command>
                          </PopoverContent>
                      </Popover>
                  </div>
                  <div className="space-y-2">
                      <Label>Cor</Label>
                      <Select value={manualCor} onValueChange={setManualCor} disabled={!manualMaterialId}>
                          <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Única">Única</SelectItem>
                              {materiais?.find(m => m.id === manualMaterialId)?.materiais_cores?.map((c: any) => (
                                  <SelectItem key={c.nome} value={c.nome}>{c.codigo ? `${c.codigo} - ` : ''}{c.nome}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label>Quantidade em Estoque</Label>
                      <Input 
                          type="number" 
                          placeholder="0"
                          value={manualQuantidade}
                          onChange={e => setManualQuantidade(e.target.value)}
                      />
                  </div>
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
                <DialogTitle>Subir Inventário de Materiais</DialogTitle>
                <DialogDescription>
                  Para garantir que o estoque seja lido corretamente, a sua planilha Excel precisa conter as seguintes colunas (a ordem não importa):
                </DialogDescription>
              </DialogHeader>
              
              <div className="bg-muted p-4 rounded-md overflow-x-auto border border-border">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="pb-2 font-semibold">Código <span className="font-normal italic text-muted-foreground">(ou Material)</span></th>
                      <th className="pb-2 font-semibold">Cor</th>
                      <th className="pb-2 font-semibold text-right">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 text-muted-foreground">MALHA-01</td>
                      <td className="py-2 text-muted-foreground">Preto</td>
                      <td className="py-2 text-right font-mono font-medium">150</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-muted-foreground">MALHA-01</td>
                      <td className="py-2 text-muted-foreground">Branco</td>
                      <td className="py-2 text-right font-mono font-medium">200</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                * Qualquer material na planilha que não constar no sistema será ignorado.<br/>
                * Materiais ausentes na planilha terão o estoque **zerado**.
              </p>

              <DialogFooter className="mt-2">
                <Label htmlFor="upload-inventario-materiais" className="cursor-pointer w-full">
                  <div className={`flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium text-sm transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    {isProcessing ? 'Processando...' : 'Selecionar e Enviar Planilha'}
                  </div>
                  <Input 
                    id="upload-inventario-materiais" 
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
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right w-[150px]">Estoque Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum material encontrado.
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
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.codigo}</TableCell>
                      <TableCell className="text-xs font-medium">{row.nome}</TableCell>
                      <TableCell className="text-xs">{row.unidade_medida}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.estoqueTotal}
                      </TableCell>
                    </TableRow>
                    
                    {expandedRows[row.id] && (
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={5} className="p-0 border-b">
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
                                          {c.codigo}
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
                              <h4 className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase">Produtos Vinculados</h4>
                              {row.produtosVinculados && row.produtosVinculados.length > 0 ? (
                                <div className="flex flex-col gap-2 max-w-md">
                                  {row.produtosVinculados.map((pm: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-1.5 px-3 rounded-md border bg-card shadow-sm">
                                      <span className="text-[10px] font-medium text-muted-foreground">
                                        {pm.produto?.sku ? `${pm.produto.sku} - ` : ''}{pm.produto?.nome}
                                      </span>
                                      <span className="text-[10px] font-bold ml-3 text-right">
                                        Consumo: {pm.consumo_padrao} {row.unidade_medida}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Nenhum produto utiliza este material</span>
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
