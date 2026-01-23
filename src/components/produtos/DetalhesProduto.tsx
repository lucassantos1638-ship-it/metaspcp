import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, AlertTriangle, Trash2, Settings2, Pencil, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProdutoComMetricas, useToggleAtivoProduto, useExcluirProduto, useRemoverMaterialProduto } from "@/hooks/useProdutos";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatarCusto } from "@/lib/custoUtils";
import { formatarTempoProdutivo } from "@/lib/timeUtils";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import EditarEtapasProdutoDialog from "@/components/produtos/EditarEtapasProdutoDialog";
import EditarProdutoDialog from "@/components/produtos/EditarProdutoDialog";
import AdicionarMaterialProdutoDialog from "@/components/produtos/AdicionarMaterialProdutoDialog";

interface DetalhesProdutoProps {
  produtoId: string;
  onVoltar: () => void;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

export default function DetalhesProduto({
  produtoId,
  onVoltar,
}: DetalhesProdutoProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useProdutoComMetricas(produtoId);
  const toggleAtivo = useToggleAtivoProduto();
  const excluirProduto = useExcluirProduto();
  const removerMaterial = useRemoverMaterialProduto();
  const [dialogEtapasOpen, setDialogEtapasOpen] = useState(false);
  const [dialogPrecosOpen, setDialogPrecosOpen] = useState(false);
  const [dialogMateriaisOpen, setDialogMateriaisOpen] = useState(false);

  const handleExcluir = () => {
    excluirProduto.mutate(produtoId, {
      onSuccess: () => {
        onVoltar();
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onVoltar}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-32 bg-muted" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.produto) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onVoltar}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Alert variant="destructive">
          <AlertDescription>Produto não encontrado</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { produto, etapas, materiais, metricas, tempoTotalMedio, custoProducaoMedio, custoMaterialTotal, numLotesAnalisados } = data;

  // O custoTotalMedio do useProdutoComMetricas foi renomeado para custoProducaoMedio no hook
  // Se ainda estiver vindo como custoTotalMedio no type, considerar atualizar o tipo
  // Para garantir, vamos usar os valores desestruturados ou defaults
  const custoProd = custoProducaoMedio || 0;
  const custoMat = custoMaterialTotal || 0;
  const custoTotalGeral = custoProd + custoMat;

  // Dados para o gráfico de pizza
  const dadosGrafico = metricas.map((m: any) => ({
    name: m.subetapa_nome || m.etapa_nome,
    value: parseFloat(m.tempo_medio_por_peca_minutos?.toString() || "0"),
    custo: parseFloat(m.custo_medio_por_peca?.toString() || "0"),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onVoltar}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              toggleAtivo.mutate({ id: produto.id, ativo: !produto.ativo })
            }
          >
            {produto.ativo ? "Desativar" : "Ativar"}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    Tem certeza que deseja excluir o produto <strong>{produto.nome}</strong> (SKU: {produto.sku})?
                  </p>
                  <p className="text-sm">
                    Esta ação não pode ser desfeita. O produto só pode ser excluído se não houver lotes vinculados.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    💡 <strong>Dica:</strong> Se este produto não será mais usado, considere desativá-lo em vez de excluí-lo para preservar o histórico.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleExcluir}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir Produto
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Informações Gerais */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <code className="text-lg font-mono">{produto.sku}</code>
              </div>
              <CardTitle className="text-3xl">{produto.nome}</CardTitle>
              {produto.descricao && (
                <p className="text-muted-foreground">{produto.descricao}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={produto.ativo ? "default" : "secondary"} className="text-sm">
                {produto.ativo ? "Ativo" : "Inativo"}
              </Badge>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex flex-col items-end text-sm text-muted-foreground gap-1">
                  <div className="flex items-center gap-2">
                    <span>Custo Produção:</span>
                    <span>{formatarCusto(custoProd)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Custo Material:</span>
                    <span>{formatarCusto(custoMat)}</span>
                  </div>
                  <div className="flex items-center gap-2 font-bold text-foreground border-t border-border pt-1 mt-1">
                    <span>Custo Total:</span>
                    <span>{formatarCusto(custoTotalGeral)}</span>
                  </div>
                </div>

                <div className="h-12 w-px bg-border mx-2"></div>

                <div className="flex flex-col items-end text-sm text-muted-foreground gap-1">
                  <div>
                    <span className="font-semibold">CPF:</span> {formatarCusto(produto.preco_cpf || 0)}
                  </div>
                  <div>
                    <span className="font-semibold">CNPJ:</span> {formatarCusto(produto.preco_cnpj || 0)}
                  </div>
                  <div>
                    <span className="font-semibold">Estoque:</span> {Number(produto.estoque || 0).toLocaleString()}
                  </div>
                </div>

                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => setDialogPrecosOpen(true)} title="Editar Produto">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composição de Materiais */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold">Composição de Materiais</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setDialogMateriaisOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Material
            </Button>
          </CardHeader>
          <CardContent>
            {materiais?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Custo Un.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materiais.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{item.material?.nome}</span>
                          <span className="text-[10px] text-muted-foreground">{item.material?.codigo}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.material?.unidade_medida}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatarCusto(item.material?.preco_custo || 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatarCusto((item.material?.preco_custo || 0) * item.quantidade)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removerMaterial.mutate({ id: item.id, produtoId })}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3} className="text-right">Total Materiais:</TableCell>
                    <TableCell className="text-right">{formatarCusto(custoMat)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum material vinculado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composição de Etapas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold">Composição de Etapas</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setDialogEtapasOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Configurar Etapas
            </Button>
          </CardHeader>
          <CardContent>
            {etapas.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Ord</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Subetapa</TableHead>
                    <TableHead className="text-center">Obrig.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {etapas.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.ordem}</TableCell>
                      <TableCell>{e.etapa?.nome}</TableCell>
                      <TableCell>{e.subetapa?.nome || "-"}</TableCell>
                      <TableCell className="text-center">
                        {e.obrigatoria ? (
                          <Badge variant="default" className="text-[10px] px-1 h-5">Sim</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1 h-5">Não</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Settings2 className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhuma etapa cadastrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Métricas de Produção */}
      {metricas.length > 0 ? (
        <>
          {numLotesAnalisados < 3 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Métricas Limitadas</AlertTitle>
              <AlertDescription>
                Este produto possui apenas {numLotesAnalisados} lote(s) finalizado(s).
                As métricas se tornarão mais precisas com pelo menos 3 lotes.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Últimos Lotes Analisados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.ultimosLotes && data.ultimosLotes.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="py-2 h-8 text-xs">Lote</TableHead>
                          <TableHead className="py-2 h-8 text-xs text-right">Tempo/Pç</TableHead>
                          <TableHead className="py-2 h-8 text-xs text-right">Custo/Pç</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.ultimosLotes.map((l: any) => (
                          <TableRow
                            key={l.id}
                            className="border-b cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => navigate(`/lotes/${l.id}`)}
                          >
                            <TableCell className="py-2 text-xs">
                              <div className="flex flex-col">
                                <span className="font-medium text-blue-600">
                                  {l.numero_lote}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  {new Date(l.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right">
                              {formatarTempoProdutivo(l.tempo_por_peca || 0)}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right">
                              {formatarCusto(l.custo_por_peca || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Média Final */}
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell className="py-2 text-xs">Média</TableCell>
                          <TableCell className="py-2 text-xs text-right text-primary">
                            {formatarTempoProdutivo(tempoTotalMedio)}
                          </TableCell>
                          <TableCell className="py-2 text-xs text-right text-green-600">
                            {formatarCusto(custoProd)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-sm text-muted-foreground">Nenhum lote finalizado</div>
                  )}
                  {numLotesAnalisados > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      + {numLotesAnalisados - 3} outros lotes no histórico
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tempo Médio Produção</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatarTempoProdutivo(tempoTotalMedio)}
                </p>
                <p className="text-sm text-muted-foreground">por peça</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custos Unitários</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">Material</span>
                  <span className="text-2xl font-bold">{formatarCusto(custoMat)}</span>
                </div>
                <div className="flex flex-col border-t pt-2">
                  <span className="text-sm text-muted-foreground">Produção</span>
                  <span className="text-2xl font-bold">{formatarCusto(custoProd)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalhamento de Processos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Subetapa</TableHead>
                    <TableHead className="text-right">Tempo Médio/Peça</TableHead>
                    <TableHead className="text-right">Custo Médio/Peça</TableHead>
                    <TableHead className="text-right">% do Tempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metricas.map((m: any, idx: number) => {
                    const percTempo =
                      tempoTotalMedio > 0
                        ? ((m.tempo_medio_por_peca_minutos / tempoTotalMedio) * 100).toFixed(1)
                        : "0";

                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{m.etapa_nome}</TableCell>
                        <TableCell>{m.subetapa_nome || "-"}</TableCell>
                        <TableCell className="text-right">
                          {formatarTempoProdutivo(m.tempo_medio_por_peca_minutos || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatarCusto(m.custo_medio_por_peca || 0)}
                        </TableCell>
                        <TableCell className="text-right">{percTempo}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {dadosGrafico.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Distribuição do Tempo por Etapa</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dadosGrafico}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {dadosGrafico.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatarTempoProdutivo(value)}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Nenhuma métrica de produção disponível</p>
              <p className="text-sm text-muted-foreground">
                Finalize lotes para gerar o custo médio de produção.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <EditarEtapasProdutoDialog
        open={dialogEtapasOpen}
        onOpenChange={setDialogEtapasOpen}
        produtoId={produtoId}
        produtoNome={produto.nome}
      />

      <EditarProdutoDialog
        open={dialogPrecosOpen}
        onOpenChange={setDialogPrecosOpen}
        produtoId={produtoId}
        nomeAtual={produto.nome}
        descricaoAtual={produto.descricao}
        precoCpfAtual={produto.preco_cpf || 0}
        precoCnpjAtual={produto.preco_cnpj || 0}
        estoqueAtual={produto.estoque || 0}
      />

      <AdicionarMaterialProdutoDialog
        open={dialogMateriaisOpen}
        onOpenChange={setDialogMateriaisOpen}
        produtoId={produtoId}
      />
    </div>
  );
}
