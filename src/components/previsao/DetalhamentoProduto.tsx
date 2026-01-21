import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Clock, DollarSign } from "lucide-react";
import { formatarCusto } from "@/lib/custoUtils";

interface DetalhamentoProdutoProps {
  resultados: any[];
}

export default function DetalhamentoProduto({
  resultados,
}: DetalhamentoProdutoProps) {
  return (
    <Accordion type="multiple" className="w-full">
      {resultados.map((resultado, idx) => (
        <AccordionItem key={idx} value={`produto-${idx}`}>
          <AccordionTrigger className="hover:no-underline">
            <div className="flex flex-col items-start gap-1 text-left">
              <span className="font-semibold">
                {resultado.produto_nome}
              </span>
              <span className="text-sm text-muted-foreground">
                {resultado.quantidade} unidades
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Tempo Total</div>
                  <div className="font-semibold">
                    {(resultado.tempoTotalMinutos / 60).toFixed(1)}h
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Custo Total</div>
                  <div className="font-semibold">
                    {formatarCusto(resultado.custoTotal)}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Etapas do Produto</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Colaboradores</TableHead>
                    <TableHead className="text-right">Tempo</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.etapas.map((etapa: any, etapaIdx: number) => (
                    <TableRow key={etapaIdx}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{etapa.etapa.etapa.nome}</div>
                          {etapa.etapa.subetapa && (
                            <div className="text-sm text-muted-foreground">
                              {etapa.etapa.subetapa.nome}
                            </div>
                          )}
                          {etapa.alertaSemColaborador && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertTriangle className="h-3 w-3" />
                              <AlertDescription className="text-xs">
                                Nenhum colaborador selecionado
                              </AlertDescription>
                            </Alert>
                          )}
                          {etapa.alertaPoucosDados && (
                            <Alert className="mt-2">
                              <AlertTriangle className="h-3 w-3" />
                              <AlertDescription className="text-xs">
                                Poucos dados históricos
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {etapa.colaboradores.length > 0 ? (
                          <div className="text-sm">
                            {etapa.colaboradores.map((c: any, i: number) => (
                              <div key={i}>
                                {c.colaborador_nome}
                                <span className="text-muted-foreground ml-1">
                                  ({c.tempo_medio_por_peca_minutos.toFixed(1)}min/pç)
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {etapa.tempoHoras.toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right">
                        {formatarCusto(etapa.custoTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
