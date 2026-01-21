import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Info, Package, Eye, Search, Plus, Check, ChevronsUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useProdutos } from "@/hooks/useProdutos";
import { formatarCusto } from "@/lib/custoUtils";
import { formatarTempoProdutivo } from "@/lib/timeUtils";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useNavigate } from "react-router-dom";

const Lotes = () => {
  const queryClient = useQueryClient();
  const empresaId = useEmpresaId();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [busca, setBusca] = useState("");

  const [novoLote, setNovoLote] = useState({
    numero_lote: "",
    nome_lote: "",
    quantidade_total: "",
    produto_id: "",
    previsao_id: "",
  });
  const [estimativa, setEstimativa] = useState<{
    tempoEstimado: number;
    custoEstimado: number;
    etapas: any[];
  } | null>(null);

  const { data: produtos } = useProdutos(true);

  const { data: previsoesAtivas } = useQuery({
    queryKey: ["previsoes_ativas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsoes_producao")
        .select("id, nome_pedido, data_entrega_desejada, status")
        .eq("empresa_id", empresaId)
        .eq("status", "em_andamento")
        .order("data_entrega_desejada", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: lotes, isLoading } = useQuery({
    queryKey: ["lotes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("*, produto:produtos(nome, sku)")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const lotesFiltrados = lotes?.filter((lote) => {
    const termo = busca.toLowerCase();
    return (
      lote.numero_lote.toLowerCase().includes(termo) ||
      lote.nome_lote.toLowerCase().includes(termo) ||
      (lote.produto?.nome || "").toLowerCase().includes(termo) ||
      (lote.produto?.sku || "").toLowerCase().includes(termo)
    );
  });

  useEffect(() => {
    const calcularEstimativa = async () => {
      if (!novoLote.produto_id || novoLote.produto_id === "sem-produto" || !novoLote.quantidade_total) {
        setEstimativa(null);
        return;
      }

      const quantidade = parseInt(novoLote.quantidade_total);
      if (isNaN(quantidade) || quantidade <= 0) {
        setEstimativa(null);
        return;
      }

      const { data: metricas } = await supabase
        .from("produto_metricas")
        .select("*")
        .eq("produto_id", novoLote.produto_id);

      if (!metricas || metricas.length === 0) {
        setEstimativa(null);
        return;
      }

      const tempoMedioPorPeca = metricas.reduce(
        (sum, m) => sum + (m.tempo_medio_por_peca_minutos || 0),
        0
      );

      const custoMedioPorPeca = metricas.reduce(
        (sum, m) => sum + (m.custo_medio_por_peca || 0),
        0
      );

      setEstimativa({
        tempoEstimado: tempoMedioPorPeca * quantidade,
        custoEstimado: custoMedioPorPeca * quantidade,
        etapas: metricas.map((m) => ({
          nome: m.subetapa_nome || m.etapa_nome,
          tempo: m.tempo_medio_por_peca_minutos,
          custo: m.custo_medio_por_peca,
        })),
      });
    };

    calcularEstimativa();
  }, [novoLote.produto_id, novoLote.quantidade_total]);

  const createLote = useMutation({
    mutationFn: async () => {
      const payload: any = {
        numero_lote: novoLote.numero_lote,
        nome_lote: novoLote.nome_lote,
        quantidade_total: parseInt(novoLote.quantidade_total),
        empresa_id: empresaId,
      };

      if (novoLote.produto_id && novoLote.produto_id !== "sem-produto") {
        payload.produto_id = novoLote.produto_id;
      }

      // Adicionar previsao_id se selecionado
      if (novoLote.previsao_id && novoLote.previsao_id !== "sem-pedido") {
        payload.previsao_id = novoLote.previsao_id;
      }

      const { data, error } = await supabase
        .from("lotes")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["previsoes_producao"] });
      setNovoLote({
        numero_lote: "",
        nome_lote: "",
        quantidade_total: "",
        produto_id: "",
        previsao_id: ""
      });
      setEstimativa(null);
      setIsDialogOpen(false);
      toast.success("Lote criado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao criar lote");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lotes</h1>
          <p className="text-muted-foreground">Gerencie os lotes de produção</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Lote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Novo Lote</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2 flex flex-col">
                <Label htmlFor="produto">Produto (opcional)</Label>
                <Popover open={openCombobox} onOpenChange={setOpenCombobox} modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCombobox}
                      className="w-full justify-between"
                    >
                      {novoLote.produto_id && novoLote.produto_id !== "sem-produto"
                        ? produtos?.find((p) => p.id === novoLote.produto_id)?.nome
                        : "Selecionar produto..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command
                      filter={(value, search) => {
                        if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                        return 0;
                      }}
                    >
                      <CommandInput placeholder="Buscar por nome ou SKU..." />
                      <CommandList>
                        <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="sem-produto"
                            onSelect={() => {
                              setNovoLote({ ...novoLote, produto_id: "sem-produto" });
                              setOpenCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                novoLote.produto_id === "sem-produto" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Sem produto
                          </CommandItem>
                          {produtos?.map((produto) => (
                            <CommandItem
                              key={produto.id}
                              value={`${produto.nome} ${produto.sku || ''}`} // Include SKU in searchable value
                              onSelect={() => {
                                setNovoLote({
                                  ...novoLote,
                                  produto_id: produto.id,
                                  nome_lote: novoLote.nome_lote || produto.nome
                                });
                                setOpenCombobox(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  novoLote.produto_id === produto.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {produto.nome}
                              {produto.sku && <span className="ml-2 text-muted-foreground text-xs">({produto.sku})</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="previsao_id">Vincular a Pedido (Opcional)</Label>
                <Select
                  value={novoLote.previsao_id}
                  onValueChange={(value) =>
                    setNovoLote({ ...novoLote, previsao_id: value })
                  }
                >
                  <SelectTrigger id="previsao_id">
                    <SelectValue placeholder="Sem vínculo (lote avulso)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem-pedido">Sem vínculo (lote avulso)</SelectItem>
                    {previsoesAtivas?.map((previsao) => (
                      <SelectItem key={previsao.id} value={previsao.id}>
                        {previsao.nome_pedido} - Entrega: {new Date(previsao.data_entrega_desejada).toLocaleDateString('pt-BR')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {novoLote.previsao_id && novoLote.previsao_id !== "sem-pedido" && (
                  <Alert className="mt-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Este lote será vinculado ao pedido e o progresso será atualizado automaticamente.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero_lote">Número do Lote *</Label>
                <Input
                  id="numero_lote"
                  value={novoLote.numero_lote}
                  onChange={(e) =>
                    setNovoLote({ ...novoLote, numero_lote: e.target.value })
                  }
                  placeholder="Ex: L001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome_lote">Nome do Lote *</Label>
                <Input
                  id="nome_lote"
                  value={novoLote.nome_lote}
                  onChange={(e) =>
                    setNovoLote({ ...novoLote, nome_lote: e.target.value })
                  }
                  placeholder="Ex: Camisetas Vermelhas"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantidade_total">Quantidade Total *</Label>
                <Input
                  id="quantidade_total"
                  type="number"
                  value={novoLote.quantidade_total}
                  onChange={(e) =>
                    setNovoLote({ ...novoLote, quantidade_total: e.target.value })
                  }
                  placeholder="Ex: 500"
                />
              </div>

              {
                estimativa && novoLote.produto_id && novoLote.produto_id !== "sem-produto" && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Estimativa de Produção</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 space-y-1 text-sm">
                        <p className="flex items-center gap-2">
                          <Package className="h-3 w-3" />
                          <span className="font-medium">Etapas necessárias:</span>
                          {estimativa.etapas.length}
                        </p>
                        <p>
                          <span className="font-medium">Tempo estimado:</span>{" "}
                          {formatarTempoProdutivo(estimativa.tempoEstimado)}
                        </p>
                        <p>
                          <span className="font-medium">Custo estimado:</span>{" "}
                          {formatarCusto(estimativa.custoEstimado)}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )
              }

              <Button
                onClick={() => createLote.mutate()}
                disabled={
                  !novoLote.numero_lote ||
                  !novoLote.nome_lote ||
                  !novoLote.quantidade_total
                }
                className="w-full"
              >
                Criar Lote
              </Button>
            </div >
          </DialogContent >
        </Dialog >
      </div >

      {/* Filtro de Busca */}
      < div className="relative" >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, número do lote, produto ou SKU..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div >

      {/* Lista de Lotes (Tabela) */}
      < div className="border rounded-md" >
        {
          isLoading ? (
            <div className="space-y-2 p-4" >
              {
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))
              }
            </div>
          ) : lotesFiltrados && lotesFiltrados.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Número</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotesFiltrados.map((lote) => (
                  <TableRow
                    key={lote.id}
                    className="h-8 cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/lotes/${lote.id}`)}
                  >
                    <TableCell className="py-1 font-mono text-xs">{lote.numero_lote}</TableCell>
                    <TableCell className="py-1 font-medium text-sm">{lote.nome_lote}</TableCell>
                    <TableCell className="py-1 text-sm text-muted-foreground">
                      {lote.produto ? (
                        <span className="flex items-center gap-1">
                          {lote.produto.nome}
                          {lote.produto.sku && <span className="text-xs">({lote.produto.sku})</span>}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="py-1 text-right font-medium">{lote.quantidade_total}</TableCell>
                    <TableCell className="py-1">
                      <Badge
                        variant={lote.finalizado ? "default" : "secondary"}
                        className={`h-5 text-[10px] px-1.5 ${lote.finalizado
                          ? "bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-100/80 border-blue-200"
                          }`}
                      >
                        {lote.finalizado ? "Finalizado" : "Em andamento"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/lotes/${lote.id}`);
                        }}
                        title="Ver Detalhes"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-muted/10">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhum lote encontrado</p>
              <p className="text-sm text-muted-foreground">
                {busca ? "Tente ajustar a busca" : "Crie seu primeiro lote para começar"}
              </p>
            </div>
          )}
      </div >
    </div >
  );
};

export default Lotes;
