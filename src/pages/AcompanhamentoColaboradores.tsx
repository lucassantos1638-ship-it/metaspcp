import { useEffect, useState } from "react";
import { differenceInSeconds, parseISO, isFuture } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Clock } from "lucide-react";
import { useAcompanhamentoColaboradores } from "@/hooks/useAcompanhamentoColaboradores";
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

    return <span className="font-mono text-md font-bold tabular-nums text-foreground">{display}</span>;
};

export default function AcompanhamentoColaboradores() {
    const { data: colaboradores, isLoading } = useAcompanhamentoColaboradores();

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Carregando status dos colaboradores...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">
                    Monitoramento de Equipe
                </h1>
                <p className="text-sm text-muted-foreground">
                    Visão geral da atividade dos colaboradores
                </p>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[300px]">Colaborador</TableHead>
                                <TableHead className="w-[140px]">Status</TableHead>
                                <TableHead>Atividade Atual</TableHead>
                                <TableHead className="w-[150px] text-right pr-6">Tempo</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {colaboradores?.map((colab) => {
                                const isActive = !!colab.atividadeAtual;
                                const isScheduled = isActive && isFuture(parseISO(`${colab.atividadeAtual!.data_inicio}T${colab.atividadeAtual!.hora_inicio}`));

                                return (
                                    <TableRow key={colab.id} className={!isActive ? "bg-muted/5 hover:bg-muted/10" : "hover:bg-muted/5"}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9 border border-border">
                                                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                                        {colab.nome.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium text-sm leading-none">{colab.nome}</p>

                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <Badge
                                                variant={isActive ? "default" : "secondary"}
                                                className={`text-[10px] px-2 py-0.5 h-5 font-semibold whitespace-nowrap ${!isActive
                                                    ? "bg-gray-100 text-gray-500 hover:bg-gray-200 border-gray-200"
                                                    : isScheduled
                                                        ? "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"
                                                        : "bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
                                                    }`}
                                            >
                                                {!isActive ? "PARADO" : isScheduled ? "AGENDADO" : "EM ATIVIDADE"}
                                            </Badge>
                                        </TableCell>

                                        <TableCell>
                                            {isActive && colab.atividadeAtual ? (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" className="h-5 text-[10px] font-mono border-primary/20 bg-primary/5 text-primary whitespace-nowrap">
                                                        {colab.atividadeAtual.lote.numero_lote}
                                                    </Badge>
                                                    <span className="text-sm font-medium truncate max-w-[150px]" title={colab.atividadeAtual.lote.nome_lote}>
                                                        {colab.atividadeAtual.lote.nome_lote}
                                                    </span>
                                                    <span className="text-muted-foreground/30 mx-1">|</span>
                                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                        <span className="font-medium text-foreground/80">{colab.atividadeAtual.etapa.nome}</span>
                                                        {colab.atividadeAtual.subetapa && (
                                                            <>
                                                                <span className="text-muted-foreground/40">/</span>
                                                                <span>{colab.atividadeAtual.subetapa.nome}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic flex items-center gap-1.5 opacity-60">
                                                    <Clock className="h-3 w-3" />
                                                    Aguardando início...
                                                </span>
                                            )}
                                        </TableCell>

                                        <TableCell className="text-right pr-6">
                                            {isActive && colab.atividadeAtual && (
                                                <div className="inline-flex items-center justify-end font-mono bg-muted/20 px-2 py-1 rounded-md min-w-[80px]">
                                                    <Clock className="h-3 w-3 mr-2 text-muted-foreground" />
                                                    <Timer
                                                        dataInicio={colab.atividadeAtual.data_inicio}
                                                        horaInicio={colab.atividadeAtual.hora_inicio}
                                                        segundosInicio={colab.atividadeAtual.segundos_inicio}
                                                    />
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

