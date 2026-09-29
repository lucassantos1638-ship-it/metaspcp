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
import { DialogImportarPdfIa } from "@/components/pedidos/DialogImportarPdfIa";
import { DialogImportarExcelIa } from "@/components/pedidos/DialogImportarExcelIa";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Pedido {
    id: string;
    numero?: string;
    cliente_id: string;
    tabela_preco_id: string;
    tipo_venda: string;
    movimenta_estoque: boolean;
    status: string;
    data_criacao: string;
    data_emissao?: string;
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
                .order("data_emissao", { ascending: false });

            if (error) throw error;

            return data.map((d: any) => ({
                id: d.id,
                numero: d.numero,
                cliente_id: d.cliente_id,
                tabela_preco_id: d.tabela_preco_id,
                tipo_venda: d.tipo_venda,
                movimenta_estoque: d.movimenta_estoque,
                status: d.status,
                data_emissao: d.data_emissao || d.data_criacao,
                cliente_nome: d.entidade?.nome,
                tabela_nome: d.tabelas_preco?.nome,
                total: d.pedido_itens?.reduce((acc: number, item: any) => acc + Number(item.subtotal), 0) || 0
            })) as Pedido[];
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            // Exclui os itens do pedido primeiro para evitar erro de Foreign Key
            const { error: itemsError } = await supabase.from("pedido_itens").delete().eq("pedido_id", id);
            if (itemsError) throw itemsError;

            // Remove vínculo em lotes para não dar erro
            await supabase.from("lotes").update({ pedido_id: null }).eq("pedido_id", id);

            // Exclui apontamentos de produção vinculados diretamente ao pedido
            await supabase.from("producoes").delete().eq("pedido_id", id);

            // Depois exclui o pedido
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

    const pedidosPrincipais = pedidos?.filter(p => !p.tipo_venda.includes("PROJEÇÃO") && !p.tipo_venda.includes("VENDA PERDIDA")) || [];
    const pedidosProjecao = pedidos?.filter(p => p.tipo_venda.includes("PROJEÇÃO")) || [];
    const pedidosPerdidos = pedidos?.filter(p => p.tipo_venda.includes("VENDA PERDIDA")) || [];

    const renderTabela = (listaPedidos: Pedido[]) => {
        const listaFiltrada = listaPedidos.filter(p =>
            p.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) ||
            p.tipo_venda.toLowerCase().includes(busca.toLowerCase())
        );

        return (
            <div className="space-y-4 mt-4">
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
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        Carregando pedidos...
                                    </TableCell>
                                </TableRow>
                            ) : listaFiltrada.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        Nenhum pedido encontrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                listaFiltrada.map((pedido) => (
                                    <TableRow key={pedido.id} className="hover:bg-muted/50">
                                        <TableCell className="py-2 font-mono">
                                            {pedido.numero || '-'}
                                        </TableCell>
                                        <TableCell className="py-2">
                                            {pedido.data_emissao 
                                                ? format(new Date(pedido.data_emissao + "T12:00:00"), "dd/MM/yyyy") 
                                                : format(new Date(pedido.data_criacao), "dd/MM/yyyy")}
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
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Pedidos</h1>
                    <p className="text-muted-foreground mt-1">
                        Gerenciamento de pedidos de vendas
                    </p>
                </div>
                <div className="flex gap-2">
                    <DialogImportarExcelIa />
                    <DialogImportarPdfIa />
                    <Button onClick={() => navigate("/pedidos/novo")}>
                        <Plus className="mr-2 h-4 w-4" /> Novo Pedido
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="lista" className="w-full space-y-4">
                <TabsList>
                    <TabsTrigger value="lista">Vendas e Orçamentos</TabsTrigger>
                    <TabsTrigger value="projecoes">Projeções</TabsTrigger>
                    <TabsTrigger value="perdidas">Vendas Perdidas</TabsTrigger>
                </TabsList>

                <TabsContent value="lista" className="mt-0">
                    {renderTabela(pedidosPrincipais)}
                </TabsContent>
                
                <TabsContent value="projecoes" className="mt-0">
                    {renderTabela(pedidosProjecao)}
                </TabsContent>
                
                <TabsContent value="perdidas" className="mt-0">
                    {renderTabela(pedidosPerdidos)}
                </TabsContent>
        </Tabs>
        </div>
    );
}
