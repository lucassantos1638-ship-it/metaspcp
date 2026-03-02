import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFinalizarProducao } from "@/hooks/useProducaoStartStop";
import { Switch } from "@/components/ui/switch";

interface DialogFinalizarAtividadeProps {
  producao: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DialogFinalizarAtividade({
  producao,
  open,
  onOpenChange,
}: DialogFinalizarAtividadeProps) {
  const [dataFim, setDataFim] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [horaFim, setHoraFim] = useState(new Date().toTimeString().slice(0, 5));
  const [segundosFim, setSegundosFim] = useState("0");
  const [quantidadeProduzida, setQuantidadeProduzida] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [semQuantidade, setSemQuantidade] = useState(false);

  const finalizarProducao = useFinalizarProducao();

  useEffect(() => {
    if (open && producao) {
      // Reset form quando abrir o dialog
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setDataFim(`${year}-${month}-${day}`);
      setHoraFim(new Date().toTimeString().slice(0, 5));
      setSegundosFim("0");
      setQuantidadeProduzida(producao.quantidade_produzida?.toString() || "");
      setObservacao("");
      setErro("");
      setSemQuantidade(false);
    }
  }, [open, producao]);

  // Buscar subetapas da etapa atual para verificar se é a última
  const { data: subetapasDaEtapa } = useQuery({
    queryKey: ["subetapas-verificacao", producao?.etapa_id],
    enabled: !!producao?.etapa_id && producao?.etapa?.ordem === 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_etapas")
        .select("subetapa_id, ordem")
        .eq("produto_id", producao?.lote?.produto_id)
        .eq("etapa_id", producao.etapa_id)
        .order("ordem");

      if (error) throw error;
      // Se não houver configuração específica no produto, buscar todas as subetapas genéricas
      if (!data || data.length === 0) {
        const { data: subGen, error: errSub } = await supabase
          .from("subetapas")
          .select("id, nome")
          .eq("etapa_id", producao.etapa_id)
          .order("nome"); // Ordem alfabética se não houver ordem definida? Ou criar campo ordem em subetapas?
        if (errSub) throw errSub;
        return subGen?.map(s => ({ subetapa_id: s.id, ordem: 0 })) || [];
      }
      return data;
    }
  });

  const isUltimaSubetapaEtapa1 = () => {
    if (!producao || !producao.etapa || producao.etapa.ordem !== 1) return false;

    // Se a etapa 1 não tem subetapas, então finalizar a etapa é finalizar tudo da etapa 1
    if (!subetapasDaEtapa || subetapasDaEtapa.length === 0) return true;

    // Se tem subetapas, verificar se a atual é a última
    const lastSub = subetapasDaEtapa[subetapasDaEtapa.length - 1];

    // Se a produção atual tem subetapa, comparar IDs
    if (producao.subetapa_id) {
      return producao.subetapa_id === lastSub.subetapa_id;
    }

    return false;
  };

  const isTerceirizado = !!producao?.terceirizado;
  const isAtividadeGenerica = !!producao?.atividade_id;
  const isPedido = !!producao?.pedido_id;

  // A quantidade deve ser exigida se:
  // 1. NÃO for atividade genérica e NÃO for pedido
  // 2. E (For a última subetapa da etapa 1 OU não for etapa 1)
  // Basicamente: Lotes precisam de quantidade. Atividades genéricas e Pedidos não.
  // E no caso de terceirização, a quantidade devolvida é obrigatória.
  const precisaDefinirQuantidadeLote = !isTerceirizado && !isAtividadeGenerica && !isPedido && isUltimaSubetapaEtapa1();
  const isEtapa1 = producao?.etapa?.ordem === 1;

  // Input visível se: For Terceirizada OU (NÃO for genérica E NÃO for pedido E (não for etapa 1 OU for o momento de definir a qtde do lote))
  const showQuantityInput = isTerceirizado || (!isAtividadeGenerica && !isPedido && (!isEtapa1 || precisaDefinirQuantidadeLote));

