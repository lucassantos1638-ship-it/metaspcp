import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { useEmpresaId } from "@/hooks/useEmpresaId";

const CadastroMetaDialog = () => {
  const empresaId = useEmpresaId();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"etapa" | "subetapa">("etapa");
  const [etapaId, setEtapaId] = useState("");
  const [subetapaId, setSubetapaId] = useState("");
  const [meta, setMeta] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: etapas } = useQuery({
    queryKey: ["etapas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etapas")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  const { data: subetapas } = useQuery({
    queryKey: ["subetapas", etapaId, empresaId],
    enabled: tipo === "subetapa" && !!etapaId && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subetapas")
        .select("*")
        .eq("etapa_id", etapaId)
        .eq("empresa_id", empresaId);
      if (error) throw error;
      return data;
    },
  });

  const createMeta = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("metas").insert({
        empresa_id: empresaId,
        etapa_id: tipo === "etapa" ? etapaId : null,
        subetapa_id: tipo === "subetapa" ? subetapaId : null,
        meta: parseInt(meta),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Meta cadastrada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      // Invalidate dashboard query too
      queryClient.invalidateQueries({ queryKey: ["desempenho-colaboradores"] });
      setOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar meta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setTipo("etapa");
    setEtapaId("");
    setSubetapaId("");
    setMeta("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Cadastrar Meta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar Meta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <RadioGroup value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="etapa" id="etapa" />
                <Label htmlFor="etapa">Etapa</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="subetapa" id="subetapa" />
                <Label htmlFor="subetapa">Subetapa</Label>
              </div>
            </RadioGroup>
          </div>

          {tipo === "etapa" ? (
            <div>
              <Label>Etapa</Label>
              <Select value={etapaId} onValueChange={setEtapaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {etapas?.map((etapa) => (
                    <SelectItem key={etapa.id} value={etapa.id}>
                      {etapa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div>
                <Label>Etapa</Label>
                <Select value={etapaId} onValueChange={setEtapaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {etapas?.map((etapa) => (
                      <SelectItem key={etapa.id} value={etapa.id}>
                        {etapa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subetapa</Label>
                <Select value={subetapaId} onValueChange={setSubetapaId} disabled={!etapaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a subetapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {subetapas?.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div>
            <Label>Meta (quantidade)</Label>
            <Input
              type="number"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="500"
            />
          </div>

          <Button
            onClick={() => createMeta.mutate()}
            disabled={!meta || (tipo === "etapa" ? !etapaId : !subetapaId)}
            className="w-full"
          >
            Salvar Meta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CadastroMetaDialog;
