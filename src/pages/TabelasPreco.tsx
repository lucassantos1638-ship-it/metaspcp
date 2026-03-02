import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Plus, Edit2, Trash2, Box } from "lucide-react";
import { toast } from "sonner";
import DialogProdutosTabela from "@/components/tabelas/DialogProdutosTabela";

interface TabelaPreco {
    id: string;
    nome: string;
    ativo: boolean;
}

export default function TabelasPreco() {
    const empresaId = useEmpresaId();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [produtosOpen, setProdutosOpen] = useState(false);
    const [selectedTabela, setSelectedTabela] = useState<TabelaPreco | null>(null);

    const [formData, setFormData] = useState({
        nome: "",
        ativo: true,
    });

    const { data: tabelas, isLoading } = useQuery({
        queryKey: ["tabelas_preco", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tabelas_preco")
                .select("*")
                .eq("empresa_id", empresaId)
                .order("nome");

            if (error) throw error;
            return data as TabelaPreco[];
        },
    });

    const saveMutation = useMutation({
        mutationFn: async (data: Omit<TabelaPreco, "id"> & { id?: string }) => {
            if (data.id) {
                const { error } = await supabase
                    .from("tabelas_preco")
                    .update({
                        nome: data.nome,
                        ativo: data.ativo,
                    })
                    .eq("id", data.id);
                if (error) throw error;
            } else {
                const { id, ...insertData } = data;
                const { error } = await supabase
                    .from("tabelas_preco")
                    .insert([{ ...insertData, empresa_id: empresaId }]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tabelas_preco"] });
            toast.success(editingId ? "Tabela atualizada!" : "Tabela cadastrada!");
            handleCloseDialog();
        },
        onError: (error) => {
            toast.error(`Erro ao salvar: ${error.message}`);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("tabelas_preco").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tabelas_preco"] });
            toast.success("Tabela excluída!");
        },
        onError: (error) => {
            toast.error(`Erro ao excluir: ${error.message}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.nome) {
            toast.error("Nome é obrigatório.");
            return;
        }
        saveMutation.mutate({
            id: editingId || undefined,
            ...formData,
        });
    };

    const handleEdit = (tabela: TabelaPreco) => {
        setFormData({
            nome: tabela.nome,
            ativo: tabela.ativo,
        });
        setEditingId(tabela.id);
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Deseja realmente excluir esta tabela?")) {
            deleteMutation.mutate(id);
        }
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingId(null);
        setFormData({
            nome: "",
            ativo: true,
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Tabelas de Preços</h1>
                    <p className="text-muted-foreground mt-1">
                        Gestão das tabelas de preços e produtos vinculados
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    if (!open) handleCloseDialog();
                    else setIsDialogOpen(true);
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Nova Tabela
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Editar Tabela" : "Nova Tabela"}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="nome">Nome *</Label>
                                <Input
                                    id="nome"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    placeholder="Ex: Varejo, Atacado"
                                    required
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="ativo" className="flex flex-col gap-1">
                                    <span>Status</span>
                                    <span className="font-normal text-sm text-muted-foreground">Tabela ativa para uso</span>
                                </Label>
                                <Switch
                                    id="ativo"
                                    checked={formData.ativo}
                                    onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
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
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                    Carregando tabelas...
                                </TableCell>
                            </TableRow>
                        ) : tabelas?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                    Nenhuma tabela cadastrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            tabelas?.map((tabela) => (
                                <TableRow key={tabela.id} className="hover:bg-muted/50">
                                    <TableCell className="font-medium py-2">{tabela.nome}</TableCell>
                                    <TableCell className="py-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${tabela.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {tabela.ativo ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2 py-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            title="Gerenciar Produtos"
                                            onClick={() => {
                                                setSelectedTabela(tabela);
                                                setProdutosOpen(true);
                                            }}
                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
                                        >
                                            <Box className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEdit(tabela)}
                                            className="h-8 w-8"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(tabela.id)}
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

            {selectedTabela && (
                <DialogProdutosTabela
                    open={produtosOpen}
                    onOpenChange={setProdutosOpen}
                    tabelaId={selectedTabela.id}
                    tabelaNome={selectedTabela.nome}
                />
            )}
        </div>
    );
}
