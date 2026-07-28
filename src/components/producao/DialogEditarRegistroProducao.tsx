import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmpresaId } from "@/hooks/useEmpresaId";

interface DialogEditarRegistroProducaoProps {
  registro: any;
  produtoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DialogEditarRegistroProducao({
  registro,
  produtoId,
  open,
  onOpenChange,
}: DialogEditarRegistroProducaoProps) {
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();

  const [colaboradorId, setColaboradorId] = useState<string>("");
  const [subetapaId, setSubetapaId] = useState<string>("none");
  const [quantidade, setQuantidade] = useState<number>(0);
  const [minutosNormais, setMinutosNormais] = useState<number>(0);
  const [minutosExtras, setMinutosExtras] = useState<number>(0);
  const [dataInicio, setDataInicio] = useState<string>("");
  const [horaInicio, setHoraInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [horaFim, setHoraFim] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && registro) {
      setColaboradorId(registro.colaborador_id || "");
      setSubetapaId(registro.subetapa_id || "none");
      setQuantidade(Number(registro.quantidade) || 0);
      setMinutosNormais(Number(registro.minutos_normais) || 0);
      setMinutosExtras(Number(registro.minutos_extras) || 0);
      setDataInicio(registro.data_inicio || "");
      setHoraInicio(registro.hora_inicio || "");
      setDataFim(registro.data_fim || "");
      setHoraFim(registro.hora_fim || "");
    }
  }, [open, registro]);

  const handleTimeChange = (field: 'dataInicio' | 'horaInicio' | 'dataFim' | 'horaFim', value: string) => {
    let newDI = dataInicio;
    let newHI = horaInicio;
    let newDF = dataFim;
    let newHF = horaFim;

    if (field === 'dataInicio') newDI = value;
    if (field === 'horaInicio') newHI = value;
    if (field === 'dataFim') newDF = value;
    if (field === 'horaFim') newHF = value;

    if (field === 'dataInicio') setDataInicio(value);
    if (field === 'horaInicio') setHoraInicio(value);
    if (field === 'dataFim') setDataFim(value);
    if (field === 'horaFim') setHoraFim(value);

    if (newDI && newHI && newDF && newHF) {
      const inicio = new Date(`${newDI}T${newHI}`);
      const fim = new Date(`${newDF}T${newHF}`);
      if (fim > inicio) {
        const diffMs = fim.getTime() - inicio.getTime();
        setMinutosNormais(Math.floor(diffMs / 60000));
      }
    }
  };

  // Buscar colaboradores
  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Buscar subetapas válidas para esta etapa e produto
  const { data: subetapas } = useQuery({
    queryKey: ["subetapas-edicao", empresaId, produtoId, registro?.etapa_id],
    enabled: !!empresaId && !!registro?.etapa_id && open,
    queryFn: async () => {
      // Tentar pegar do roteiro do produto primeiro
      if (produtoId) {
        const { data: roteiro, error } = await supabase
          .from("produto_etapas")
          .select("subetapa_id, subetapas(id, nome)")
          .eq("produto_id", produtoId)
          .eq("etapa_id", registro.etapa_id);
          
        if (error) throw error;
        
        if (roteiro && roteiro.length > 0 && roteiro.some(r => r.subetapa_id !== null)) {
          return roteiro
            .filter(r => r.subetapas)
            .map(r => ({
              id: r.subetapas!.id,
              nome: r.subetapas!.nome
            }));
        }
      }
      
      // Fallback: todas as subetapas daquela etapa
      const { data: subGeral, error: errSub } = await supabase
        .from("subetapas")
        .select("id, nome")
        .eq("etapa_id", registro.etapa_id)
        .eq("empresa_id", empresaId)
        .order("nome");
        
      if (errSub) throw errSub;
      return subGeral;
    },
  });

  const handleSave = async () => {
    if (!registro || !registro.id) return;
    
    setIsSaving(true);
    
    const { error } = await supabase
      .from("producoes")
      .update({
        colaborador_id: colaboradorId || null,
        subetapa_id: subetapaId === "none" ? null : subetapaId,
        quantidade_produzida: quantidade,
        minutos_normais: minutosNormais,
        minutos_extras: minutosExtras,
        data_inicio: dataInicio || null,
        hora_inicio: horaInicio || null,
        data_fim: dataFim || null,
        hora_fim: horaFim || null
      })
      .eq("id", registro.id);
      
    setIsSaving(false);
      
    if (error) {
      console.error(error);
      toast.error("Erro ao atualizar registro de produção.");
    } else {
      toast.success("Registro atualizado com sucesso!");
      onOpenChange(false);
      // Invalida o cache da aba de detalhes do lote
      queryClient.invalidateQueries({ queryKey: ["detalhes_lote"] });
      // Invalida outros históricos para garantir sincronia
      queryClient.invalidateQueries({ queryKey: ["historico_lancamentos"] });
    }
  };

  if (!registro) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lançamento de Produção</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="colaborador">Colaborador</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger id="colaborador">
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {colaboradores?.map((colab) => (
                  <SelectItem key={colab.id} value={colab.id}>
                    {colab.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="subetapa">Subetapa</Label>
            <Select value={subetapaId} onValueChange={setSubetapaId}>
              <SelectTrigger id="subetapa">
                <SelectValue placeholder="Selecione a subetapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Processo Geral / Nenhuma</SelectItem>
                {subetapas?.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_inicio">Data Início</Label>
              <Input
                id="data_inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => handleTimeChange('dataInicio', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hora_inicio">Hora Início</Label>
              <Input
                id="hora_inicio"
                type="time"
                value={horaInicio}
                onChange={(e) => handleTimeChange('horaInicio', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_fim">Data Fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={dataFim}
                onChange={(e) => handleTimeChange('dataFim', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hora_fim">Hora Fim</Label>
              <Input
                id="hora_fim"
                type="time"
                value={horaFim}
                onChange={(e) => handleTimeChange('horaFim', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quantidade">Quant. Produzida</Label>
              <Input
                id="quantidade"
                type="number"
                min="0"
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="minutos_normais">Min. Normais (Calculado)</Label>
              <Input
                id="minutos_normais"
                type="number"
                min="0"
                value={minutosNormais}
                onChange={(e) => setMinutosNormais(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="minutos_extras">Min. Extras</Label>
              <Input
                id="minutos_extras"
                type="number"
                min="0"
                value={minutosExtras}
                onChange={(e) => setMinutosExtras(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
