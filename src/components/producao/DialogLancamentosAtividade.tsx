import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, Edit2, Check, X, Clock, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  useLancarProducaoParcial,
  useHistoricoLancamentosLote,
  useAtualizarQuantidadeLancamento
} from "@/hooks/useProducaoStartStop";
import DialogFinalizarAtividade from "./DialogFinalizarAtividade";

interface DialogLancamentosAtividadeProps {
  producao: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DialogLancamentosAtividade({
  producao,
  open,
  onOpenChange,
}: DialogLancamentosAtividadeProps) {
  const [quantidadeParcial, setQuantidadeParcial] = useState("");
  const [editandoLancamentoId, setEditandoLancamentoId] = useState<string | null>(null);
  const [quantidadeEditada, setQuantidadeEditada] = useState("");
  const [dialogFinalizarAberto, setDialogFinalizarAberto] = useState(false);

  const lancarParcial = useLancarProducaoParcial();
  const atualizarQuantidade = useAtualizarQuantidadeLancamento();
  const { data: historico, isLoading } = useHistoricoLancamentosLote(open ? producao : null);

  useEffect(() => {
    if (open) {
      setQuantidadeParcial("");
      setEditandoLancamentoId(null);
    }
  }, [open, producao]);

  if (!producao) return null;

  const isTerceirizado = !!producao.terceirizado;
  const isPedido = !!producao.pedido_id;
  const isAtividadeGenerica = !!producao.atividade_id;
  const temLote = !!producao.lote_id;

  const handleSubmitLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtd = parseInt(quantidadeParcial);

    if (isNaN(qtd) || qtd <= 0) {
      toast.error("A quantidade deve ser maior que zero.");
      return;
    }

    const today = new Date();
    const dataFim = today.toISOString().split('T')[0];
    const horaFim = today.toTimeString().slice(0, 5);
    const segundosFim = today.getSeconds();

    lancarParcial.mutate(
      {
        producaoAtual: producao,
        quantidade_produzida: qtd,
        data_fim: dataFim,
        hora_fim: horaFim,
        segundos_fim: segundosFim,
      },
      {
        onSuccess: () => {
          setQuantidadeParcial("");
        }
      }
    );
  };

  const handleSalvarEdicao = (id: string) => {
    const qtd = parseInt(quantidadeEditada);
    if (isNaN(qtd) || qtd < 0) {
      toast.error("Quantidade inválida");
      return;
    }
    atualizarQuantidade.mutate({ id, quantidade_produzida: qtd }, {
      onSuccess: () => {
        setEditandoLancamentoId(null);
      }
    });
  };

  const formatarDataHora = (data: string, hora: string, seg: number) => {
    if (!data || !hora) return "N/A";
    const dataStr = new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
    return `${dataStr} às ${hora}${seg ? `:${String(seg).padStart(2, '0')}` : ''}`;
  };

  const totalLote = historico?.totalLote || 0;
  const totalEtapa = historico?.totalEtapa || 0;
  const saldoRestante = Math.max(0, totalLote - totalEtapa);
  
  const exibirSaldo = temLote && !isTerceirizado && !isAtividadeGenerica && totalLote > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lançamentos e Histórico</DialogTitle>
          <DialogDescription>
            Faça lançamentos parciais sem finalizar o expediente do colaborador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-muted p-4 rounded-lg text-sm grid grid-cols-2 gap-2">
             <div className="col-span-2 sm:col-span-1">
               <strong>Colaborador:</strong> {isTerceirizado ? producao.entidade?.nome : producao.colaborador?.nome || "N/A"}
             </div>
             {temLote && (
               <div className="col-span-2 sm:col-span-1">
                 <strong>Lote:</strong> {producao.lote?.numero_lote || "N/A"}
               </div>
             )}
             <div className="col-span-2 sm:col-span-1">
               <strong>Etapa:</strong> {producao.atividade ? producao.atividade.nome : (producao.etapa?.nome || "Pedido")}
             </div>
             {producao.subetapa && (
               <div className="col-span-2 sm:col-span-1">
                 <strong>Subetapa:</strong> {producao.subetapa.nome}
               </div>
             )}
          </div>

