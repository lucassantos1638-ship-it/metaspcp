import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useColaboradores } from "@/hooks/usePrevisaoProducao";
import { useAjustarColaboradores } from "@/hooks/useAcompanhamentoPedidos";
import { UserPlus, UserMinus } from "lucide-react";

interface AjustarEquipeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previsaoId: string;
  colaboradoresAtuais: string[];
}

export default function AjustarEquipe({ open, onOpenChange, previsaoId, colaboradoresAtuais }: AjustarEquipeProps) {
  const { data: colaboradores } = useColaboradores();
  const [colaboradoresSelecionados, setColaboradoresSelecionados] = useState<string[]>(colaboradoresAtuais);
  const ajustarColaboradores = useAjustarColaboradores();

  const toggleColaborador = (id: string) => {
    setColaboradoresSelecionados((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  const handleSalvar = () => {
    const adicionados = colaboradoresSelecionados.filter((id) => !colaboradoresAtuais.includes(id));
    const removidos = colaboradoresAtuais.filter((id) => !colaboradoresSelecionados.includes(id));

    if (adicionados.length === 0 && removidos.length === 0) {
      onOpenChange(false);
      return;
    }

    const colaboradorAfetado = adicionados[0] || removidos[0];
    const colaboradorObj = colaboradores?.find((c) => c.id === colaboradorAfetado);
    const tipoAjuste = adicionados.length > 0 ? 'add' : 'remove';

    if (!colaboradorObj) return;

    ajustarColaboradores.mutate(
      {
        previsao_id: previsaoId,
        colaboradores_ids_novos: colaboradoresSelecionados,
        tipo_ajuste: tipoAjuste,
        colaborador_afetado_id: colaboradorAfetado,
        colaborador_afetado_nome: colaboradorObj.nome,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Equipe</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Selecione os colaboradores que farão parte desta previsão
          </p>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {colaboradores?.map((colaborador) => {
              const isSelected = colaboradoresSelecionados.includes(colaborador.id);
              const isOriginal = colaboradoresAtuais.includes(colaborador.id);

              return (
                <div
                  key={colaborador.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={colaborador.id}
                    checked={isSelected}
                    onCheckedChange={() => toggleColaborador(colaborador.id)}
                  />
                  <Label
                    htmlFor={colaborador.id}
                    className="flex-1 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{colaborador.nome}</p>
                      {colaborador.funcao && (
                        <p className="text-xs text-muted-foreground">{colaborador.funcao}</p>
                      )}
                    </div>
                    {!isOriginal && isSelected && (
                      <UserPlus className="h-4 w-4 text-success" />
                    )}
                    {isOriginal && !isSelected && (
                      <UserMinus className="h-4 w-4 text-destructive" />
                    )}
                  </Label>
                </div>
              );
            })}
          </div>

          {colaboradoresSelecionados.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="font-medium">
                {colaboradoresSelecionados.length} colaborador(es) selecionado(s)
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={ajustarColaboradores.isPending}>
            {ajustarColaboradores.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
