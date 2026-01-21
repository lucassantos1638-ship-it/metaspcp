import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2, Shield, KeyRound, UserCog } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

const PERMISSIONS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'producao', label: 'Lançar Produção' },
    { id: 'lotes', label: 'Lotes' },
    { id: 'pedidos', label: 'Pedidos / Acompanhamento' },
    { id: 'produtos', label: 'Produtos' },
    { id: 'previsao_producao', label: 'Previsão de Produção' },
    { id: 'metas', label: 'Metas' },
    { id: 'etapas', label: 'Etapas' },
    { id: 'relatorios', label: 'Relatórios' },
    { id: 'pop', label: 'P.O.P' },
    { id: 'configuracoes', label: 'Configurações' }
];

const GerenciarUsuarios = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'super_admin';

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);

    const [deleteUser, setDeleteUser] = useState<any>(null);
    const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
    const [newPassword, setNewPassword] = useState("");

    const [formData, setFormData] = useState({
        username: "",
        password: "",
        nome_completo: "",
        email: "",
        empresa_id: "",
        role: "colaborador" as "gestor" | "colaborador",
        permissoes: [] as string[]
    });

    // Mock data for companies if super admin
    // Mock data for companies removed as strict tenant isolation is enforced


    const { data: usuarios, isLoading } = useQuery({
        queryKey: ["usuarios", user?.empresa_id, user?.role],
        queryFn: async () => {
            let query = supabase
                .from("usuarios")
                .select(`
            *,
            user_roles!inner(role),
            empresas(nome)
          `)
                .order("nome_completo");

            // Se NÃO for super_admin, filtrar apenas da sua empresa
            if (!isSuperAdmin && user?.empresa_id) {
                query = query.eq("empresa_id", user.empresa_id);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Parse permissions if stored as JSON/Array
            return data.map((u: any) => ({
                ...u,
                permissoes: u.permissoes || []
            }));
        },
        enabled: !!user
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const { data: sessionData } = await supabase.auth.getSession();
            const sessionToken = sessionData.session?.access_token;

            if (!sessionToken) throw new Error("Sessão inválida");

            // Calls the edge function to create user in Auth and Public table
            const { data: result, error } = await supabase.functions.invoke("create-user", {
                body: {
                    username: data.username,
                    senha: data.password, // Changed from password to senha to match edge function
                    nome_completo: data.nome_completo,
                    email: data.email,
                    role: data.role,
                    colaborador_id: "",
                    empresa_id: user?.empresa_id,
                    permissoes: data.permissoes,
                    sessionToken
                }
            });

            if (error) throw error;
            if (!result?.success) throw new Error(result?.error || "Erro ao criar usuário");
            return result;
        },
        onSuccess: (result: any) => {
            queryClient.invalidateQueries({ queryKey: ["usuarios"] });
            toast.success("Usuário criado com sucesso!");
            resetForm();
        },
        onError: (error: Error) => {
            toast.error(error.message || "Erro ao criar usuário");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            // Prevent deleting self
            if (userId === user?.id) {
                throw new Error("Você não pode excluir seu próprio usuário");
            }

            const { data: sessionData } = await supabase.auth.getSession();
            const sessionToken = sessionData.session?.access_token;

            if (!sessionToken) throw new Error("Sessão inválida");

            const { data: result, error } = await supabase.functions.invoke("delete-user", {
                body: { user_id: userId, sessionToken }
            });

            if (error) throw error;
            if (!result?.success) throw new Error(result?.error || "Erro ao excluir usuário");
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["usuarios"] });
            toast.success("Usuário excluído com sucesso!");
            setIsDeleteDialogOpen(false);
            setDeleteUser(null);
        },
        onError: (error: Error) => {
            toast.error(error.message);
            setIsDeleteDialogOpen(false);
            setDeleteUser(null);
        }
    });

    const resetPasswordMutation = useMutation({
        mutationFn: async ({ userId, newPassword }: { userId: string, newPassword: string }) => {
            const { data: sessionData } = await supabase.auth.getSession();
            const sessionToken = sessionData.session?.access_token;

            if (!sessionToken) throw new Error("Sessão inválida");

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
            setResetPasswordUser(null);
            setNewPassword("");
        },
        onError: (error: Error) => {
            toast.error(error.message);
        }
    });

    const resetForm = () => {
        setFormData({
            username: "",
            password: "",
            nome_completo: "",
            email: "",
            empresa_id: "",
            role: "colaborador",
            permissoes: []
        });
        setIsDialogOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Strict tenant: always uses current user's company
        createMutation.mutate(formData);
    };

    const handleDelete = (targetUser: any) => {
        setDeleteUser(targetUser);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (deleteUser) {
            deleteMutation.mutate(deleteUser.id);
        }
    };

    const handleResetPassword = (targetUser: any) => {
        setResetPasswordUser(targetUser);
        setIsResetPasswordDialogOpen(true);
    };

    const confirmResetPassword = () => {
        if (resetPasswordUser && newPassword) {
            resetPasswordMutation.mutate({ userId: resetPasswordUser.id, newPassword });
        }
    };

    const togglePermission = (permissionId: string) => {
        setFormData(prev => {
            const current = prev.permissoes;
            if (current.includes(permissionId)) {
                return { ...prev, permissoes: current.filter(p => p !== permissionId) };
            } else {
                return { ...prev, permissoes: [...current, permissionId] };
            }
        });
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <UserCog className="h-5 w-5" />
                                Gerenciar Usuários
                            </CardTitle>
                            <CardDescription>
                                Cadastre usuários, defina perfis (Gestor/Colaborador) e permissões de acesso
                            </CardDescription>
                        </div>
                        <Button onClick={() => setIsDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Usuário
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
                                    <TableHead>Perfil</TableHead>
                                    <TableHead>Permissões</TableHead>
                                    {isSuperAdmin && <TableHead>Empresa</TableHead>}
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usuarios?.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">{u.nome_completo}</TableCell>
                                        <TableCell>{u.username}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${u.user_roles?.[0]?.role === 'gestor'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {u.user_roles?.[0]?.role === 'gestor' ? 'Gestor' : 'Colaborador'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                {u.user_roles?.[0]?.role === 'gestor' ? (
                                                    <span className="text-xs text-muted-foreground">Acesso Total</span>
                                                ) : (
                                                    u.permissoes && u.permissoes.length > 0
                                                        ? u.permissoes.map((p: string) => (
                                                            <span key={p} className="text-[10px] bg-secondary text-secondary-foreground px-1 py-0.5 rounded">
                                                                {PERMISSIONS.find(per => per.id === p)?.label || p}
                                                            </span>
                                                        ))
                                                        : <span className="text-xs text-muted-foreground">Nenhuma</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        {isSuperAdmin && <TableCell>{u.empresas?.nome || 'N/A'}</TableCell>}
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleResetPassword(u)}
                                                    title="Redefinir senha"
                                                >
                                                    <KeyRound className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(u)}
                                                    disabled={u.id === user?.id} // Cannot delete self
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
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Novo Usuário</DialogTitle>
                        <DialogDescription>
                            Crie um novo usuário para acesso ao sistema
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
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
                                        placeholder="user@empresa.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="username">Login (Username) *</Label>
                                    <Input
                                        id="username"
                                        value={formData.username}
                                        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Senha *</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                        minLength={6}
                                        placeholder="Min. 6 caracteres"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Perfil de Acesso</Label>
                                <div className="flex gap-4 pt-1">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="role-gestor"
                                            checked={formData.role === 'gestor'}
                                            onCheckedChange={() => setFormData(prev => ({ ...prev, role: 'gestor' }))}
                                        />
                                        <Label htmlFor="role-gestor">Gestor</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="role-colaborador"
                                            checked={formData.role === 'colaborador'}
                                            onCheckedChange={() => setFormData(prev => ({ ...prev, role: 'colaborador' }))}
                                        />
                                        <Label htmlFor="role-colaborador">Colaborador</Label>
                                    </div>
                                </div>
                            </div>

                            {(formData.role === 'colaborador' || formData.role === 'gestor') && (
                                <div className="space-y-3 border rounded-md p-3 bg-muted/20">
                                    <Label>Permissões de Acesso</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {PERMISSIONS.map(permission => (
                                            <div key={permission.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`perm-${permission.id}`}
                                                    checked={formData.permissoes.includes(permission.id)}
                                                    onCheckedChange={() => togglePermission(permission.id)}
                                                />
                                                <Label htmlFor={`perm-${permission.id}`} className="font-normal cursor-pointer">
                                                    {permission.label}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="empresa_id">Empresa</Label>
                                {isSuperAdmin ? (
                                    <Input
                                        value={user?.empresa_nome || "Empresa Atual (Admin)"}
                                        disabled
                                        className="bg-muted text-muted-foreground opacity-100"
                                    />
                                ) : (
                                    <Input
                                        value={user?.empresa_nome || "Empresa Atual"}
                                        disabled
                                        className="bg-muted text-muted-foreground opacity-100" // Ensure it looks legible but disabled
                                    />
                                )}
                            </div>
                        </div>
                        <DialogFooter className="mt-6">
                            <Button type="button" variant="outline" onClick={resetForm}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending}>
                                Criar Usuário
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
                            Tem certeza que deseja excluir o usuário <strong>{deleteUser?.nome_completo}</strong>?
                            Esta ação removerá o acesso ao sistema.
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
                            Defina uma nova senha para <strong>{resetPasswordUser?.nome_completo}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Username</Label>
                            <Input value={resetPasswordUser?.username || ""} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new_password">Nova Senha *</Label>
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

export default GerenciarUsuarios;
