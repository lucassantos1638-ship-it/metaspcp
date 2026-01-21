import { useLotesDoPedido, useProgressoProdutoDetalhado, useProgressoProdutoResumo } from "@/hooks/useProgressoPedido";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface LotesProducaoPedidoProps {
  previsaoId: string;
}

export default function LotesProducaoPedido({ previsaoId }: LotesProducaoPedidoProps) {
  const { data: lotes, isLoading: loadingLotes } = useLotesDoPedido(previsaoId);
  const { data: progressoResumo } = useProgressoProdutoResumo(previsaoId);
  const { data: progressoDetalhado } = useProgressoProdutoDetalhado(previsaoId);

  // Agrupar etapas por produto
  const progressoPorProduto = progressoDetalhado?.reduce((acc, item) => {
    if (!acc[item.produto_id]) {
      acc[item.produto_id] = [];
    }
    acc[item.produto_id].push(item);
    return acc;
  }, {} as Record<string, typeof progressoDetalhado>);

  if (loadingLotes) {
    return <div className="flex items-center justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Resumo de Progresso por Produto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Progresso por Produto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {progressoResumo && progressoResumo.length > 0 ? (
            progressoResumo.map((produto) => (
              <div key={produto.produto_id} className="space-y-4 p-4 border rounded-lg bg-card">
                {/* Cabeçalho do Produto */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">{produto.produto_nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {produto.quantidade_total_lotes} unidades totais
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">
                      {produto.percentual_geral}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Number(produto.horas_trabalhadas_total).toFixed(1)}h totais
                    </p>
                  </div>
                </div>

                {/* Barra de Progresso Geral */}
                <div className="space-y-1">
                  <p className="text-sm font-medium">Progresso Geral</p>
                  <Progress 
                    value={Number(produto.percentual_geral)} 
                    className="h-4"
                  />
                </div>

                {/* Progresso por Etapa */}
                <div className="space-y-3 mt-4 pl-4 border-l-2 border-primary/20">
                  <p className="text-sm font-medium text-muted-foreground">
                    Detalhamento por Etapa
                  </p>
                  {progressoPorProduto?.[produto.produto_id]?.map((etapa) => (
                    <div key={etapa.etapa_id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            Number(etapa.percentual_etapa) === 100 
                              ? "bg-green-500" 
                              : Number(etapa.percentual_etapa) > 0 
                              ? "bg-blue-500" 
                              : "bg-gray-300"
                          )} />
                          <span className="text-sm font-medium">{etapa.etapa_nome}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            ⏱️ {Number(etapa.horas_trabalhadas_etapa).toFixed(1)}h
                          </span>
                          <span className="text-sm">
                            {etapa.quantidade_produzida_etapa}/{etapa.quantidade_total_lotes}
                          </span>
                          <span className="text-sm font-semibold text-primary min-w-[45px] text-right">
                            {Number(etapa.percentual_etapa).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <Progress 
                        value={Number(etapa.percentual_etapa)} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma produção registrada ainda
            </p>
          )}
        </CardContent>
      </Card>

      {/* Lista de Lotes Vinculados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Lotes Vinculados ao Pedido ({lotes?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lotes && lotes.length > 0 ? (
            <div className="space-y-4">
              {lotes.map((lote) => (
                <Card key={lote.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">#{lote.numero_lote}</p>
                          <Badge variant={lote.finalizado ? "default" : "secondary"}>
                            {lote.finalizado ? "Finalizado" : "Em Andamento"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{lote.nome_lote}</p>
                        {lote.produto && (
                          <p className="text-xs text-muted-foreground">
                            Produto: {lote.produto.nome}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{lote.quantidade_total}</p>
                        <p className="text-xs text-muted-foreground">unidades</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Criado em {format(new Date(lote.created_at), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <Package className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <div>
                <p className="text-muted-foreground mb-2">
                  Nenhum lote vinculado a este pedido ainda
                </p>
                <p className="text-sm text-muted-foreground">
                  Crie um novo lote e vincule-o a este pedido para acompanhar o progresso automaticamente
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
