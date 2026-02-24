import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Play, ClipboardList, Check, ChevronsUpDown } from "lucide-react";
import { useIniciarProducao, useColaboradorTemAtividadeAberta } from "@/hooks/useProducaoStartStop";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function FormularioIniciarAtividade() {
  const empresaId = useEmpresaId();
  const [colaboradorId, setColaboradorId] = useState("");
  const [openColaborador, setOpenColaborador] = useState(false);
  const [openLote, setOpenLote] = useState(false);
  const [loteId, setLoteId] = useState("");
  const [etapaId, setEtapaId] = useState("");
  const [subetapaId, setSubetapaId] = useState("");
  const [atividadeId, setAtividadeId] = useState(""); // Novo campo
  const [isAtividadeAvulsa, setIsAtividadeAvulsa] = useState(false); // Switch
  const [isTerceirizado, setIsTerceirizado] = useState(false);
  const [quantidade, setQuantidade] = useState("");
  const [entidadeId, setEntidadeId] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [quantidadeEnviada, setQuantidadeEnviada] = useState("");
  const [dataInicio, setDataInicio] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [horaInicio, setHoraInicio] = useState(new Date().toTimeString().slice(0, 5));
  const [segundosInicio, setSegundosInicio] = useState("0");

  const iniciarProducao = useIniciarProducao();
  const { data: atividadeAberta } = useColaboradorTemAtividadeAberta(colaboradorId);

  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: lotes } = useQuery({
    queryKey: ["lotes-ativos", empresaId],
    enabled: !!empresaId && !isAtividadeAvulsa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("finalizado", false)
        .order("numero_lote");
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  // Buscar lista de Atividades Avulsas
  const { data: atividadesAvulsas } = useQuery({
    queryKey: ["atividades-avulsas", empresaId],
    enabled: !!empresaId && isAtividadeAvulsa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atividades")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: entidades } = useQuery({
    queryKey: ["entidades-terceirizadas", empresaId],
    enabled: !!empresaId && isTerceirizado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidade")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("tipo", "terceirizado")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: servicos } = useQuery({
    queryKey: ["entidade-servicos", entidadeId],
    enabled: !!entidadeId && isTerceirizado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidade_servicos")
        .select("*")
        .eq("entidade_id", entidadeId)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Buscar o produto do lote selecionado
  const { data: selectedLote } = useQuery({
    queryKey: ["lote", loteId],
    enabled: !!loteId && !isAtividadeAvulsa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("produto_id, quantidade_total")
        .eq("id", loteId)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  // Buscar etapas vinculadas ao produto
  const { data: produtoEtapas } = useQuery({
    queryKey: ["produto_etapas", selectedLote?.produto_id],
    enabled: !!selectedLote?.produto_id && !isAtividadeAvulsa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_etapas")
        .select("etapa_id, subetapa_id, ordem")
        .eq("produto_id", selectedLote.produto_id)
        .order("ordem");
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  const { data: etapas } = useQuery({
    queryKey: ["etapas", empresaId],
    enabled: !!empresaId && !isAtividadeAvulsa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etapas")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  const etapasFiltradas = etapas?.filter(etapa => {
    if (!produtoEtapas || produtoEtapas.length === 0) return false;
    return produtoEtapas.some(pe => pe.etapa_id === etapa.id);
  }).sort((a, b) => {
    const ordemA = produtoEtapas?.find(pe => pe.etapa_id === a.id)?.ordem || 0;
    const ordemB = produtoEtapas?.find(pe => pe.etapa_id === b.id)?.ordem || 0;
    return ordemA - ordemB;
  });

  const { data: subetapas } = useQuery({
    queryKey: ["subetapas", etapaId, empresaId],
    queryFn: async () => {
      if (!etapaId) return [];
      const { data, error } = await supabase
        .from("subetapas")
        .select("*")
        .eq("etapa_id", etapaId)
        .eq("empresa_id", empresaId)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!etapaId && !!empresaId && !isAtividadeAvulsa,
  });

  const subetapasFiltradas = subetapas?.filter(sub => {
    if (!produtoEtapas || produtoEtapas.length === 0) return false;
    const etapaConfig = produtoEtapas.filter(pe => pe.etapa_id === etapaId);
    const temConfigSubetapa = etapaConfig.some(pe => pe.subetapa_id !== null);
    if (temConfigSubetapa) {
      return etapaConfig.some(pe => pe.subetapa_id === sub.id);
    }
    return false;
  });

  const listaEtapas = (loteId && selectedLote) ? etapasFiltradas : etapas;
  const listaSubetapas = (loteId && selectedLote) ? subetapasFiltradas : subetapas;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isTerceirizado) {
      if (!entidadeId || !servicoId || !quantidadeEnviada || !loteId) return;
    } else if (isAtividadeAvulsa) {
      if (!colaboradorId || !atividadeId) return;
    } else {
      if (!colaboradorId || !loteId || !etapaId) return;
    }

    iniciarProducao.mutate(
      {
        colaborador_id: isTerceirizado ? null : colaboradorId,
        lote_id: isAtividadeAvulsa ? null : loteId,
        etapa_id: (isAtividadeAvulsa || isTerceirizado) ? null : etapaId,
        subetapa_id: (isAtividadeAvulsa || isTerceirizado) ? null : (subetapaId || null),
        atividade_id: isAtividadeAvulsa ? atividadeId : null,
        terceirizado: isTerceirizado,
        entidade_id: isTerceirizado ? entidadeId : null,
        servico_id: isTerceirizado ? servicoId : null,
        quantidade_enviada: isTerceirizado && quantidadeEnviada ? parseInt(quantidadeEnviada) : null,
        quantidade_produzida: quantidade ? parseInt(quantidade) : null,
        data_inicio: dataInicio,
        hora_inicio: horaInicio,
        segundos_inicio: parseInt(segundosInicio),
        empresa_id: empresaId,
      },
      {
        onSuccess: () => {
          setColaboradorId("");
          setLoteId("");
          setEtapaId("");
          setSubetapaId("");
          setAtividadeId("");
          setQuantidade("");
          setEntidadeId("");
          setServicoId("");
          setQuantidadeEnviada("");
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          setDataInicio(`${year}-${month}-${day}`);
          setHoraInicio(new Date().toTimeString().slice(0, 5));
          setSegundosInicio("0");
        },
      }
    );
  };

  const temAtividadeAberta = !!atividadeAberta;

  const isPrimeiraEtapaDoProduto = !isAtividadeAvulsa && etapaId && listaEtapas && listaEtapas.length > 0 && listaEtapas[0].id === etapaId;
  const isEtapaPosterior = !isAtividadeAvulsa && etapaId && listaEtapas && listaEtapas.length > 0 && listaEtapas[0].id !== etapaId;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {temAtividadeAberta && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Este colaborador já possui uma atividade em aberto. Finalize antes de iniciar uma nova.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Colaborador */}
        {!isTerceirizado && (
          <div className="space-y-2">
            <Label htmlFor="colaborador">Colaborador *</Label>
            <Popover open={openColaborador} onOpenChange={setOpenColaborador}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openColaborador}
                  className="w-full justify-between"
                >
                  {colaboradorId
                    ? colaboradores?.find((colab) => colab.id === colaboradorId)?.nome
                    : "Selecione o colaborador"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom">
                <Command>
                  <CommandInput placeholder="Buscar colaborador..." />
                  <CommandList>
                    <CommandEmpty>Colaborador não encontrado.</CommandEmpty>
                    <CommandGroup>
                      {colaboradores?.map((colab) => (
                        <CommandItem
                          key={colab.id}
                          value={colab.nome}
                          onSelect={() => {
                            setColaboradorId(colab.id);
                            setOpenColaborador(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              colaboradorId === colab.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {colab.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Switches */}
        <div className="flex flex-col sm:flex-row gap-4 md:col-span-2 pt-2">
          <div className="flex-1 flex items-center space-x-2 border p-3 rounded-md bg-muted/20">
            <Switch
              id="atividade-avulsa"
              checked={isAtividadeAvulsa}
              onCheckedChange={(checked) => {
                setIsAtividadeAvulsa(checked);
                if (checked) setIsTerceirizado(false);
                setLoteId("");
                setEtapaId("");
                setSubetapaId("");
                setAtividadeId("");
                setEntidadeId("");
              }}
            />
            <Label htmlFor="atividade-avulsa" className="cursor-pointer flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Atividade Avulsa
            </Label>
          </div>
          <div className="flex-1 flex items-center space-x-2 border p-3 rounded-md bg-muted/20">
            <Switch
              id="terceirizado"
              checked={isTerceirizado}
              onCheckedChange={(checked) => {
                setIsTerceirizado(checked);
                if (checked) setIsAtividadeAvulsa(false);
                setColaboradorId("");
                setLoteId("");
                setEtapaId("");
                setSubetapaId("");
                setAtividadeId("");
              }}
            />
            <Label htmlFor="terceirizado" className="cursor-pointer flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Terceirização
            </Label>
          </div>
        </div>

        {isTerceirizado ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="lote-terc">Lote *</Label>
              <Popover open={openLote} onOpenChange={setOpenLote}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openLote}
                    className="w-full justify-between"
                  >
                    {loteId
                      ? `${lotes?.find((lote) => lote.id === loteId)?.numero_lote || ''} - ${lotes?.find((lote) => lote.id === loteId)?.nome_lote || ''}`
                      : "Selecione o lote"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom">
                  <Command>
                    <CommandInput placeholder="Buscar lote..." />
                    <CommandList>
                      <CommandEmpty>Lote não encontrado.</CommandEmpty>
                      <CommandGroup>
                        {lotes?.map((lote) => (
                          <CommandItem
                            key={lote.id}
                            value={`${lote.numero_lote} - ${lote.nome_lote}`}
                            onSelect={() => {
                              setLoteId(lote.id);
                              setOpenLote(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                loteId === lote.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {lote.numero_lote} - {lote.nome_lote}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entidade">Terceirizado *</Label>
              <Select value={entidadeId} onValueChange={setEntidadeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o terceiro" />
                </SelectTrigger>
                <SelectContent>
                  {entidades?.map((ent) => (
                    <SelectItem key={ent.id} value={ent.id}>
                      {ent.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="servico">Serviço *</Label>
              <Select value={servicoId} onValueChange={setServicoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {servicos?.map((serv) => (
                    <SelectItem key={serv.id} value={serv.id}>
                      {serv.nome} (R$ {serv.valor})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantidade-enviada">Quantidade Enviada *</Label>
              <Input
                id="quantidade-enviada"
                type="number"
                min="1"
                value={quantidadeEnviada}
                onChange={(e) => setQuantidadeEnviada(e.target.value)}
                placeholder="Ex: 100"
                required
              />
            </div>
          </>
        ) : isAtividadeAvulsa ? (
          // Campo para Atividade Avulsa
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="atividade">Atividade *</Label>
            <Select value={atividadeId} onValueChange={setAtividadeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a atividade" />
              </SelectTrigger>
              <SelectContent>
                {atividadesAvulsas?.map((ativ) => (
                  <SelectItem key={ativ.id} value={ativ.id}>
                    {ativ.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {atividadesAvulsas && atividadesAvulsas.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma atividade cadastrada. Vá em Configurações &gt; Etapas &gt; Atividades.</p>
            )}
          </div>
        ) : (
          // Campos para Produção (Lote/Etapa)
          <>
            <div className="space-y-2">
              <Label htmlFor="lote">Lote *</Label>
              <Popover open={openLote} onOpenChange={setOpenLote}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openLote}
                    className="w-full justify-between"
                  >
                    {loteId
                      ? `${lotes?.find((lote) => lote.id === loteId)?.numero_lote || ''} - ${lotes?.find((lote) => lote.id === loteId)?.nome_lote || ''}`
                      : "Selecione o lote"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom">
                  <Command>
                    <CommandInput placeholder="Buscar lote..." />
                    <CommandList>
                      <CommandEmpty>Lote não encontrado.</CommandEmpty>
                      <CommandGroup>
                        {lotes?.map((lote) => (
                          <CommandItem
                            key={lote.id}
                            value={`${lote.numero_lote} - ${lote.nome_lote}`}
                            onSelect={() => {
                              setLoteId(lote.id);
                              setOpenLote(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                loteId === lote.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {lote.numero_lote} - {lote.nome_lote}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="etapa">Etapa *</Label>
              <Select value={etapaId} onValueChange={(value) => {
                setEtapaId(value);
                setSubetapaId("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {listaEtapas?.map((etapa) => (
                    <SelectItem key={etapa.id} value={etapa.id}>
                      {etapa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loteId && produtoEtapas && produtoEtapas.length === 0 && (
                <p className="text-xs text-destructive">Este produto não possui etapas configuradas.</p>
              )}
            </div>

            {listaSubetapas && listaSubetapas.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subetapa">Subetapa</Label>
                <Select value={subetapaId} onValueChange={setSubetapaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a subetapa (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {listaSubetapas.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        <div className="space-y-4 md:col-span-2 border-t pt-4 mt-2">
          <h3 className="font-medium text-sm text-muted-foreground mb-2">Horário de Início</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data-inicio">Data *</Label>
              <Input
                type="date"
                id="data-inicio"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora-inicio">Hora *</Label>
              <div className="flex gap-2">
                <Input
                  type="time"
                  id="hora-inicio"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="flex-1"
                  required
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso de Bloqueio por Quantidade não definida (apenas para produção normal) */}
      {!isAtividadeAvulsa && selectedLote && selectedLote.quantidade_total <= 0 && isEtapaPosterior && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Não é possível iniciar etapas posteriores enquanto a quantidade do lote não for definida (final da primeira etapa).
          </AlertDescription>
        </Alert>
      )}

      {!isAtividadeAvulsa && selectedLote && selectedLote.quantidade_total <= 0 && isPrimeiraEtapaDoProduto && (
        <Alert className="mt-4 bg-yellow-50 text-yellow-800 border-yellow-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            A quantidade do lote será solicitada ao finalizar esta etapa.
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={
          iniciarProducao.isPending ||
          temAtividadeAberta ||
          (!isAtividadeAvulsa && !isTerceirizado && selectedLote && selectedLote.quantidade_total <= 0 && isEtapaPosterior)
        }
      >
        <Play className="mr-2 h-4 w-4" />
        {iniciarProducao.isPending ? "Iniciando..." : "Iniciar Atividade"}
      </Button>
    </form>
  );
}
