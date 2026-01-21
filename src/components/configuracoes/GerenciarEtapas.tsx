import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GerenciarEtapas = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState("");
  const [custoPorHora, setCustoPorHora] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const empresaId = useEmpresaId();

  const { data: etapas, isLoading } = useQuery({
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

  const createEtapa = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("etapas").insert({
        nome,
        ordem: parseInt(ordem),
        custo_por_hora: 0,
        empresa_id: empresaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Etapa criada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["etapas"] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar etapa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEtapa = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("etapas")
        .update({
          nome,
          ordem: parseInt(ordem),
          custo_por_hora: 0,
        })
        .eq("id", editando.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Etapa atualizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["etapas"] });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar etapa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEtapa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("etapas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Etapa excluída com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["etapas"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir etapa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNome("");
    setOrdem("");
    // setCustoPorHora(""); // Removed
    setEditando(null);
    setDialogOpen(false);
  };

  const handleEdit = (etapa: any) => {
    setEditando(etapa);
    setNome(etapa.nome);
    setOrdem(etapa.ordem.toString());
    // setCustoPorHora(etapa.custo_por_hora?.toString() || "0"); // Removed
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg sm:text-xl">Gerenciar Etapas</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditando(null); setNome(""); setOrdem(""); }} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nova Etapa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editando ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome da Etapa</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Costura"
                />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={ordem}
                  onChange={(e) => setOrdem(e.target.value)}
                  placeholder="1"
                />
              </div>
              {/* Custo/Hora removed */}
              <Button
                onClick={() => (editando ? updateEtapa.mutate() : createEtapa.mutate())}
                disabled={!nome || !ordem}
                className="w-full"
              >
                {editando ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : etapas && etapas.length > 0 ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  {/* <TableHead>Custo/Hora</TableHead> */}
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {etapas.map((etapa) => (
                  <TableRow key={etapa.id}>
                    <TableCell>{etapa.ordem}</TableCell>
                    <TableCell className="font-medium">{etapa.nome}</TableCell>
                    {/* <TableCell>R$ {etapa.custo_por_hora?.toFixed(2) || "0.00"}</TableCell> */}
                    <TableCell className="space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(etapa)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteEtapa.mutate(etapa.id)}
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
          <p className="text-center text-muted-foreground py-8">Nenhuma etapa cadastrada</p>
        )}
      </CardContent>
    </Card>
  );
};

export default GerenciarEtapas;
