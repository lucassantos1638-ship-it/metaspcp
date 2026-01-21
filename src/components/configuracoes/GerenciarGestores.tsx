import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2, Shield, KeyRound } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

const GerenciarGestores = () => {
  const queryClient = useQueryClient();
  const { user, sessionToken } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [deleteGestor, setDeleteGestor] = useState<any>(null);
  const [resetPasswordGestor, setResetPasswordGestor] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    nome_completo: "",
    email: "",
    empresa_id: ""
  });

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin
  });

  const { data: gestores, isLoading } = useQuery({
    queryKey: ["gestores", user?.empresa_id, user?.role],
    queryFn: async () => {
      let query = supabase
        .from("usuarios")
        .select(`
            *,
            empresas(nome)
          `)
        .eq("role", "gestor")
        .order("nome_completo");

      // Se NÃO for super_admin, filtrar apenas da sua empresa
      if (!isSuperAdmin && user?.empresa_id) {
        query = query.eq("empresa_id", user.empresa_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase.functions.invoke("create-user", {
        body: {
          username: data.username,
          senha: data.password,
          nome_completo: data.nome_completo,
          email: data.email,
          role: "gestor",
          colaborador_id: "",
          empresa_id: isSuperAdmin ? data.empresa_id : user?.empresa_id,
          sessionToken
        }
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || "Erro ao criar gestor");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestores"] });
      toast.success("Gestor criado com sucesso!");
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao criar gestor");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Para gestor normal: verificar se não é o último da SUA empresa
      if (!isSuperAdmin && gestores && gestores.length <= 1) {
        throw new Error("Não é possível excluir o último gestor da empresa");
      }

      const { data: result, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId, sessionToken }
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || "Erro ao excluir gestor");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestores"] });
      toast.success("Gestor excluído com sucesso!");
      setIsDeleteDialogOpen(false);
      setDeleteGestor(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setIsDeleteDialogOpen(false);
      setDeleteGestor(null);
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string, newPassword: string }) => {
      const { data: result, error } = await supabase.functions.invoke("update-user-password", {
        body: { userId: userId, newPassword: newPassword, sessionToken }
      });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || "Erro ao redefinir senha");
      return result;
    },
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso!");
      setIsResetPasswordDialogOpen(false);
      setResetPasswordGestor(null);
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const resetForm = () => {
    setFormData({ username: "", password: "", nome_completo: "", email: "", empresa_id: "" });
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuperAdmin && !formData.empresa_id) {
      toast.error("Selecione uma empresa");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleDelete = (gestor: any) => {
    setDeleteGestor(gestor);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deleteGestor) {
      deleteMutation.mutate(deleteGestor.id);
    }
  };

  const handleResetPassword = (gestor: any) => {
    setResetPasswordGestor(gestor);
    setIsResetPasswordDialogOpen(true);
  };

  const confirmResetPassword = () => {
    if (resetPasswordGestor && newPassword) {
      resetPasswordMutation.mutate({ userId: resetPasswordGestor.id, newPassword });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Gerenciar Gestores
              </CardTitle>
              <CardDescription>
                Cadastre e exclua gestores do sistema
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Gestor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome Completo</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  {isSuperAdmin && <TableHead>Empresa</TableHead>}
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gestores?.map((gestor: any) => (
                  <TableRow key={gestor.id}>
                    <TableCell className="font-medium">{gestor.nome_completo}</TableCell>
                    <TableCell>{gestor.username}</TableCell>
                    <TableCell>{gestor.email}</TableCell>
                    {isSuperAdmin && <TableCell>{gestor.empresas?.nome || 'N/A'}</TableCell>}
                    <TableCell>{format(new Date(gestor.created_at || ""), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResetPassword(gestor)}
                            title="Redefinir senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(gestor)}
                          disabled={!isSuperAdmin && (gestores?.length || 0) <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
            <DialogTitle>Novo Gestor</DialogTitle>
            <DialogDescription>
              Crie um novo usuário com permissões de gestor
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome_completo">Nome Completo *</Label>
                <Input
                  id="nome_completo"
                  value={formData.nome_completo}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome_completo: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="gestor@empresa.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha (mínimo 6 caracteres) *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="empresa_id">Empresa *</Label>
                  <Select value={formData.empresa_id} onValueChange={(value) => setFormData(prev => ({ ...prev, empresa_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas?.map((empresa: any) => (
                        <SelectItem key={empresa.id} value={empresa.id}>{empresa.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Criar Gestor
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
              Tem certeza que deseja excluir o gestor <strong>{deleteGestor?.nome_completo}</strong>?
              Todas as permissões e sessões serão removidas. Esta ação não pode ser desfeita.
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

      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para <strong>{resetPasswordGestor?.nome_completo}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Username (para referência)</Label>
              <Input value={resetPasswordGestor?.username || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">Nova Senha (mínimo 6 caracteres) *</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => {
              setIsResetPasswordDialogOpen(false);
              setNewPassword("");
            }}>
              Cancelar
            </Button>
            <Button onClick={confirmResetPassword} disabled={resetPasswordMutation.isPending || newPassword.length < 6}>
              Redefinir Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GerenciarGestores;
