import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Plus, Trash2, KeyRound, Users } from "lucide-react";
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
    { id: 'colaboradores', label: 'Colaboradores' },
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

    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Manual fetch implementation (Stable)
    useEffect(() => {
        let mounted = true;
        async function load() {
            if (!user) return;
            try {
                setIsLoading(true);
                let query = supabase
                    .from('usuarios')
                    .select('*, empresas(nome)')
                    .order("nome_completo");

                // Filtro de segurança: Estrito por empresa (mesmo para admins)
                if (user?.empresa_id) {
                    query = query.eq('empresa_id', user.empresa_id);
                }

                const { data, error } = await query;

                if (error) throw error;

                if (mounted) {
                    const safeData = (data || []).map((u: any) => ({
                        ...u,
                        permissoes: Array.isArray(u.permissoes) ? u.permissoes : []
                    }));
                    setUsuarios(safeData);
                }
            } catch (e: any) {
                console.error("Erro fetch:", e);
                if (mounted) setError(e.message);
            } finally {
                if (mounted) setIsLoading(false);
            }
        }
        load();
    }, [user]);

    const createMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const { data: sessionData } = await supabase.auth.getSession();
            const sessionToken = sessionData.session?.access_token;

            if (!sessionToken) throw new Error("Sessão inválida");

            const { data: result, error } = await supabase.functions.invoke("create-user", {
                body: {
                    username: data.username,
                    senha: data.password,
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
        onSuccess: () => {
            // Reload manually since we aren't using useQuery for the list
            window.location.reload();
        },
        onError: (error: Error) => {
            toast.error(error.message || "Erro ao criar usuário");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            if (userId === user?.id) throw new Error("Você não pode excluir seu próprio usuário");
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
            toast.success("Usuário excluído!");
            setIsDeleteDialogOpen(false);
            setUsuarios(prev => prev.filter(u => u.id !== deleteUser?.id));
        },
        onError: (error: Error) => toast.error(error.message)
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
            toast.success("Senha redefinida!");
            setIsResetPasswordDialogOpen(false);
            setNewPassword("");
        },
        onError: (error: Error) => toast.error(error.message)
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

    // Safe permission renderer
    const renderPermissions = (user: any) => {
        try {
            if (user.role === 'gestor') return <span className="text-xs text-muted-foreground">Acesso Total</span>;

            const perms = user.permissoes;
            if (!Array.isArray(perms) || perms.length === 0) return <span className="text-xs text-muted-foreground">Nenhuma</span>;

            // Render simple list first to ensure safety
            return (
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {perms.map((p: any) => {
                        const label = PERMISSIONS.find(px => px.id === p)?.label || String(p);
                        return (
                            <span key={String(p)} className="text-[10px] bg-secondary text-secondary-foreground px-1 py-0.5 rounded">
                                {label}
                            </span>
                        );
                    })}
                </div>
            );
        } catch (e) {
            return <span className="text-xs text-red-500">Erro visualiz.</span>;
        }
    };

    if (error) {
        return (
            <div className="p-4 border border-red-500 bg-red-50 text-red-900 rounded-md">
                <h3 className="font-bold">Erro ao carregar usuários</h3>
                <p>{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-2" variant="destructive">
                    Recarregar Página
                </Button>
            </div>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
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
                                {(() => {
                                    // Encontrar o usuário Master (o mais antigo da empresa)
                                    // Filtramos apenas para garantir que tenham created_at
                                    const sortedUsers = [...usuarios].sort((a, b) => {
                                        const dateA = new Date(a.created_at || 0).getTime();
                                        const dateB = new Date(b.created_at || 0).getTime();
                                        return dateA - dateB;
                                    });
                                    const masterUserId = sortedUsers.length > 0 ? sortedUsers[0].id : null;

                                    return usuarios.map((u) => {
                                        const isMaster = u.id === masterUserId; // É o dono da empresa?
                                        const isMe = u.id === user?.id; // Sou eu mesmo?

                                        // Regras de Proteção:
                                        // 1. Senha: Se for o Master, SÓ ele mesmo pode mudar.
                                        // 2. Exclusão: Master nunca pode ser excluído. Ninguém se auto-exclui.

                                        const canResetPassword = isMaster ? isMe : true;
                                        const canDelete = !isMaster && !isMe;

                                        return (
                                            <TableRow key={u.id}>
                                                <TableCell className="font-medium">
                                                    {u.nome_completo}
                                                    {isMaster && (
                                                        <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 font-bold" title="Usuário Principal">
                                                            MASTER
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{u.username}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${u.role === 'gestor'
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {u.role === 'gestor' ? 'Gestor' : 'Colaborador'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {renderPermissions(u)}
                                                </TableCell>
                                                {isSuperAdmin && <TableCell>{u.empresas?.nome || 'N/A'}</TableCell>}
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={!canResetPassword}
                                                            onClick={() => {
                                                                setResetPasswordUser(u);
                                                                setIsResetPasswordDialogOpen(true);
                                                            }}
                                                            title={!canResetPassword ? "Apenas o usuário master pode alterar sua própria senha" : "Redefinir senha"}
                                                        >
                                                            <KeyRound className={`h-4 w-4 ${!canResetPassword ? 'opacity-30' : ''}`} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                setDeleteUser(u);
                                                                setIsDeleteDialogOpen(true);
                                                            }}
                                                            disabled={!canDelete}
                                                            title={isMaster ? "O usuário master não pode ser excluído" : "Excluir usuário"}
                                                        >
                                                            <Trash2 className={`h-4 w-4 ${!canDelete ? 'opacity-30' : ''}`} />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    });
                                })()}
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
                    <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }}>
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
                                <Input
                                    value={user?.empresa_nome || "Empresa Atual"}
                                    disabled
                                    className="bg-muted text-muted-foreground opacity-100"
                                />
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
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(deleteUser.id)}>
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
                            Nova senha para <strong>{resetPasswordUser?.nome_completo}</strong>
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
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={() => resetPasswordMutation.mutate({ userId: resetPasswordUser.id, newPassword })} disabled={resetPasswordMutation.isPending || newPassword.length < 6}>
                            Redefinir Senha
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default GerenciarUsuarios;
