import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GerenciarSubetapas = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [etapaId, setEtapaId] = useState("");
  const [custoPorHora, setCustoPorHora] = useState("");
  const [etapaFiltro, setEtapaFiltro] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const empresaId = useEmpresaId();

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

  const { data: subetapas, isLoading } = useQuery({
    queryKey: ["subetapas", etapaFiltro, empresaId],
    enabled: !!etapaFiltro && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subetapas")
        .select(`
          *,
          etapas(nome)
        `)
        .eq("etapa_id", etapaFiltro)
        .eq("empresa_id", empresaId);

      if (error) throw error;
      return data;
    },
  });

  const createSubetapa = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subetapas").insert({
        nome,
        etapa_id: etapaFiltro || etapaId, // Use active filter or selected id
        empresa_id: empresaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Subetapa criada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["subetapas"] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar subetapa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSubetapa = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("subetapas")
        .update({
          nome,
          etapa_id: etapaId,
        })
        .eq("id", editando.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Subetapa atualizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["subetapas"] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar subetapa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteSubetapa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subetapas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Subetapa excluída com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["subetapas"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir subetapa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNome("");
    // setEtapaId(""); // Keep context if filtering
    // setCustoPorHora(""); // Removed
    setEditando(null);
    setDialogOpen(false);
  };

  const handleEdit = (subetapa: any) => {
    setEditando(subetapa);
    setNome(subetapa.nome);
    setEtapaId(subetapa.etapa_id);
    // setCustoPorHora(subetapa.custo_por_hora?.toString() || "0"); // Removed
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg sm:text-xl">Gerenciar Subetapas</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditando(null); setNome(""); setEtapaId(etapaFiltro); }} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nova Subetapa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editando ? "Editar Subetapa" : "Nova Subetapa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Etapa Principal</Label>
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
                <Label>Nome da Subetapa</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Cantinho"
                />
              </div>
              {/* Custo/Hora removed */}
              <Button
                onClick={() => (editando ? updateSubetapa.mutate() : createSubetapa.mutate())}
                disabled={!nome || !etapaId}
                className="w-full"
              >
                {editando ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Filtrar por Etapa</Label>
          <Select value={etapaFiltro} onValueChange={setEtapaFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma etapa" />
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

        {!etapaFiltro ? (
          <p className="text-center text-muted-foreground py-8">
            Selecione uma etapa para visualizar as subetapas
          </p>
        ) : isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : subetapas && subetapas.length > 0 ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Etapa Principal</TableHead>
                  {/* <TableHead>Custo/Hora</TableHead> */}
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subetapas.map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.nome}</TableCell>
                    <TableCell>{sub.etapas.nome}</TableCell>
                    {/* <TableCell>R$ {sub.custo_por_hora?.toFixed(2) || "0.00"}</TableCell> */}
                    <TableCell className="space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(sub)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteSubetapa.mutate(sub.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhuma subetapa cadastrada</p>
        )}
      </CardContent>
    </Card>
  );
};

export default GerenciarSubetapas;
