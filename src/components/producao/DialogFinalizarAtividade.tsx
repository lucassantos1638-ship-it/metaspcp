import { useState, useEffect } from "react";
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
import { AlertCircle } from "lucide-react";
import { useFinalizarProducao } from "@/hooks/useProducaoStartStop";

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
    }
  }, [open, producao]);

  const validarDataHora = () => {
    if (!producao) return false;

    const inicio = new Date(`${producao.data_inicio}T${producao.hora_inicio}:${producao.segundos_inicio || 0}`);
    const fim = new Date(`${dataFim}T${horaFim}:${segundosFim}`);

    if (fim <= inicio) {
      setErro("A data/hora de término deve ser posterior ao início");
      return false;
    }

    if (!quantidadeProduzida || parseInt(quantidadeProduzida) <= 0) {
      setErro("A quantidade produzida deve ser maior que zero");
      return false;
    }

    setErro("");
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validarDataHora()) return;

    finalizarProducao.mutate(
      {
        id: producao.id,
        data_fim: dataFim,
        hora_fim: horaFim,
        segundos_fim: parseInt(segundosFim),
        quantidade_produzida: parseInt(quantidadeProduzida),
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
      <DialogContent className="max-w-2xl">
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
              <div>
                <strong>Colaborador:</strong> {producao.colaborador?.nome || "N/A"}
              </div>
              <div>
                <strong>Lote:</strong> {producao.lote?.numero_lote || "N/A"}
              </div>
              <div>
                <strong>Etapa:</strong> {producao.etapa?.nome || "N/A"}
              </div>
              {producao.subetapa && (
                <div>
                  <strong>Subetapa:</strong> {producao.subetapa.nome}
                </div>
              )}
              <div className="col-span-2">
                <strong>Início:</strong> {formatarData(producao.data_inicio)} às{" "}
                {producao.hora_inicio}
                {producao.segundos_inicio > 0 && `:${producao.segundos_inicio}s`}
              </div>
            </div>
          </div>

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

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="quantidade">Quantidade Produzida *</Label>
              <Input
                type="number"
                id="quantidade"
                value={quantidadeProduzida}
                onChange={(e) => setQuantidadeProduzida(e.target.value)}
                min="1"
                required
              />
            </div>

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
