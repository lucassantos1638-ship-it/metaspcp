import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Clock, Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useProducoesEmAberto } from "@/hooks/useProducaoStartStop";
import { differenceInSeconds, parseISO, isFuture } from "date-fns";
import DialogFinalizarAtividade from "./DialogFinalizarAtividade";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const Timer = ({ dataInicio, horaInicio, segundosInicio }: { dataInicio: string, horaInicio: string, segundosInicio: number }) => {
  const [display, setDisplay] = useState("00:00:00");
  const [status, setStatus] = useState<"running" | "scheduled">("running");

  useEffect(() => {
    const updateTimer = () => {
      const startString = `${dataInicio}T${horaInicio}`;
      const startDate = parseISO(startString);
      startDate.setSeconds(startDate.getSeconds() + (segundosInicio || 0));

      const now = new Date();

      if (isFuture(startDate)) {
        setStatus("scheduled");
        setDisplay("Agendado");
        return;
      }

      setStatus("running");
      const diffInSec = differenceInSeconds(now, startDate);

      const hours = Math.floor(diffInSec / 3600);
      const minutes = Math.floor((diffInSec % 3600) / 60);
      const seconds = diffInSec % 60;

      setDisplay(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [dataInicio, horaInicio, segundosInicio]);

  if (status === "scheduled") {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="font-mono text-xs border-orange-200 text-orange-600 bg-orange-50 cursor-help">
            {display}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Início futuro: {dataInicio} às {horaInicio}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return <span className="font-mono tabular-nums">{display}</span>;
};

export default function ListaAtividadesEmAberto() {
  const { data: producoesEmAberto, isLoading } = useProducoesEmAberto();
  const [producaoSelecionada, setProducaoSelecionada] = useState<any>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [filtroNome, setFiltroNome] = useState("");
  const [openLotes, setOpenLotes] = useState<Record<string, boolean>>({});

  const toggleLote = (loteId: string) => {
    setOpenLotes(prev => ({ ...prev, [loteId]: !prev[loteId] }));
  };




  const formatarData = (data: string) => {
    return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
  };

  const handleFinalizar = (producao: any) => {
    setProducaoSelecionada(producao);
    setDialogAberto(true);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando atividades...</div>;
  }

  if (!producoesEmAberto || producoesEmAberto.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-foreground">Nenhuma atividade em andamento</p>
        <p className="text-sm text-muted-foreground">
          Inicie uma nova atividade usando o formulário acima
        </p>
      </div>
    );
  }

  const producoesFiltradas = producoesEmAberto.filter((producao) => {
    const nomeColaborador = producao.colaborador?.nome?.toLowerCase() || "";
    return nomeColaborador.includes(filtroNome.toLowerCase());
  });

  if (producoesFiltradas.length === 0 && filtroNome) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nome do colaborador..."
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              className="pl-9"
            />
            {filtroNome && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setFiltroNome("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Search className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-base font-medium text-foreground">
            Nenhuma atividade encontrada
          </p>
          <p className="text-sm text-muted-foreground">
            Tente buscar por outro nome
          </p>
          <Button
            variant="link"
            onClick={() => setFiltroNome("")}
            className="mt-2"
          >
            Limpar filtro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nome do colaborador..."
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              className="pl-9"
            />
            {filtroNome && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setFiltroNome("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {filtroNome && (
          <div className="text-sm text-muted-foreground">
            {producoesFiltradas.length} atividade{producoesFiltradas.length !== 1 ? 's' : ''} encontrada{producoesFiltradas.length !== 1 ? 's' : ''}
          </div>
        )}

        <div className="space-y-4">
          {Object.entries(
            producoesFiltradas.reduce((acc, producao) => {
              const loteId = producao.lote_id || 'avulso';
              if (!acc[loteId]) {
                acc[loteId] = {
                  lote: producao.lote,
                  atividades: []
                };
              }
              acc[loteId].atividades.push(producao);
              return acc;
            }, {} as Record<string, { lote: any, atividades: any[] }>)
          ).map(([loteId, group]: [string, { lote: any, atividades: any[] }]) => {
            const isOpen = !!openLotes[loteId] || !!filtroNome;
            const isAvulso = loteId === 'avulso';

            return (
              <Collapsible
                key={loteId}
                open={isOpen}
                onOpenChange={() => toggleLote(loteId)}
                className="border rounded-lg overflow-hidden bg-card text-card-foreground shadow-sm"
              >
                <CollapsibleTrigger className="w-full">
                  <div className="bg-muted/30 p-4 flex justify-between items-center hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <div className="text-left">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          {isAvulso ? (
                            <span className="flex items-center gap-2">
                              Atividades Avulsas
                            </span>
                          ) : (
                            <>
                              Lote {group.lote?.numero_lote || "N/A"}
                            </>
                          )}
                          <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary hover:bg-primary/20">
                            {group.atividades.length} {group.atividades.length === 1 ? 'colaborador' : 'colaboradores'}
                          </Badge>
                        </h3>
                        <p className="text-sm text-muted-foreground truncate max-w-[300px] sm:max-w-[500px]">
                          {isAvulso ? "Atividades diversas sem lote vinculado" : (group.lote?.nome_lote || "Lote sem nome")}
                        </p>
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="p-0 border-t">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-transparent hover:bg-transparent">
                          <TableHead>Colaborador</TableHead>
                          <TableHead>Etapa</TableHead>
                          <TableHead>Início</TableHead>
                          <TableHead>Tempo Decorrido</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.atividades.map((producao) => (
                          <TableRow key={producao.id}>
                            <TableCell className="font-medium">
                              {producao.colaborador?.nome || "N/A"}
                            </TableCell>
                            <TableCell>
                              {producao.atividade ? (
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-xs bg-muted/50">Avulsa</Badge>
                                  <span className="font-medium">{producao.atividade.nome}</span>
                                </div>
                              ) : (
                                <>
                                  {producao.etapa?.nome || "N/A"}
                                  {producao.subetapa && (
                                    <span className="text-xs text-muted-foreground block">
                                      → {producao.subetapa.nome}
                                    </span>
                                  )}
                                </>
                              )}
                            </TableCell>
                            <TableCell>
                              {formatarData(producao.data_inicio)}
                              <span className="text-xs text-muted-foreground block">
                                {producao.hora_inicio}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono font-semibold">
                                <Timer
                                  dataInicio={producao.data_inicio}
                                  horaInicio={producao.hora_inicio}
                                  segundosInicio={producao.segundos_inicio}
                                />
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-warning/20 text-warning">
                                Em Aberto
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => handleFinalizar(producao)}
                                variant="default"
                              >
                                <Check className="mr-1 h-4 w-4" />
                                Finalizar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>

      {producaoSelecionada && (
        <DialogFinalizarAtividade
          producao={producaoSelecionada}
          open={dialogAberto}
          onOpenChange={setDialogAberto}
        />
      )}
    </>
  );
}