          {exibirSaldo && (
            <div className="flex gap-4 p-4 border rounded-lg bg-blue-50/50">
              <div className="flex-1">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Total do Lote</span>
                <p className="text-2xl font-bold text-blue-900">{totalLote}</p>
              </div>
              <div className="flex-1">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Produzido (Todos)</span>
                <p className="text-2xl font-bold text-green-700">{totalEtapa}</p>
              </div>
              <div className="flex-1">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Saldo Restante</span>
                <p className={`text-2xl font-bold ${saldoRestante > 0 ? "text-orange-600" : "text-gray-500"}`}>
                  {saldoRestante}
                </p>
              </div>
            </div>
          )}
          {!exibirSaldo && temLote && (
             <Alert className="bg-blue-50 text-blue-800 border-blue-200">
               <AlertCircle className="h-4 w-4" />
               <AlertDescription>
                 A quantidade total deste lote ainda não foi definida (será definida na última subetapa da Etapa 1 ao finalizar).
               </AlertDescription>
             </Alert>
          )}

          <form onSubmit={handleSubmitLancamento} className="flex gap-3 items-end bg-card p-4 border rounded-lg shadow-sm">
            <div className="flex-1 space-y-2">
              <Label htmlFor="quantidade_parcial">Informar Produção Parcial</Label>
              <Input
                id="quantidade_parcial"
                type="number"
                min="1"
                placeholder="Ex: 15"
                value={quantidadeParcial}
                onChange={(e) => setQuantidadeParcial(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={lancarParcial.isPending} className="bg-green-600 hover:bg-green-700">
              <Plus className="mr-2 h-4 w-4" />
              {lancarParcial.isPending ? "Lançando..." : "Lançar"}
            </Button>
          </form>

          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2 font-medium text-slate-800">
              <Clock className="h-4 w-4" />
              <span>Histórico desta Subetapa (Todos Colaboradores)</span>
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            ) : historico?.meusLancamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground bg-muted p-4 rounded-lg text-center">
                Nenhum lançamento feito ainda.
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left font-medium">Data/Hora</th>
                      <th className="p-2 text-left font-medium">Colaborador</th>
                      <th className="p-2 text-center font-medium">Quantidade</th>
                      <th className="p-2 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historico?.meusLancamentos.map((lanc: any) => (
                      <tr key={lanc.id} className="hover:bg-muted/50">
                        <td className="p-2 text-muted-foreground">
                          {formatarDataHora(lanc.data_fim, lanc.hora_fim, lanc.segundos_fim)}
                        </td>
                        <td className="p-2 text-muted-foreground">
                          {lanc.colaborador?.nome || producao.colaborador?.nome || "Desconhecido"}
                        </td>
                        <td className="p-2 text-center font-mono">
                          {editandoLancamentoId === lanc.id ? (
                            <Input
                              type="number"
                              min="0"
                              className="w-20 mx-auto h-8 text-center"
                              value={quantidadeEditada}
                              onChange={(e) => setQuantidadeEditada(e.target.value)}
                              autoFocus
                            />
                          ) : (
                            <Badge variant="outline" className="text-sm px-3">{lanc.quantidade_produzida}</Badge>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {editandoLancamentoId === lanc.id ? (
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleSalvarEdicao(lanc.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setEditandoLancamentoId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditandoLancamentoId(lanc.id);
                                setQuantidadeEditada(lanc.quantidade_produzida?.toString() || "");
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Separator />
          
          <div className="flex justify-between items-center bg-red-50/50 p-4 border border-red-100 rounded-lg">
             <div>
               <h4 className="font-semibold text-red-900">Encerrar Atividade</h4>
               <p className="text-xs text-red-700/80">Finaliza definitivamente o expediente nesta etapa.</p>
             </div>
             <Button variant="destructive" onClick={() => setDialogFinalizarAberto(true)}>
               Finalizar
             </Button>
          </div>
        </div>
      </DialogContent>

      {dialogFinalizarAberto && (
        <DialogFinalizarAtividade
          producao={producao}
          open={dialogFinalizarAberto}
          onOpenChange={(open) => {
            setDialogFinalizarAberto(open);
            if (!open) onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}
