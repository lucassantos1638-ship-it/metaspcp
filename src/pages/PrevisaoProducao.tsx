import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, Calculator, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

interface ProdutoSelecionado {
  id: string; // temp id for list
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  tempoUnitario: number; // minutes
}

const PrevisaoProducao = () => {
  const empresaId = useEmpresaId();
  const [cliente, setCliente] = useState("");
  const [dataEntrega, setDataEntrega] = useState<Date | undefined>();
  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoSelecionado[]>([]);

  // Selection state
  const [open, setOpen] = useState(false);
  const [selectedProdutoId, setSelectedProdutoId] = useState("");
  const [quantidadeInput, setQuantidadeInput] = useState("");

  // Queries
  const { data: produtos } = useQuery({
    queryKey: ["produtos-forecast", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      // Fetch products and their metrics
      // Note: Joining metrics to get unit time
      const { data, error } = await supabase
        .from("produtos")
        .select(`
                id, 
                nome, 
                produto_metricas(tempo_medio_por_peca_minutos)
            `)
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;

      return data.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        tempoMedio: p.produto_metricas?.[0]?.tempo_medio_por_peca_minutos || 0
      }));
    }
  });

  const { data: empresaConfig } = useQuery({
    queryKey: ["empresa-config-forecast", empresaId],
    enabled: !!empresaId,
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("escala_semanal")
        .eq("id", empresaId)
        .single();

      if (error) throw error;
      return (data as any).escala_semanal;
    }
  });

  // Helper to parse time string "HH:mm" to minutes from midnight
  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  // Helper to get daily capacity info
  const getDailyInfo = (date: Date, schedule: any, isToday: boolean = false) => {
    if (!schedule) return {
      capacity: 480,
      desc: "08:00 - 17:00",
      intervals: [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }]
    };

    const days = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dayName = days[date.getDay()];
    const dayConfig = schedule[dayName];

    if (!dayConfig || !dayConfig.ativo) return { capacity: 0, desc: "Folga", intervals: [] };

    const entrada = timeToMinutes(dayConfig.entrada);
    const saidaAlmoco = timeToMinutes(dayConfig.saida_almoco);
    const voltaAlmoco = timeToMinutes(dayConfig.volta_almoco);
    const saida = timeToMinutes(dayConfig.saida);

    let currentCapacity = 0;

    if (isToday) {
      // If today, check current time
      const nowMinutes = date.getHours() * 60 + date.getMinutes();

      // If already passed end of day
      if (nowMinutes >= saida) {
        return { capacity: 0, desc: `${dayConfig.entrada} - ${dayConfig.saida} (Encerrado)`, intervals: [] };
      }

      // Calculate remaining time
      // 1. Morning Shift Intersection
      // Effective start for morning is max(now, entrada)
      // If now is past morning shift, effective start > saidaAlmoco, so Math.max(0, negative) = 0
      const effectiveMorningStart = Math.max(nowMinutes, entrada);
      const morningMinutes = Math.max(0, saidaAlmoco - effectiveMorningStart);

      // 2. Afternoon Shift Intersection
      const effectiveAfternoonStart = Math.max(nowMinutes, voltaAlmoco);
      const afternoonMinutes = Math.max(0, saida - effectiveAfternoonStart);

      currentCapacity = morningMinutes + afternoonMinutes;

      return {
        capacity: currentCapacity,
        desc: `${dayConfig.entrada} - ${dayConfig.saida} (Restante)`,
        intervals: [
          { start: dayConfig.entrada, end: dayConfig.saida_almoco },
          { start: dayConfig.volta_almoco, end: dayConfig.saida }
        ]
      };

    } else {
      // Full day capacity
      const morningMinutes = Math.max(0, saidaAlmoco - entrada);
      const afternoonMinutes = Math.max(0, saida - voltaAlmoco);
      currentCapacity = morningMinutes + afternoonMinutes;

      return {
        capacity: currentCapacity,
        desc: `${dayConfig.entrada} - ${dayConfig.saida}`,
        intervals: [
          { start: dayConfig.entrada, end: dayConfig.saida_almoco },
          { start: dayConfig.volta_almoco, end: dayConfig.saida }
        ]
      };
    }
  };

  // Calculate Logic
  const calculoPrevisao = useMemo(() => {
    if (produtosSelecionados.length === 0) return null;

    // 1. Total Time Needed
    const totalMinutos = produtosSelecionados.reduce((acc, curr) => acc + (curr.quantidade * curr.tempoUnitario), 0);
    const totalHoras = totalMinutos / 60;

    // 2. Estimate Days based on Real Schedule
    let remainingMin = totalMinutos;
    let businessDays = 0;
    let currentDate = new Date(); // Start from today

    // Store timeline
    const cronograma = [];

    // Safety break
    let loopCount = 0;

    // Check if first iteration is today
    let isFirstDay = true;

    while (remainingMin > 0 && loopCount < 365) {
      loopCount++;

      const { capacity, desc, intervals } = getDailyInfo(currentDate, empresaConfig, isFirstDay);
      // After first check, subsequent iterations are not 'today' in the sense of partial time, 
      // but 'isFirstDay' controls the logic for the *starting* date. 
      // Actually, if we increment date, isFirstDay should become false.

      if (capacity > 0) {
        // This is a work day (and if it was today, it had remaining hours)
        businessDays++;

        let workedMinutes = Math.min(remainingMin, capacity);
        remainingMin -= workedMinutes;

        cronograma.push({
          date: new Date(currentDate),
          capacity,
          workedMinutes,
          desc,
          intervals
        });
      }

      if (remainingMin > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        isFirstDay = false; // Next days are full days
        // Important: When moving to next day, reset time to 00:00 or ignore it?
        // getDailyInfo for isToday=false ignores the time component of the date object, so it's fine.
      }
    }

    const dataEstimada = new Date(currentDate);

    // 3. Compare with Deadline
    let atrasado = false;
    let horasExtrasNecessarias = 0;

    if (dataEntrega) {
      if (dataEstimada > dataEntrega) {
        atrasado = true;
        // Simplified overtime calc
        const diffTime = dataEntrega.getTime() - new Date().getTime();
        const daysAvailable = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // Estimate: Total mins - (Days * ~480 * 0.7)
        // Better: calculate remaining capacity accurately (similar loop as above)
        horasExtrasNecessarias = Math.max(0, (totalMinutos - (daysAvailable * 480 * 5 / 7)) / 60);
      }
    }

    return {
      totalMinutos,
      totalHoras,
      businessDays,
      dataEstimada,
      atrasado,
      horasExtrasNecessarias,
      cronograma
    };

  }, [produtosSelecionados, dataEntrega, empresaConfig]);

  // Handlers
  const handleAddProduto = () => {
    if (!selectedProdutoId || !quantidadeInput) return;

    const prod = produtos?.find(p => p.id === selectedProdutoId);
    if (!prod) return;

    setProdutosSelecionados(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        produtoId: prod.id,
        produtoNome: prod.nome,
        quantidade: parseInt(quantidadeInput),
        tempoUnitario: prod.tempoMedio
      }
    ]);

    // Reset inputs
    setSelectedProdutoId("");
    setQuantidadeInput("");
  };

  const removeProduto = (id: string) => {
    setProdutosSelecionados(prev => prev.filter(p => p.id !== id));
  };


  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">Previsão de Produção</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Calcule prazos de entrega e carga de trabalho baseada nos pedidos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente / Identificação</Label>
                  <Input
                    placeholder="Nome do cliente ou Pedido #123"
                    value={cliente}
                    onChange={e => setCliente(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Entrega Desejada</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dataEntrega && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataEntrega ? format(dataEntrega, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dataEntrega}
                        onSelect={setDataEntrega}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label className="mb-2 block">Adicionar Produtos</Label>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-2">
                    <span className="text-xs text-muted-foreground">Produto</span>

                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className="w-full justify-between"
                        >
                          {selectedProdutoId
                            ? produtos?.find((produto) => produto.id === selectedProdutoId)?.nome
                            : "Selecione um produto..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar produto..." />
                          <CommandList>
                            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                            <CommandGroup>
                              {produtos?.map((produto) => (
                                <CommandItem
                                  key={produto.id}
                                  value={produto.nome}
                                  onSelect={() => {
                                    setSelectedProdutoId(produto.id === selectedProdutoId ? "" : produto.id);
                                    setOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedProdutoId === produto.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {produto.nome} ({produto.tempoMedio.toFixed(1)} min/pç)
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                  </div>
                  <div className="w-32 space-y-2">
                    <span className="text-xs text-muted-foreground">Quantidade</span>
                    <Input
                      type="number"
                      placeholder="Qtd"
                      value={quantidadeInput}
                      onChange={e => setQuantidadeInput(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddProduto}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {produtosSelecionados.length > 0 && (
                <div className="border rounded-md mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Tempo Unit.</TableHead>
                        <TableHead className="text-right">Tempo Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produtosSelecionados.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>{item.produtoNome}</TableCell>
                          <TableCell className="text-right">{item.quantidade}</TableCell>
                          <TableCell className="text-right">{item.tempoUnitario.toFixed(1)} min</TableCell>
                          <TableCell className="text-right font-medium">
                            {((item.quantidade * item.tempoUnitario) / 60).toFixed(1)} h
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeProduto(item.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visual Calender View */}
          {calculoPrevisao && calculoPrevisao.cronograma.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" /> Cronograma de Trabalho
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Calendar Visual */}
                  <div>
                    <Calendar
                      mode="multiple"
                      selected={calculoPrevisao.cronograma.map(d => d.date)}
                      className="rounded-md border shadow w-fit"
                    />
                  </div>
                  {/* Schedule List */}
                  <div className="flex-1 space-y-3 max-h-[350px] overflow-y-auto pr-2">
                    <Label>Dias de Produção ({calculoPrevisao.businessDays})</Label>
                    {calculoPrevisao.cronograma.map((dia, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div>
                          <div className="font-semibold">{format(dia.date, "dd 'de' MMMM", { locale: ptBR })}</div>
                          <div className="text-xs text-muted-foreground flex gap-2 items-center mt-1">
                            <Badge variant="outline">{format(dia.date, "EEEE", { locale: ptBR })}</Badge>
                            <span>{dia.desc}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary">{(dia.workedMinutes / 60).toFixed(1)}h</div>
                          <div className="text-[10px] text-muted-foreground">de produção</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right Column: Results Summary */}
        <div className="space-y-6">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Resultado da Previsão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!calculoPrevisao ? (
                <div className="text-center py-8 text-muted-foreground">
                  Adicione produtos para ver a estimativa.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Tempo Total Necessário</div>
                    <div className="text-3xl font-bold flex items-baseline gap-2">
                      {calculoPrevisao.totalHoras.toFixed(1)}
                      <span className="text-sm font-normal text-muted-foreground">horas</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Aprox. {calculoPrevisao.businessDays} dias úteis de trabalho
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <div className="text-sm font-medium text-muted-foreground">Estimativa de Entrega</div>
                    <div className="text-2xl font-bold text-primary">
                      {format(calculoPrevisao.dataEstimada, "dd 'de' MMMM", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Considerando início hoje
                    </div>
                  </div>

                  {dataEntrega && (
                    <div className="pt-4 border-t">
                      {calculoPrevisao.atrasado ? (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Risco de Atraso!</AlertTitle>
                          <AlertDescription>
                            A data desejada é <strong>{format(dataEntrega, "dd/MM", { locale: ptBR })}</strong>, mas a estimativa é apenas para <strong>{format(calculoPrevisao.dataEstimada, "dd/MM", { locale: ptBR })}</strong>.
                            <div className="mt-2 font-semibold">
                              Horas Extras Estimadas: {calculoPrevisao.horasExtrasNecessarias.toFixed(1)}h
                            </div>
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert className="bg-green-50 border-green-200 text-green-700">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertTitle>Dentro do Prazo</AlertTitle>
                          <AlertDescription>
                            É possível entregar até a data desejada sem necessidade de horas extras.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PrevisaoProducao;
