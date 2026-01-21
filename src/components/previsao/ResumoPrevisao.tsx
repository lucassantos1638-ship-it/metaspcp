import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Calendar, Clock, DollarSign, TrendingUp } from "lucide-react";
import { formatarCusto } from "@/lib/custoUtils";

interface ResumoPrevisaoProps {
  resultado: any;
  dataEntrega: Date;
}

export default function ResumoPrevisao({
  resultado,
  dataEntrega,
}: ResumoPrevisaoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Resumo da Previsão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Tempo Total Estimado</span>
            </div>
            <span className="text-lg font-bold">
              {resultado.tempoTotalHoras.toFixed(1)}h
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Dias Úteis Necessários</span>
            </div>
            <span className="text-lg font-bold">
              {resultado.diasUteisNecessarios} dias
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Data Prevista de Conclusão</span>
            </div>
            <span className="text-lg font-bold">
              {resultado.dataPrevistaConclusao.toLocaleDateString("pt-BR")}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Custo Estimado</span>
            </div>
            <span className="text-lg font-bold">
              {formatarCusto(resultado.custoTotalGeral)}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-border space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Data de Entrega Solicitada:</span>
            <span className="ml-2 font-medium">
              {dataEntrega.toLocaleDateString("pt-BR")}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Dias Úteis Disponíveis:</span>
            <span className="ml-2 font-medium">{resultado.diasUteisDisponiveis} dias</span>
          </div>
        </div>

        {resultado.precisaHoraExtra && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Hora Extra Necessária</AlertTitle>
            <AlertDescription>
              Faltam {resultado.diasUteisNecessarios - resultado.diasUteisDisponiveis} dias úteis.
              Será necessário trabalhar {resultado.horasExtrasPorDia.toFixed(1)}h extras por dia
              ou adicionar mais colaboradores.
            </AlertDescription>
          </Alert>
        )}

        {!resultado.precisaHoraExtra && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <Calendar className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-600">Prazo Viável</AlertTitle>
            <AlertDescription className="text-green-600">
              É possível entregar no prazo solicitado com a equipe selecionada.
            </AlertDescription>
          </Alert>
        )}

        {resultado.temAlertaSemColaborador && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription>
              Algumas etapas não têm colaboradores selecionados com experiência.
              Verifique o detalhamento.
            </AlertDescription>
          </Alert>
        )}

        {resultado.temAlertaPoucosDados && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Dados Limitados</AlertTitle>
            <AlertDescription>
              Alguns colaboradores têm poucas produções registradas.
              A previsão pode ser imprecisa.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
