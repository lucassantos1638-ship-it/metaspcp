import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Switch } from "@/components/ui/switch";
import { FileSpreadsheet } from "lucide-react";
import ImportarColaboradoresDialog from "./ImportarColaboradoresDialog";

interface Colaborador {
  id: string;
  nome: string;
  funcao: string | null;
  custo_por_hora: number | null;
  custo_hora_extra: number | null;
  ativo: boolean | null;
  created_at: string;
  empresa_id: string;
}

const GerenciarColaboradores = () => {
  const queryClient = useQueryClient();
  const empresaId = useEmpresaId();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null);
  const [deleteColaborador, setDeleteColaborador] = useState<Colaborador | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    funcao: "",
    custo_por_hora: "",
    custo_hora_extra: "",
    ativo: true
  });

  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["colaboradores", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("nome");

      if (error) throw error;
      return data as Colaborador[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!empresaId) throw new Error("Empresa não identificada");

      const { error } = await supabase
        .from("colaboradores")
        .insert({
          ...data,
          custo_por_hora: parseFloat(data.custo_por_hora) || 0,
          custo_hora_extra: parseFloat(data.custo_hora_extra) || 0,
          ativo: data.ativo,
          empresa_id: empresaId
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      toast.success("Colaborador cadastrado com sucesso!");
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cadastrar colaborador: ${error.message}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("colaboradores")
        .update({
          ...data,
          custo_por_hora: parseFloat(data.custo_por_hora) || 0,
          custo_hora_extra: parseFloat(data.custo_hora_extra) || 0,
          ativo: data.ativo
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      toast.success("Colaborador atualizado com sucesso!");
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar colaborador: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Verificar vínculos
      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("id")
        .eq("colaborador_id", id)
        .single();

      if (usuarios) {
        throw new Error("Este colaborador está vinculado a um usuário. Remova o vínculo primeiro.");
      }

      const { data: producoes } = await supabase
        .from("producoes")
        .select("id")
        .eq("colaborador_id", id)
        .limit(1)
        .single();

      if (producoes) {
        throw new Error("Este colaborador possui produções registradas e não pode ser excluído.");
      }

      const { error } = await supabase
        .from("colaboradores")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      toast.success("Colaborador excluído com sucesso!");
      setIsDeleteDialogOpen(false);
      setDeleteColaborador(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setIsDeleteDialogOpen(false);
      setDeleteColaborador(null);
    }
  });

  const resetForm = () => {
    setFormData({ nome: "", funcao: "", custo_por_hora: "", custo_hora_extra: "", ativo: true });
    setEditingColaborador(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (colaborador: Colaborador) => {
    setEditingColaborador(colaborador);
    setFormData({
      nome: colaborador.nome,
      funcao: colaborador.funcao || "",
      custo_por_hora: colaborador.custo_por_hora?.toString() || "",
      custo_hora_extra: colaborador.custo_hora_extra?.toString() || "",
      ativo: colaborador.ativo ?? true
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingColaborador) {
      updateMutation.mutate({ id: editingColaborador.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (colaborador: Colaborador) => {
    setDeleteColaborador(colaborador);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deleteColaborador) {
      deleteMutation.mutate(deleteColaborador.id);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gerenciar Colaboradores
              </CardTitle>
              <CardDescription>
                Cadastre, edite e exclua colaboradores
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Importar Excel
              </Button>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Colaborador
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Custo/Hora</TableHead>
                  <TableHead>Custo H. Extra</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colaboradores?.map((colaborador) => (
                  <TableRow key={colaborador.id}>
                    <TableCell className="font-medium">{colaborador.nome}</TableCell>
                    <TableCell>{colaborador.funcao || "-"}</TableCell>
                    <TableCell>R$ {colaborador.custo_por_hora?.toFixed(2) || "0.00"}</TableCell>
                    <TableCell>R$ {colaborador.custo_hora_extra?.toFixed(2) || "0.00"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colaborador.ativo !== false ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {colaborador.ativo !== false ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                    <TableCell>{format(new Date(colaborador.created_at || new Date()), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(colaborador)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(colaborador)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingColaborador ? "Editar Colaborador" : "Novo Colaborador"}
            </DialogTitle>
            <DialogDescription>
              {editingColaborador ? "Altere os dados do colaborador" : "Preencha os dados do novo colaborador"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="funcao">Função</Label>
                <Input
                  id="funcao"
                  value={formData.funcao}
                  onChange={(e) => setFormData(prev => ({ ...prev, funcao: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="custo_por_hora">Custo por Hora (R$)</Label>
                  <Input
                    id="custo_por_hora"
                    type="number"
                    step="0.01"
                    value={formData.custo_por_hora}
                    onChange={(e) => setFormData(prev => ({ ...prev, custo_por_hora: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custo_hora_extra">Custo H. Extra (R$)</Label>
                  <Input
                    id="custo_hora_extra"
                    type="number"
                    step="0.01"
                    value={formData.custo_hora_extra}
                    onChange={(e) => setFormData(prev => ({ ...prev, custo_hora_extra: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
                />
                <Label htmlFor="ativo">Colaborador Ativo</Label>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingColaborador ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o colaborador <strong>{deleteColaborador?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ImportarColaboradoresDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />
    </>
  );
};

export default GerenciarColaboradores;
