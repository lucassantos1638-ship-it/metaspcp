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

  // Determina se a etapa atual é a PRIMEIRA etapa do produto
  const { data: isEtapa1 } = useQuery({
    queryKey: ["is-primeira-etapa", producao?.etapa_id, producao?.lote?.produto_id],
    enabled: !!producao?.lote?.produto_id && !!producao?.etapa_id && !producao.atividade_id && !producao.pedido_id && !producao.terceirizado,
    queryFn: async () => {
      // 1. Tentar achar o roteiro específico do produto
      const { data: roteiro } = await supabase
        .from("produto_etapas")
        .select("etapa_id")
        .eq("produto_id", producao.lote.produto_id)
        .order("ordem")
        .limit(1);

      if (roteiro && roteiro.length > 0) {
        return roteiro[0].etapa_id === producao.etapa_id;
      }

      // 2. Se não tiver roteiro, fallback pra primeira etapa global
      const { data: etapaGlobal } = await supabase
        .from("etapas")
        .select("id")
        .eq("empresa_id", producao.empresa_id)
        .order("ordem")
        .limit(1);

      if (etapaGlobal && etapaGlobal.length > 0) {
        return etapaGlobal[0].id === producao.etapa_id;
      }

      return false;
    }
  });

  // Buscar subetapas da etapa atual para verificar se é a última
  const { data: subetapasDaEtapa } = useQuery({
    queryKey: ["subetapas-verificacao", producao?.etapa_id, producao?.lote?.produto_id],
    enabled: !!producao?.etapa_id && !!isEtapa1, // Só buscar se for a etapa 1 verdadeira do produto
    queryFn: async () => {
      // Usar a mesma ordem do roteiro do produto se ele tiver um!
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
          .eq("empresa_id", producao.empresa_id)
          .order("nome");
        if (errSub) throw errSub;
        return subGen?.map(s => ({ subetapa_id: s.id, ordem: 0 })) || [];
      }
      return data;
    }
  });

  const isUltimaSubetapaEtapa1 = () => {
    if (!producao || !producao.etapa || !isEtapa1) return false;

    // Se a etapa 1 não tem subetapas cadastradas, então finalizar a etapa já finaliza tudo da etapa 1
    if (!subetapasDaEtapa || subetapasDaEtapa.length === 0) return true;

    // Verifica se a atual é a última
    const lastSub = subetapasDaEtapa[subetapasDaEtapa.length - 1];

    if (producao.subetapa_id) {
      // Quando vem de produto_etapas tem subetapa_id, quando vem de subetapas não
      const lastId = lastSub.subetapa_id || lastSub.id;
      return producao.subetapa_id === lastId;
    }

    // Se a produção atual não tem subetapa definida (mas a etapa tem), e o usuário
    // está finalizando, vamos assumir que ele está finalizando a etapa genérica inteira
    return true;
  };

  const isTerceirizado = !!producao?.terceirizado;
  const isAtividadeGenerica = !!producao?.atividade_id;
  const isPedido = !!producao?.pedido_id;

  // A quantidade deve ser exigida para definir o lote se:
  // 1. NÃO for atividade genérica e NÃO for pedido
  // 2. For a etapa 1 E for a última subetapa da etapa 1
  const precisaDefinirQuantidadeLote = !isTerceirizado && !isAtividadeGenerica && !isPedido && isEtapa1 && isUltimaSubetapaEtapa1();

  // Input visível APENAS se for terceirizado ou for a etapa 1 definindo o lote. As demais etapas usam o lançamento parcial.
  const showQuantityInput = isTerceirizado || precisaDefinirQuantidadeLote;

  const validarDataHora = () => {
    if (!producao) return false;

    const inicio = new Date(`${producao.data_inicio}T${producao.hora_inicio}:${producao.segundos_inicio || 0}`);
    const fim = new Date(`${dataFim}T${horaFim}:${segundosFim}`);

    if (fim <= inicio) {
      setErro("A data/hora de término deve ser posterior ao início");
      return false;
    }

    setErro("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validarDataHora()) return;

    // Como os lançamentos agora são feitos na tela anterior, na finalização a quantidade enviada na atividade em si é 0
    let qtd = 0;

    if (isTerceirizado) {
      const devolvidaTotal = producao.quantidade_devolvida || 0;
      const enviada = producao.quantidade_enviada || 0;
      const isFinalizado = devolvidaTotal >= enviada;

      finalizarProducao.mutate(
        {
          id: producao.id,
          data_fim: isFinalizado ? dataFim : null,
          hora_fim: isFinalizado ? horaFim : null,
          segundos_fim: isFinalizado ? parseInt(segundosFim) : null,
          quantidade_produzida: devolvidaTotal,
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
      submitFinalizacao(precisaDefinirQuantidadeLote);
    }
  };

  const submitFinalizacao = async (isLastSubetapa1: boolean = false) => {
    let qtdParaLote = 0;

    if (isLastSubetapa1) {
      try {
        qtdParaLote = parseInt(quantidadeProduzida) || 0;
        
        console.log("QTD calculada da finalizacao para atualizar o lote:", qtdParaLote);

        if (qtdParaLote > 0) {
          const { error: errLote } = await supabase
            .from("lotes")
            .update({ quantidade_total: qtdParaLote })
            .eq("id", producao.lote_id);
            
          if (errLote) console.error("Erro RLS Lote:", errLote);
          
          // Regra da Primeira Etapa: Preenche as subetapas e demais itens que pertencem a mesma etapa 1 do lote
          const { error: errProdOutras } = await supabase
            .from("producoes")
            .update({ quantidade_produzida: qtdParaLote })
            .eq("lote_id", producao.lote_id)
            .eq("etapa_id", producao.etapa_id)
            .neq("id", producao.id);
        }
      } catch (err) {
        console.error("Erro fatal de fallback ao atualizar quantidades do lote:", err);
      }
    }

    finalizarProducao.mutate(
      {
        id: producao.id,
        data_fim: dataFim,
        hora_fim: horaFim,
        segundos_fim: parseInt(segundosFim),
        quantidade_produzida: isLastSubetapa1 ? qtdParaLote : 0, // A quantidade real já foi lançada nos parciais, exceto se for a última subetapa da etapa 1
        observacao: observacao || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

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
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="quantidade">
                  {isTerceirizado ? "Quantidade Devolvida *" : "Quantidade Produzida *"}
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    id="quantidade"
                    value={quantidadeProduzida}
                    onChange={(e) => setQuantidadeProduzida(e.target.value)}
                    min="1"
                    required={!semQuantidade}
                    disabled={semQuantidade}
                    className="w-1/2"
                  />
                  {!isTerceirizado && (
                    <div className="flex items-center space-x-2 whitespace-nowrap">
                      <Switch
                        id="sem-quantidade"
                        checked={semQuantidade}
                        onCheckedChange={(checked) => {
                          setSemQuantidade(checked);
                          if (checked) setQuantidadeProduzida("");
                        }}
                      />
                      <Label htmlFor="sem-quantidade" className="cursor-pointer">Sem Quantidade</Label>
                    </div>
                  )}
                </div>
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
