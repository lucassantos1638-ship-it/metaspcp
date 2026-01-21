import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRegistrarImprevisto } from "@/hooks/useAcompanhamentoPedidos";

interface RegistrarImprevistoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previsaoId: string;
}

const TIPOS_IMPREVISTO = [
  { value: "atraso_colaborador", label: "Atraso/Falta de Colaborador" },
  { value: "quebra_maquina", label: "Quebra de Máquina" },
  { value: "problema_material", label: "Problema com Material" },
  { value: "adicao_recurso", label: "Adição de Recurso (Positivo)" },
  { value: "outro", label: "Outro" },
];

export default function RegistrarImprevisto({ open, onOpenChange, previsaoId }: RegistrarImprevistoProps) {
  const [tipo, setTipo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [horasPerdidas, setHorasPerdidas] = useState("");
  const [dataOcorrencia, setDataOcorrencia] = useState(new Date().toISOString().split('T')[0]);

  const registrarImprevisto = useRegistrarImprevisto();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!tipo || !descricao || !horasPerdidas) {
      return;
    }

    registrarImprevisto.mutate(
      {
        previsao_id: previsaoId,
        tipo,
        descricao,
        horas_perdidas: parseFloat(horasPerdidas),
        data_ocorrencia: dataOcorrencia,
      },
      {
        onSuccess: () => {
          setTipo("");
          setDescricao("");
          setHorasPerdidas("");
          setDataOcorrencia(new Date().toISOString().split('T')[0]);
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Imprevisto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Imprevisto</Label>
            <Select value={tipo} onValueChange={setTipo} required>
              <SelectTrigger id="tipo">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_IMPREVISTO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o que aconteceu..."
              required
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="horas">Impacto em Horas</Label>
            <Input
              id="horas"
              type="number"
              step="0.5"
              value={horasPerdidas}
              onChange={(e) => setHorasPerdidas(e.target.value)}
              placeholder="Ex: 18 para atraso, -15 para ganho"
              required
            />
            <p className="text-xs text-muted-foreground">
              Use valores positivos para atrasos (ex: 18) e negativos para ganhos (ex: -15)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Data da Ocorrência</Label>
            <Input
              id="data"
              type="date"
              value={dataOcorrencia}
              onChange={(e) => setDataOcorrencia(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={registrarImprevisto.isPending}>
              {registrarImprevisto.isPending ? "Registrando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
