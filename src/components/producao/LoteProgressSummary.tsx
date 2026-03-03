import { useDetalhesLote } from "@/hooks/useDetalhesLote";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function LoteProgressSummary({
    loteId,
}: {
    loteId: string;
}) {
    const { data, isLoading } = useDetalhesLote(loteId);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 mt-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Calculando progresso...</span>
            </div>
        );
    }

    if (!data?.progressoPorEtapa || data.progressoPorEtapa.length === 0) {
        return null;
    }

    const quantidadeTotal = data.lote?.quantidade_total || data.lote?.quantidade || 0;

    return (
        <div className="mt-2 flex items-center">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 py-0 border-dashed text-muted-foreground hover:text-foreground">
                        <span className="font-semibold text-foreground mr-1">Total: {quantidadeTotal}</span>
                        Ver progresso <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                    <div className="space-y-2">
                        <h4 className="font-medium text-xs leading-none border-b pb-2 text-muted-foreground">
                            Progresso por Etapa
                        </h4>
                        <div className="flex flex-col gap-1.5 pt-1 max-h-[250px] overflow-y-auto pr-1">
                            {data.progressoPorEtapa.map((etapa) => {
                                const produzido = etapa.quantidade_produzida || 0;
                                const total = quantidadeTotal || 0;
                                const falta = Math.max(0, total - produzido);
                                const nome = etapa.subetapa_nome || etapa.etapa_nome;

                                return (
                                    <div
                                        key={`${etapa.etapa_id}-${etapa.subetapa_id}`}
                                        className="flex justify-between items-center text-xs border-b border-border/40 py-1.5 last:border-0 last:pb-0 gap-2"
                                    >
                                        <span className="font-medium text-foreground pr-1" title={nome}>
                                            {nome}
                                        </span>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <div className="text-green-600 font-medium px-1.5 bg-green-50 rounded w-[70px] flex justify-between">
                                                <span>P:</span><span className="tabular-nums">{produzido}</span>
                                            </div>
                                            <div className="text-orange-600 font-medium px-1.5 bg-orange-50 rounded w-[70px] flex justify-between">
                                                <span>F:</span><span className="tabular-nums">{falta}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
