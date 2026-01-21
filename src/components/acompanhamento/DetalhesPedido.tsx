import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePrevisaoDetalhes, useImprevistos, useAjustes, useAtualizarStatus, useDeletarImprevisto } from "@/hooks/useAcompanhamentoPedidos";
import { useColaboradores } from "@/hooks/usePrevisaoProducao";
import { useProgressoProdutoResumo } from "@/hooks/useProgressoPedido";
import ContagemRegressiva from "./ContagemRegressiva";
import RegistrarImprevisto from "./RegistrarImprevisto";
import AjustarEquipe from "./AjustarEquipe";
import LotesProducaoPedido from "./LotesProducaoPedido";
import { formatarData, formatarTempoProdutivo } from "@/lib/timeUtils";
import { formatarCusto } from "@/lib/custoUtils";
import { Clock, Users, Package, AlertTriangle, History, CheckCircle2, XCircle, Trash2 } from "lucide-react";

interface DetalhesPedidoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previsaoId: string;
}

export default function DetalhesPedido({ open, onOpenChange, previsaoId }: DetalhesPedidoProps) {
  const { data: previsao } = usePrevisaoDetalhes(previsaoId);
  const { data: imprevistos } = useImprevistos(previsaoId);
  const { data: ajustes } = useAjustes(previsaoId);
  const { data: colaboradores } = useColaboradores();
  const { data: produtosResumo } = useProgressoProdutoResumo(previsaoId);
  const atualizarStatus = useAtualizarStatus();
  const deletarImprevisto = useDeletarImprevisto();

  const [dialogImprevisto, setDialogImprevisto] = useState(false);
  const [dialogEquipe, setDialogEquipe] = useState(false);

  // Agrupar produtos com métricas corretas
  const produtosComMetricas = useMemo(() => {
    if (!produtosResumo) return [];
    
    // Agrupar por produto (mesmo produto pode ter múltiplos lotes)
    const produtosMap = new Map();
    
    produtosResumo.forEach(p => {
      const key = p.produto_id;
      if (produtosMap.has(key)) {
        const existing = produtosMap.get(key);
        existing.quantidade_total += p.quantidade_total_lotes || 0;
        existing.horas_totais += p.horas_trabalhadas_total || 0;
      } else {
        produtosMap.set(key, {
          produto_id: p.produto_id,
          produto_nome: p.produto_nome,
          quantidade_total: p.quantidade_total_lotes || 0,
          horas_totais: p.horas_trabalhadas_total || 0,
          num_etapas: p.num_etapas || 0,
          percentual_geral: p.percentual_geral || 0,
        });
      }
    });
    
    return Array.from(produtosMap.values());
  }, [produtosResumo]);

  if (!previsao) return null;

  const horasTotais = previsao.horas_totais_previstas + (previsao.horas_ajustadas || 0);
  const progresso = previsao.progresso_real_horas > 0 
    ? Math.min((previsao.progresso_real_horas / horasTotais) * 100, 100)
    : 0;
  const horasRestantes = Math.max(horasTotais - previsao.progresso_real_horas, 0);
  const precisaHoraExtra = previsao.precisa_hora_extra || horasRestantes > (horasTotais * 0.3);

  const colaboradoresNomes = colaboradores?.filter(c => 
    previsao.colaboradores_ids.includes(c.id)
  ).map(c => c.nome) || [];

  const handleConcluir = () => {
    atualizarStatus.mutate({
      previsao_id: previsaoId,
      status: 'concluida',
    });
  };

  const handleCancelar = () => {
    atualizarStatus.mutate({
      previsao_id: previsaoId,
      status: 'cancelada',
    });
  };

  const handleDeletarImprevisto = (id: string, horas_perdidas: number) => {
    if (confirm("Deseja remover este imprevisto?")) {
      deletarImprevisto.mutate({ id, previsao_id: previsaoId, horas_perdidas });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl mb-2">{previsao.nome_pedido}</DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Entrega: {formatarData(previsao.data_entrega_desejada)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {previsao.status === 'em_andamento' && (
                  <>
                    <Button size="sm" onClick={handleConcluir} variant="outline" className="border-success text-success">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Concluir
                    </Button>
                    <Button size="sm" onClick={handleCancelar} variant="outline" className="border-destructive text-destructive">
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  </>
                )}
                {previsao.status === 'concluida' && (
                  <Badge className="bg-success">Concluída</Badge>
                )}
                {previsao.status === 'cancelada' && (
                  <Badge variant="secondary">Cancelada</Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="visao-geral" className="mt-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="lotes">Lotes e Produção</TabsTrigger>
            <TabsTrigger value="imprevistos">Imprevistos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

            <TabsContent value="visao-geral" className="space-y-6 mt-6">
              {previsao.status === 'em_andamento' && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <ContagemRegressiva dataEntrega={previsao.data_entrega_desejada} />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progresso Geral</span>
                    <span className="font-medium">{progresso.toFixed(1)}%</span>
                  </div>
                  <Progress value={progresso} className="h-3" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Tempo Previsto (Original)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {previsao.horas_totais_previstas > 0 ? (
                      <>
                        <p className="text-2xl font-bold">
                          {formatarTempoProdutivo(previsao.horas_totais_previstas * 60)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {previsao.dias_uteis_previstos} dias úteis
                        </p>
                      </>
                    ) : (
                      <Badge variant="secondary">Calculando...</Badge>
                    )}
                  </CardContent>
                </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Ajustes e Imprevistos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${previsao.horas_ajustadas > 0 ? 'text-destructive' : 'text-success'}`}>
                        {previsao.horas_ajustadas > 0 ? '+' : ''}
                        {formatarTempoProdutivo(previsao.horas_ajustadas * 60)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total Ajustado: {formatarTempoProdutivo(horasTotais * 60)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Tempo Real
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {formatarTempoProdutivo(previsao.progresso_real_horas * 60)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Faltam: {formatarTempoProdutivo(horasRestantes * 60)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {precisaHoraExtra && previsao.status === 'em_andamento' && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Atenção: Hora Extra Pode Ser Necessária</AlertTitle>
                    <AlertDescription>
                      Com o progresso atual, pode ser necessário hora extra para cumprir o prazo de entrega.
                      Considere ajustar a equipe ou revisar o cronograma.
                    </AlertDescription>
                  </Alert>
                )}

                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <AlertTitle className="text-blue-900 dark:text-blue-100">💡 Dicas para Este Pedido</AlertTitle>
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      {progresso < 30 && (
                        <li>Pedido em fase inicial - considere adicionar mais colaboradores se necessário</li>
                      )}
                      {horasRestantes > (horasTotais * 0.5) && (
                        <li>Mais de 50% do trabalho ainda pendente - monitore de perto o cronograma</li>
                      )}
                      {imprevistos && imprevistos.length > 0 && (
                        <li>Foram registrados {imprevistos.length} imprevisto(s) - revise os ajustes necessários</li>
                      )}
                      {progresso >= 30 && progresso < 70 && (
                        <li>Pedido em bom ritmo - mantenha a equipe focada nas prioridades</li>
                      )}
                      {progresso >= 70 && (
                        <li>Pedido próximo da conclusão - garanta qualidade nas etapas finais</li>
                      )}
                      <li>Acompanhe o progresso de cada etapa na aba "Lotes e Produção"</li>
                      <li>Registre imprevistos assim que ocorrerem para ajustes precisos</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            <TabsContent value="equipe" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Colaboradores do Pedido
                </h3>
                {previsao.status === 'em_andamento' && (
                  <Button onClick={() => setDialogEquipe(true)} size="sm">
                    Ajustar Equipe
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {colaboradoresNomes.map((nome) => (
                  <div key={nome} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-medium">{nome}</span>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="produtos" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Produtos no Pedido
                </h3>
              </div>

              <div className="space-y-3">
                {produtosComMetricas.length > 0 ? (
                  produtosComMetricas.map((produto) => (
                    <Card key={produto.produto_id}>
                      <CardHeader>
                        <CardTitle className="text-base">{produto.produto_nome}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Quantidade Total</p>
                              <p className="font-semibold">{produto.quantidade_total} unidades</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Tempo Trabalhado</p>
                              <p className="font-semibold text-primary">
                                {formatarTempoProdutivo(produto.horas_totais * 60)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Etapas</p>
                              <p className="font-semibold">{produto.num_etapas} etapa(s)</p>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Progresso</span>
                              <span className="font-medium">{produto.percentual_geral?.toFixed(1) || 0}%</span>
                            </div>
                            <Progress value={produto.percentual_geral || 0} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Alert>
                    <AlertDescription>
                      Nenhum produto encontrado para este pedido.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>

            <TabsContent value="lotes" className="space-y-4 mt-6">
              <LotesProducaoPedido previsaoId={previsaoId} />
            </TabsContent>

            <TabsContent value="imprevistos" className="space-y-4 mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Imprevistos Registrados
                </h3>
                {previsao.status === 'em_andamento' && (
                  <Button onClick={() => setDialogImprevisto(true)} size="sm">
                    Registrar Imprevisto
                  </Button>
                )}
              </div>

              {imprevistos && imprevistos.length > 0 ? (
                <div className="space-y-3">
                  {imprevistos.map((imprevisto: any) => (
                    <Card key={imprevisto.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground">
                              {formatarData(imprevisto.data_ocorrencia)}
                            </p>
                            <CardTitle className="text-base mt-1">
                              {imprevisto.tipo.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </CardTitle>
                          </div>
                          {previsao.status === 'em_andamento' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletarImprevisto(imprevisto.id, imprevisto.horas_perdidas)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm mb-2">{imprevisto.descricao}</p>
                        <Badge variant={imprevisto.horas_perdidas > 0 ? "destructive" : "default"} className={imprevisto.horas_perdidas < 0 ? "bg-success" : ""}>
                          Impacto: {imprevisto.horas_perdidas > 0 ? '+' : ''}
                          {formatarTempoProdutivo(imprevisto.horas_perdidas * 60)}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum imprevisto registrado
                </p>
              )}
            </TabsContent>

            <TabsContent value="historico" className="space-y-4 mt-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Ajustes
              </h3>

              {ajustes && ajustes.length > 0 ? (
                <div className="space-y-3">
                  {ajustes.map((ajuste: any) => (
                    <Card key={ajuste.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            {new Date(ajuste.data_ajuste).toLocaleString('pt-BR')}
                          </p>
                          <Badge variant={ajuste.impacto_horas > 0 ? "destructive" : "default"} className={ajuste.impacto_horas < 0 ? "bg-success" : ""}>
                            {ajuste.impacto_horas > 0 ? '+' : ''}
                            {formatarTempoProdutivo(ajuste.impacto_horas * 60)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="font-medium">
                          {ajuste.tipo_ajuste === 'add_colaborador' && '➕ Adicionou colaborador: '}
                          {ajuste.tipo_ajuste === 'remove_colaborador' && '➖ Removeu colaborador: '}
                          {ajuste.tipo_ajuste === 'ajuste_quantidade' && '📦 Ajustou quantidade: '}
                          {ajuste.detalhes?.colaborador_nome || ajuste.detalhes?.produto_nome}
                        </p>
                        {ajuste.tipo_ajuste === 'ajuste_quantidade' && (
                          <p className="text-sm text-muted-foreground">
                            {ajuste.detalhes.quantidade_antiga} → {ajuste.detalhes.quantidade_nova} unidades
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum ajuste registrado
                </p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <RegistrarImprevisto
        open={dialogImprevisto}
        onOpenChange={setDialogImprevisto}
        previsaoId={previsaoId}
      />

      <AjustarEquipe
        open={dialogEquipe}
        onOpenChange={setDialogEquipe}
        previsaoId={previsaoId}
        colaboradoresAtuais={previsao.colaboradores_ids}
      />
    </>
  );
}