  const validarDataHora = () => {
    if (!producao) return false;

    const inicio = new Date(`${producao.data_inicio}T${producao.hora_inicio}:${producao.segundos_inicio || 0}`);
    const fim = new Date(`${dataFim}T${horaFim}:${segundosFim}`);

    if (fim <= inicio) {
      setErro("A data/hora de término deve ser posterior ao início");
      return false;
    }

    // A validação de quantidade só é necessária se o campo estiver visível
    if (showQuantityInput && !semQuantidade) {
      if (!quantidadeProduzida || parseInt(quantidadeProduzida) <= 0) {
        setErro(isTerceirizado ? "A quantidade devolvida deve ser maior que zero" : "A quantidade produzida deve ser maior que zero");
        return false;
      }
    }

    setErro("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validarDataHora()) return;

    // Se estiver visível, usa o valor. Se for genérica ou pedido ou oculto, usa 1 (para constar produção) ou 0?
    // Se for atividade genérica/pedido, não contabilizamos "unidades", então pode ser 1 para indicar "1 atividade feita".
    let qtd = 0;
    if (showQuantityInput && !semQuantidade && quantidadeProduzida) {
      qtd = parseInt(quantidadeProduzida);
    } else if (isAtividadeGenerica || isPedido) {
      qtd = 1;
    }

    // Se estiver no modo "Sem Quantidade", garantimos que é 0
    if (semQuantidade) {
      qtd = 0;
    }

    if (isTerceirizado) {
      const devolvidaTotal = (producao.quantidade_devolvida || 0) + qtd;
      const enviada = producao.quantidade_enviada || 0;
      const isFinalizado = devolvidaTotal >= enviada;

      finalizarProducao.mutate(
        {
          id: producao.id,
          data_fim: isFinalizado ? dataFim : null,
          hora_fim: isFinalizado ? horaFim : null,
          segundos_fim: isFinalizado ? parseInt(segundosFim) : null,
          quantidade_produzida: devolvidaTotal, // Preenchemos igual p/ controle
          quantidade_devolvida: devolvidaTotal,
          observacao: observacao || undefined,
          status: isFinalizado ? "finalizado" : "em_aberto",
        },
        {
          onSuccess: () => {
            onOpenChange(false);
            if (!isFinalizado) toast.success(`Pacote devolvido. Faltam ${enviada - devolvidaTotal} peças.`);
          },
        }
      );
    } else {
      // A atualização do lote e a propagação para etapas anteriores (backfill)
      // agora são tratadas automaticamente pelo Trigger 'handle_quantity_propagation' no banco de dados.
      submitFinalizacao(qtd);
    }
  };

  const submitFinalizacao = (qtd: number) => {
    finalizarProducao.mutate(
      {
        id: producao.id,
        data_fim: dataFim,
        hora_fim: horaFim,
        segundos_fim: parseInt(segundosFim),
        quantidade_produzida: qtd,
        observacao: observacao || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  }

  const formatarData = (data: string) => {
    return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
  };

  if (!producao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Atividade</DialogTitle>
          <DialogDescription>
            Preencha os dados de finalização da atividade
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informações da Abertura (Read-only) */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {isTerceirizado ? (
                <>
                  <div className="col-span-2 sm:col-span-1">
                    <strong>Terceirizado:</strong> {producao.entidade?.nome || "N/A"}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <strong>Lote:</strong> {producao.lote?.numero_lote || "N/A"}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <strong>Serviço:</strong> {producao.servico?.nome || "N/A"} - {producao.servico?.valor ? `R$ ${producao.servico.valor}` : ""}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="inline-flex items-center text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full text-xs font-medium">
                      Progresso: {producao.quantidade_devolvida || 0} / {producao.quantidade_enviada}
                    </span>
                  </div>
                </>
              ) : isPedido ? (
                <>
                  <div className="col-span-2 sm:col-span-1">
                    <strong>Colaborador:</strong> {producao.colaborador?.nome || "N/A"}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <strong>Etapa:</strong> Pedido
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <strong>Pedido:</strong> {producao.pedido?.numero ? `Nº ${producao.pedido.numero} - ` : ""}{producao.pedido?.entidade?.nome || "Cliente não informado"}
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-2 sm:col-span-1">
                    <strong>Colaborador:</strong> {producao.colaborador?.nome || "N/A"}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <strong>Lote:</strong> {producao.lote?.numero_lote || "N/A"}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <strong>Etapa:</strong> {producao.etapa?.nome || "Atividade Avulsa"}
                  </div>
                  {producao.subetapa && (
                    <div className="col-span-2 sm:col-span-1">
                      <strong>Subetapa:</strong> {producao.subetapa.nome}
                    </div>
                  )}
                </>
              )}
              <div className="col-span-2">
                <strong>{isTerceirizado ? "Enviado em" : "Início"}:</strong> {formatarData(producao.data_inicio)} às{" "}
                {producao.hora_inicio}
                {producao.segundos_inicio > 0 && `:${producao.segundos_inicio}s`}
              </div>
            </div>
          </div>

          {precisaDefinirQuantidadeLote && !semQuantidade && (
            <Alert className="bg-blue-50 text-blue-800 border-blue-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Esta é a finalização da Etapa 1. A quantidade informada abaixo será definida como a <strong>Quantidade Total do Lote</strong>.
              </AlertDescription>
            </Alert>
          )}

          {erro && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {/* Formulário de Fechamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data-fim">Data de Término *</Label>
              <Input
                type="date"
                id="data-fim"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora-fim">Hora de Término *</Label>
              <div className="flex gap-2">
                <Input
                  type="time"
                  id="hora-fim"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="flex-1"
                  required
                />
                <Input
                  type="number"
                  placeholder="Seg"
                  value={segundosFim}
                  onChange={(e) => setSegundosFim(e.target.value)}
                  min="0"
                  max="59"
                  className="w-20"
                />
              </div>
            </div>

            {showQuantityInput && (
              <div className="space-y-4 md:col-span-2">
                <div className="flex items-center space-x-2 border p-3 rounded-md bg-muted/20">
                  <Switch
                    id="sem-quantidade"
                    checked={!semQuantidade}
                    onCheckedChange={(c) => setSemQuantidade(!c)}
                  />
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="sem-quantidade" className="font-medium cursor-pointer">
                      Lançar Quantidade
                    </Label>
                  </div>
                </div>

                {!semQuantidade && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label htmlFor="quantidade">
                      {isTerceirizado ? "Quantidade Devolvida *" : precisaDefinirQuantidadeLote ? "Quantidade Real do Lote *" : "Quantidade Produzida *"}
                    </Label>
                    <Input
                      type="number"
                      id="quantidade"
                      value={quantidadeProduzida}
                      onChange={(e) => setQuantidadeProduzida(e.target.value)}
                      min="1"
                      required={!semQuantidade}
                      autoFocus
                    />
                    {precisaDefinirQuantidadeLote && (
                      <p className="text-xs text-muted-foreground">Isso definirá a quantidade para as próximas etapas.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Textarea
                id="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Adicione observações sobre esta produção..."
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {observacao.length}/500 caracteres
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={finalizarProducao.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={finalizarProducao.isPending}>
              {finalizarProducao.isPending ? "Finalizando..." : "Finalizar Atividade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
