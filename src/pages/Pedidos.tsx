import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

interface Pedido {
    id: string;
    numero?: string;
    cliente_id: string;
    tabela_preco_id: string;
    tipo_venda: string;
    movimenta_estoque: boolean;
    status: string;
    data_criacao: string;
    cliente_nome?: string;
    tabela_nome?: string;
    total: number;
}

export default function Pedidos() {
    const empresaId = useEmpresaId();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [busca, setBusca] = useState("");

    const { data: pedidos, isLoading } = useQuery({
        queryKey: ["pedidos", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("pedidos")
                .select(`
                    *,
                    entidade (nome),
                    tabelas_preco (nome),
                    pedido_itens ( subtotal )
                `)
                .eq("empresa_id", empresaId)
                .order("data_criacao", { ascending: false });

            if (error) throw error;

            return data.map((d: any) => ({
                id: d.id,
                numero: d.numero,
                cliente_id: d.cliente_id,
                tabela_preco_id: d.tabela_preco_id,
                tipo_venda: d.tipo_venda,
                movimenta_estoque: d.movimenta_estoque,
                status: d.status,
                data_criacao: d.data_criacao,
                cliente_nome: d.entidade?.nome,
                tabela_nome: d.tabelas_preco?.nome,
                total: d.pedido_itens?.reduce((acc: number, item: any) => acc + Number(item.subtotal), 0) || 0
            })) as Pedido[];
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("pedidos").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["pedidos"] });
            toast.success("Pedido excluído!");
        },
        onError: (error) => {
            toast.error(`Erro ao excluir: ${error.message}`);
        },
    });

    const handleDelete = (id: string) => {
        if (window.confirm("Deseja realmente excluir este pedido?")) {
            deleteMutation.mutate(id);
        }
    };

    const pedidosFiltrados = pedidos?.filter(p =>
        p.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) ||
        p.tipo_venda.toLowerCase().includes(busca.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Pedidos</h1>
                    <p className="text-muted-foreground mt-1">
                        Gerenciamento de pedidos de vendas
                    </p>
                </div>
                <Button onClick={() => navigate("/pedidos/novo")}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Pedido
                </Button>
            </div>

            <div className="flex items-center space-x-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por cliente ou tipo..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nº Pedido</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Tabela</TableHead>
                            <TableHead>Tipo Venda</TableHead>
                            <TableHead className="text-right">Total (R$)</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    Carregando pedidos...
                                </TableCell>
                            </TableRow>
                        ) : pedidosFiltrados?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    Nenhum pedido encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            pedidosFiltrados?.map((pedido) => (
                                <TableRow key={pedido.id} className="hover:bg-muted/50">
                                    <TableCell className="py-2 font-mono">
                                        {pedido.numero || '-'}
                                    </TableCell>
                                    <TableCell className="py-2">
                                        {format(new Date(pedido.data_criacao), "dd/MM/yyyy HH:mm")}
                                    </TableCell>
                                    <TableCell className="font-medium py-2">{pedido.cliente_nome}</TableCell>
                                    <TableCell className="py-2">{pedido.tabela_nome}</TableCell>
                                    <TableCell className="py-2">{pedido.tipo_venda}</TableCell>
                                    <TableCell className="text-right py-2 font-semibold">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.total)}
                                    </TableCell>
                                    <TableCell className="py-2 uppercase text-xs">
                                        {pedido.status}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2 py-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-primary hover:text-primary/80"
                                            onClick={() => navigate(`/pedidos/${pedido.id}`)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(pedido.id)}
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
        </div>
    );
}
