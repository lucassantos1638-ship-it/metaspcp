import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ContagemRegressiva from "./ContagemRegressiva";
import { formatarData } from "@/lib/timeUtils";
import { Clock, TrendingUp } from "lucide-react";

interface CardPedidoProps {
  previsao: any;
  onVerDetalhes: () => void;
}

export default function CardPedido({ previsao, onVerDetalhes }: CardPedidoProps) {
  const horasTotais = previsao.horas_totais_previstas + (previsao.horas_ajustadas || 0);
  const progressoPercentual = horasTotais > 0
    ? Math.min((previsao.progresso_real_horas / horasTotais) * 100, 100)
    : 0;

  const horasRestantes = Math.max(horasTotais - previsao.progresso_real_horas, 0);

  const getStatusBadge = () => {
    if (previsao.status === 'concluida') {
      return <Badge variant="default" className="bg-success">Concluída</Badge>;
    }
    if (previsao.status === 'cancelada') {
      return <Badge variant="secondary">Cancelada</Badge>;
    }
    return <Badge variant="outline" className="border-primary text-primary">Em Andamento</Badge>;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{previsao.nome_pedido}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Entrega: {formatarData(previsao.data_entrega_desejada)}</span>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {previsao.status === 'em_andamento' && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <ContagemRegressiva dataEntrega={previsao.data_entrega_desejada} />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso Real</span>
            <span className="font-medium">{progressoPercentual.toFixed(0)}%</span>
          </div>
          <Progress value={progressoPercentual} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Trabalhadas: {previsao.progresso_real_horas.toFixed(1)}h</span>
            <span>Faltam: {horasRestantes.toFixed(1)}h</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Tempo Previsto</p>
            <p className="font-semibold">{previsao.horas_totais_previstas.toFixed(0)}h</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tempo Ajustado</p>
            <p className="font-semibold flex items-center gap-1">
              {horasTotais.toFixed(0)}h
              {previsao.horas_ajustadas !== 0 && (
                <span className={previsao.horas_ajustadas > 0 ? "text-destructive" : "text-success"}>
                  ({previsao.horas_ajustadas > 0 ? '+' : ''}{previsao.horas_ajustadas.toFixed(0)}h)
                </span>
              )}
            </p>
          </div>
        </div>

        {previsao.status === 'em_andamento' && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Tempo Real</p>
              <p className="font-semibold">{previsao.progresso_real_horas.toFixed(0)}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Restante</p>
              <p className="font-semibold">{horasRestantes.toFixed(0)}h</p>
            </div>
          </div>
        )}

        <Button onClick={onVerDetalhes} className="w-full" variant="outline">
          Ver Detalhes
        </Button>
      </CardContent>
    </Card>
  );
}
