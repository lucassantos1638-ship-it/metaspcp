import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Plus, Trash2, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";

interface ProdutoTabela {
    id: string; // The item id inside the price table
    produto_id: string;
    preco: number;
    produto_nome: string;
    produto_sku?: string;
}

interface PedidoItem {
    produto_id: string;
    produto_nome: string;
    produto_sku?: string;
    quantidade: number;
    preco_unitario: number;
    tipo_desconto: 'percentual' | 'valor';
    desconto: number;
    subtotal: number;
}

const calcularSubtotal = (
    quantidade: number,
    preco: number,
    tipoDesc: 'percentual' | 'valor',
    descValor: number
) => {
    let sub = quantidade * preco;
    if (tipoDesc === 'percentual') {
        const descAmt = sub * (descValor / 100);
        sub -= descAmt;
    } else {
        sub -= descValor;
    }
    return sub < 0 ? 0 : sub;
};

export default function NovoPedido() {
    const empresaId = useEmpresaId();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { id } = useParams();
    const isEditing = !!id;

    const [clienteId, setClienteId] = useState("");
    const [tabelaPrecoId, setTabelaPrecoId] = useState("");
    const [tipoVenda, setTipoVenda] = useState("[1] - VENDA");
    const [movimentaEstoque, setMovimentaEstoque] = useState(true);
    const [observacao, setObservacao] = useState("");
    const [numero, setNumero] = useState("");
    const [dataEmissao, setDataEmissao] = useState(() => new Date().toISOString().split('T')[0]);

    // Items state
    const [itens, setItens] = useState<PedidoItem[]>([]);

    // Add Item Form State
    const [produtoSelecionadoId, setProdutoSelecionadoId] = useState("");
    const [quantidade, setQuantidade] = useState<string>("1");
    // Preco is pulled automatically from the table
    const [descontoGlobalTipo, setDescontoGlobalTipo] = useState<'percentual' | 'valor'>('percentual');
    const [descontoGlobal, setDescontoGlobal] = useState<string>("0");

    const { data: pedidoData, isLoading: isLoadingPedido } = useQuery({
        queryKey: ["pedido", id],
        enabled: isEditing && !!empresaId,
        queryFn: async () => {
            const { data: pedido, error } = await supabase
                .from("pedidos")
                .select("*")
                .eq("id", id)
                .single();
            if (error) throw error;

            const { data: itensData, error: itensError } = await supabase
                .from("pedido_itens")
                .select("*, produtos(nome, sku)")
                .eq("pedido_id", id);

            if (itensError) throw itensError;
            return { pedido, itensData };
        }
    });

    useEffect(() => {
        if (pedidoData) {
            setClienteId(pedidoData.pedido.cliente_id);
            setTabelaPrecoId(pedidoData.pedido.tabela_preco_id);
            setTipoVenda(pedidoData.pedido.tipo_venda);
            setMovimentaEstoque(pedidoData.pedido.movimenta_estoque);
            setObservacao(pedidoData.pedido.observacao || "");
            setNumero(pedidoData.pedido.numero || "");
            setItens(pedidoData.itensData.map((i: any) => ({
                produto_id: i.produto_id,
                produto_nome: i.produtos?.nome,
                produto_sku: i.produtos?.sku,
                quantidade: i.quantidade,
                preco_unitario: i.preco_unitario,
                tipo_desconto: i.tipo_desconto || 'percentual',
                desconto: i.desconto || 0,
                subtotal: calcularSubtotal(
                    i.quantidade,
                    i.preco_unitario,
                    i.tipo_desconto || 'percentual',
                    i.desconto || 0
                )
            })));
        }
    }, [pedidoData]);

    const { data: proximoNumero } = useQuery({
        queryKey: ["proximo_numero_pedido", empresaId],
        enabled: !isEditing && !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("pedidos")
                .select("numero")
                .eq("empresa_id", empresaId)
                .not("numero", "is", null)
                .order("data_criacao", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            let nextNum = 1;
            if (data && data.numero) {
                // Remove non-digits and parse
                const onlyNumbers = data.numero.replace(/\D/g, '');
                if (onlyNumbers) {
                    nextNum = parseInt(onlyNumbers, 10) + 1;
                }
            }
            return String(nextNum).padStart(5, '0');
        }
    });

    useEffect(() => {
        if (!isEditing && proximoNumero && !numero) {
            setNumero(proximoNumero);
        }
    }, [proximoNumero, isEditing, numero]);

    const { data: clientes } = useQuery({
        queryKey: ["clientes", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("entidade")
                .select("id, nome, cpf_cnpj")
                .eq("empresa_id", empresaId)
                .eq("tipo", "cliente")
                .order("nome");
            if (error) throw error;
            return data;
        },
    });

    const { data: tabelasPreco } = useQuery({
        queryKey: ["tabelas_preco_ativas", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tabelas_preco")
                .select("id, nome")
                .eq("empresa_id", empresaId)
                .eq("ativo", true)
                .order("nome");
            if (error) throw error;
            return data;
        },
    });

    const { data: produtosDaTabela } = useQuery({
        queryKey: ["produtos_tabela", tabelaPrecoId],
        enabled: !!tabelaPrecoId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tabelas_preco_itens")
                .select(`
                    id, 
                    produto_id, 
                    preco,
                    produtos!inner(nome, sku)
                `)
                .eq("tabela_preco_id", tabelaPrecoId);

            if (error) throw error;

            return data.map((d: any) => ({
                id: d.id,
                produto_id: d.produto_id,
                preco: d.preco,
                produto_nome: d.produtos?.nome,
                produto_sku: d.produtos?.sku,
            })) as ProdutoTabela[];
        },
    });

    useEffect(() => {
        // Se a tabela mudar, talvez seja bom avisar que os itens serão resetados ou já resetar
        // Por ora, limpamos os itens se mudar a tabela de preços, pois os preços serão outros.
        if (itens.length > 0 && !isEditing) {
            toast.warning("Tabela de preços alterada. Os itens selecionados serão recalculados ou perdidos caso queira alterar, mas por simplicidade, recomendo limpá-los.");
        }
    }, [tabelaPrecoId]);

    const parseStatusFromTipoVenda = (tipo: string) => {
        if (tipo.includes("VENDA")) return "VENDA";
        if (tipo.includes("ORÇAMENTO")) return "ORÇAMENTO";
        if (tipo.includes("BONIFICAÇÃO")) return "BONIFICAÇÃO";
        return "ORÇAMENTO";
    };

    const handleAddItem = () => {
        if (!produtoSelecionadoId) {
            toast.error("Selecione um produto.");
            return;
        }

        const qtd = parseFloat(quantidade.replace(",", "."));
        if (isNaN(qtd) || qtd <= 0) {
            toast.error("Quantidade inválida.");
            return;
        }

        const produtoTabela = produtosDaTabela?.find(p => p.produto_id === produtoSelecionadoId);
        if (!produtoTabela) {
            toast.error("Produto não encontrado na tabela de preços.");
            return;
        }

        const parsedDescLocal = parseFloat(descontoGlobal.replace(",", "."));
        const descLocalValido = isNaN(parsedDescLocal) || parsedDescLocal < 0 ? 0 : parsedDescLocal;

        // Verifica se o produto já existe na lista, se sim, soma a quantidade
        setItens(prev => {
            const existing = prev.find(i => i.produto_id === produtoSelecionadoId);
            if (existing) {
                return prev.map(i => {
                    if (i.produto_id === produtoSelecionadoId) {
                        const newQtd = i.quantidade + qtd;
                        return {
                            ...i,
                            quantidade: newQtd,
                            subtotal: calcularSubtotal(newQtd, i.preco_unitario, i.tipo_desconto, i.desconto)
                        };
                    }
                    return i;
                });
            }
            return [...prev, {
                produto_id: produtoTabela.produto_id,
                produto_nome: produtoTabela.produto_nome,
                produto_sku: produtoTabela.produto_sku,
                quantidade: qtd,
                preco_unitario: produtoTabela.preco,
                tipo_desconto: descontoGlobalTipo,
                desconto: descLocalValido,
                subtotal: calcularSubtotal(qtd, produtoTabela.preco, descontoGlobalTipo, descLocalValido)
            }];
        });

        // Limpa formulário de item
        setProdutoSelecionadoId("");
        setQuantidade("1");
    };

    const handleRemoveItem = (produtoId: string) => {
        setItens(prev => prev.filter(i => i.produto_id !== produtoId));
    };

    const handleUpdateItemDiscount = (produtoId: string, campo: 'tipo_desconto' | 'desconto', valor: any) => {
        setItens(prev => prev.map(item => {
            if (item.produto_id === produtoId) {
                const newItem = { ...item, [campo]: valor };
                const descNum = typeof newItem.desconto === 'string' ? parseFloat(String(newItem.desconto).replace(',', '.')) : newItem.desconto;
                const descValido = isNaN(descNum) || descNum < 0 ? 0 : descNum;
                newItem.desconto = descValido;
                newItem.subtotal = calcularSubtotal(newItem.quantidade, newItem.preco_unitario, newItem.tipo_desconto, descValido);
                return newItem;
            }
            return item;
        }));
    };

    const totalPedido = itens.reduce((acc, item) => acc + item.subtotal, 0);

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!clienteId || !tabelaPrecoId) throw new Error("Cliente e Tabela de Preço são obrigatórios");
            if (itens.length === 0) throw new Error("Adicione pelo menos um item ao pedido");

            const statusEnum = parseStatusFromTipoVenda(tipoVenda);

            let pedidoId = id;

            if (isEditing) {
                const { error: updateError } = await supabase
                    .from("pedidos")
                    .update({
                        data_emissao: dataEmissao,
                        numero: numero || null,
                        cliente_id: clienteId,
                        tabela_preco_id: tabelaPrecoId,
                        tipo_venda: tipoVenda,
                        movimenta_estoque: movimentaEstoque,
                        observacao: observacao,
                        status: statusEnum
                    })
                    .eq("id", id);

                if (updateError) throw updateError;

                const { error: delError } = await supabase.from("pedido_itens").delete().eq("pedido_id", id);
                if (delError) throw delError;

            } else {
                const { data: pedidoData, error: pedidoError } = await supabase
                    .from("pedidos")
                    .insert([{
                        empresa_id: empresaId,
                        data_emissao: dataEmissao,
                        numero: numero || null,
                        cliente_id: clienteId,
                        tabela_preco_id: tabelaPrecoId,
                        tipo_venda: tipoVenda,
                        movimenta_estoque: movimentaEstoque,
                        observacao: observacao,
                        status: statusEnum
                    }])
                    .select("id")
                    .single();

                if (pedidoError) throw pedidoError;
                pedidoId = pedidoData.id;
            }

            const itensParaInserir = itens.map(item => ({
                pedido_id: pedidoId,
                produto_id: item.produto_id,
                quantidade: item.quantidade,
                preco_unitario: item.preco_unitario,
                tipo_desconto: item.tipo_desconto,
                desconto: item.desconto
            }));

            const { error: itensError } = await supabase
                .from("pedido_itens")
                .insert(itensParaInserir);

            if (itensError) throw itensError;
        },
        onSuccess: () => {
            toast.success("Pedido salvo com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["pedidos"] });
            navigate("/pedidos");
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    const handleSave = () => {
        saveMutation.mutate();
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center space-x-4 mb-2">
                <Button variant="ghost" size="icon" onClick={() => navigate("/pedidos")}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground">
                        {isEditing ? "Editar Pedido" : "Novo Pedido"}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {isEditing ? "Atualize as informações do pedido" : "Crie um novo orçamento ou venda"}
                    </p>
                </div>
            </div>

            {isLoadingPedido ? (
                <div className="flex justify-center p-8 text-muted-foreground">Carregando dados do pedido...</div>
            ) : (
                <>
                    <div className="bg-card border rounded-lg shadow-sm p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Linha 1 */}
                            <div className="space-y-2">
                                <Label>Data de Emissão</Label>
                                <Input
                                    type="date"
                                    value={dataEmissao}
                                    onChange={e => setDataEmissao(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Número do Pedido</Label>
                                <Input
                                    value={numero}
                                    onChange={e => setNumero(e.target.value)}
                                    placeholder="Automático (editar se necessário)"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo Venda</Label>
                                <Select value={tipoVenda} onValueChange={setTipoVenda}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="[1] - VENDA">[1] - VENDA</SelectItem>
                                        <SelectItem value="[2] - ORÇAMENTO">[2] - ORÇAMENTO</SelectItem>
                                        <SelectItem value="[3] - BONIFICAÇÃO">[3] - BONIFICAÇÃO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Linha 2 */}
                            <div className="space-y-2">
                                <Label>Cliente *</Label>
                                <Select value={clienteId} onValueChange={setClienteId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um cliente..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clientes?.map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.cpf_cnpj ? `[${c.cpf_cnpj}] ` : ""}{c.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Tabela de Preço *</Label>
                                <Select value={tabelaPrecoId} onValueChange={setTabelaPrecoId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a tabela..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {tabelasPreco?.map(t => (
                                            <SelectItem key={t.id} value={t.id}>
                                                {t.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Linha 3 */}
                            <div className="md:col-span-2 flex items-center space-x-2 pt-2">
                                <Switch
                                    id="movimenta-estoque"
                                    checked={movimentaEstoque}
                                    onCheckedChange={setMovimentaEstoque}
                                />
                                <Label htmlFor="movimenta-estoque" className="cursor-pointer">Movimenta Estoque</Label>
                            </div>

                            {/* Linha 4 */}
                            <div className="md:col-span-2 space-y-2">
                                <Label>Observação da Venda</Label>
                                <Input
                                    value={observacao}
                                    onChange={e => setObservacao(e.target.value)}
                                    placeholder="Informações adicionais se necessário..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* SEÇÃO DE ITENS */}
                    <div className="bg-card border rounded-lg shadow-sm p-6 space-y-4">
                        <h2 className="text-xl font-bold border-b pb-2">Itens do Pedido</h2>

                        {tabelaPrecoId ? (
                            <div className="grid grid-cols-12 gap-4 items-end bg-muted/30 p-4 rounded-lg border">
                                <div className="col-span-12 sm:col-span-6 space-y-2">
                                    <Label>Produto</Label>
                                    <Select value={produtoSelecionadoId} onValueChange={setProdutoSelecionadoId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um produto cadastrado na tabela..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {produtosDaTabela?.map(p => (
                                                <SelectItem key={p.produto_id} value={p.produto_id}>
                                                    {p.produto_sku ? `[${p.produto_sku}] ` : ""}{p.produto_nome} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.preco)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-6 sm:col-span-2 space-y-2">
                                    <Label>Qtd</Label>
                                    <Input
                                        type="number"
                                        min="0.001"
                                        step="1"
                                        value={quantidade}
                                        onChange={e => setQuantidade(e.target.value)}
                                    />
                                </div>
                                <div className="col-span-6 sm:col-span-2 space-y-2">
                                    <Label>Tipo Desc.</Label>
                                    <Select value={descontoGlobalTipo} onValueChange={(val: any) => setDescontoGlobalTipo(val)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentual">% Perc.</SelectItem>
                                            <SelectItem value="valor">$ Valor</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-6 sm:col-span-2 space-y-2">
                                    <Label>Desconto</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={descontoGlobal}
                                        onChange={e => setDescontoGlobal(e.target.value)}
                                    />
                                </div>
                                <div className="col-span-12 sm:col-span-12 mt-2">
                                    <Button onClick={handleAddItem} className="w-full sm:w-auto mt-2">
                                        <Plus className="h-4 w-4 mr-1" /> Adicionar Produto (Salva o desconto na linha)
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm italic py-2">
                                Selecione uma Tabela de Preço acima para visualizar e adicionar produtos.
                            </p>
                        )}

                        {/* Lista de Itens */}
                        <div className="overflow-x-auto rounded-md border mt-4">
                            <Table>
                                <TableHeader className="bg-secondary/50">
                                    <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="text-right">Qtd</TableHead>
                                        <TableHead className="text-right">Preço Unit.</TableHead>
                                        <TableHead className="text-center">Tipo Desc.</TableHead>
                                        <TableHead className="text-right">Desconto</TableHead>
                                        <TableHead className="text-right">Subtotal</TableHead>
                                        <TableHead className="w-[80px] text-center"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {itens.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                                                Nenhum item adicionado ao pedido
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        itens.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-medium">
                                                    {item.produto_sku ? `[${item.produto_sku}] ` : ""}{item.produto_nome}
                                                </TableCell>
                                                <TableCell className="text-right">{item.quantidade}</TableCell>
                                                <TableCell className="text-right">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Select
                                                        value={item.tipo_desconto}
                                                        onValueChange={(val: any) => handleUpdateItemDiscount(item.produto_id, 'tipo_desconto', val)}
                                                    >
                                                        <SelectTrigger className="w-[80px] h-8 text-xs mx-auto">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="percentual" className="text-xs">%</SelectItem>
                                                            <SelectItem value="valor" className="text-xs">$</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="h-8 w-[80px] text-right ml-auto"
                                                        value={item.desconto === 0 ? '' : item.desconto}
                                                        onChange={e => handleUpdateItemDiscount(item.produto_id, 'desconto', e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemoveItem(item.produto_id)}
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

                        <div className="flex justify-end pt-4 font-bold text-xl">
                            Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPedido)}
                        </div>
                    </div>

                    {/* RODAPÉ DO PEDIDO */}
                    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg justify-end mt-8 border">
                        <Button variant="outline" onClick={() => navigate("/pedidos")} disabled={saveMutation.isPending}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? "Salvando..." : (isEditing ? "Atualizar Pedido (F2)" : "Salvar Pedido (F2)")}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
