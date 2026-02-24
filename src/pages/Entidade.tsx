import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Plus, Edit2, Trash2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import DialogServicos from "@/components/entidade/DialogServicos";

interface Entidade {
    id: string;
    nome: string;
    tipo: 'cliente' | 'fornecedor' | 'terceirizado';
    cpf_cnpj: string | null;
    telefone: string | null;
    endereco: string | null;
    email: string | null;
}

export default function Entidade() {
    const empresaId = useEmpresaId();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [servicosOpen, setServicosOpen] = useState(false);
    const [selectedEntidade, setSelectedEntidade] = useState<Entidade | null>(null);

    const [formData, setFormData] = useState({
        nome: "",
        tipo: "cliente" as 'cliente' | 'fornecedor' | 'terceirizado',
        cpf_cnpj: "",
        telefone: "",
        endereco: "",
        email: "",
    });

    const { data: entidades, isLoading } = useQuery({
        queryKey: ["entidade", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("entidade")
                .select("*")
                .eq("empresa_id", empresaId)
                .order("nome");

            if (error) throw error;
            return data as Entidade[];
        },
    });

    const saveMutation = useMutation({
        mutationFn: async (data: Omit<Entidade, "id"> & { id?: string }) => {
            if (data.id) {
                const { error } = await supabase
                    .from("entidade")
                    .update({
                        nome: data.nome,
                        tipo: data.tipo,
                        cpf_cnpj: data.cpf_cnpj || null,
                        telefone: data.telefone || null,
                        endereco: data.endereco || null,
                        email: data.email || null,
                    })
                    .eq("id", data.id);
                if (error) throw error;
            } else {
                const { id, ...insertData } = data;
                const { error } = await supabase
                    .from("entidade")
                    .insert([{ ...insertData, empresa_id: empresaId }]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["entidade"] });
            toast.success(editingId ? "Entidade atualizada!" : "Entidade cadastrada!");
            handleCloseDialog();
        },
        onError: (error) => {
            toast.error(`Erro ao salvar: ${error.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("entidade").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["entidade"] });
            toast.success("Entidade excluída!");
        },
        onError: (error) => {
            toast.error(`Erro ao excluir: ${error.message}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nome || !formData.tipo) {
            toast.error("Nome e Tipo são obrigatórios.");
            return;
        }
        saveMutation.mutate({
            id: editingId || undefined,
            ...formData,
        });
    };

    const handleEdit = (entidade: Entidade) => {
        setFormData({
            nome: entidade.nome,
            tipo: entidade.tipo,
            cpf_cnpj: entidade.cpf_cnpj || "",
            telefone: entidade.telefone || "",
            endereco: entidade.endereco || "",
            email: entidade.email || "",
        });
        setEditingId(entidade.id);
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Deseja realmente excluir esta entidade?")) {
            deleteMutation.mutate(id);
        }
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingId(null);
        setFormData({
            nome: "",
            tipo: "cliente",
            cpf_cnpj: "",
            telefone: "",
            endereco: "",
            email: "",
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Entidade</h1>
                    <p className="text-muted-foreground mt-1">
                        Gestão de clientes, fornecedores e terceirizados
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    if (!open) handleCloseDialog();
                    else setIsDialogOpen(true);
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Nova Entidade
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Editar Entidade" : "Nova Entidade"}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="nome">Nome *</Label>
                                <Input
                                    id="nome"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    placeholder="Nome ou Razão Social"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tipo">Tipo *</Label>
                                <Select
                                    value={formData.tipo}
                                    onValueChange={(value: any) => setFormData({ ...formData, tipo: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cliente">Cliente</SelectItem>
                                        <SelectItem value="fornecedor">Fornecedor</SelectItem>
                                        <SelectItem value="terceirizado">Terceirizado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
                                <Input
                                    id="cpf_cnpj"
                                    value={formData.cpf_cnpj}
                                    onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="telefone">Telefone</Label>
                                <Input
                                    id="telefone"
                                    value={formData.telefone}
                                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="contato@empresa.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endereco">Endereço</Label>
                                <Input
                                    id="endereco"
                                    value={formData.endereco}
                                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                                    placeholder="Rua, Número, Bairro, Cidade - UF"
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? "Salvando..." : "Salvar"}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>CPF/CNPJ</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    Carregando entidades...
                                </TableCell>
                            </TableRow>
                        ) : entidades?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    Nenhuma entidade cadastrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            entidades?.map((entidade) => (
                                <TableRow key={entidade.id} className="hover:bg-muted/50">
                                    <TableCell className="font-medium py-2">{entidade.nome}</TableCell>
                                    <TableCell className="capitalize py-2">{entidade.tipo}</TableCell>
                                    <TableCell className="py-2">{entidade.cpf_cnpj || "-"}</TableCell>
                                    <TableCell className="py-2">{entidade.telefone || "-"}</TableCell>
                                    <TableCell className="text-right space-x-2 py-2">
                                        {entidade.tipo === 'terceirizado' && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Gerenciar Serviços"
                                                onClick={() => {
                                                    setSelectedEntidade(entidade);
                                                    setServicosOpen(true);
                                                }}
                                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
                                            >
                                                <Briefcase className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEdit(entidade)}
                                            className="h-8 w-8"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(entidade.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <DialogServicos
                open={servicosOpen}
                onOpenChange={setServicosOpen}
                entidade={selectedEntidade}
            />
        </div>
    );
}
