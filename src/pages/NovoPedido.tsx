import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useProdutos } from "@/hooks/useProdutos";
import { Plus, Trash2, ArrowLeft, Search, Check, ChevronsUpDown, CheckCircle, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DialogSelecionarCoresPedido } from "@/components/pedidos/DialogSelecionarCoresPedido";

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
    cor?: string;
    codigo_cor?: string;
    quantidade: number;
    quantidade_falta?: number;
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

    const location = useLocation();
    const pedidoImportado = location.state?.pedidoImportado;

    const [clienteId, setClienteId] = useState(pedidoImportado?.clienteId || "");
    const [tabelaPrecoId, setTabelaPrecoId] = useState("");
    const [tipoVenda, setTipoVenda] = useState("[1] - VENDA");
    const [movimentaEstoque, setMovimentaEstoque] = useState(true);
    const [observacao, setObservacao] = useState(pedidoImportado?.observacoes || "");
    const [numero, setNumero] = useState(pedidoImportado?.numeroPedido || "");
    const [dataEmissao, setDataEmissao] = useState(() => new Date().toISOString().split('T')[0]);
    const [dataEntrega, setDataEntrega] = useState("");
    const [statusPedido, setStatusPedido] = useState<string>("VENDA");

    // Items state
    const [itens, setItens] = useState<PedidoItem[]>(pedidoImportado?.itens?.map((i: any) => ({
        produto_id: i.produto_id,
        produto_nome: i.produto_nome || "Item Importado",
        produto_sku: i.produto_sku || "",
        cor: i.cor || "",
        codigo_cor: i.codigo_cor || "",
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario || 0,
        tipo_desconto: 'percentual',
        desconto: 0,
        subtotal: i.quantidade * (i.preco_unitario || 0)
    })) || []);

    // Add Item Form State
    const [produtoSelecionadoId, setProdutoSelecionadoId] = useState("");
    const [produtoPopoverOpen, setProdutoPopoverOpen] = useState(false);
    const [quantidade, setQuantidade] = useState<string>("1");
    // Preco is pulled automatically from the table
    const [descontoGlobalTipo, setDescontoGlobalTipo] = useState<'percentual' | 'valor'>('percentual');
    const [descontoGlobal, setDescontoGlobal] = useState<string>("0");
    const [corSelecionada, setCorSelecionada] = useState<string>("");
    const [coresProduto, setCoresProduto] = useState<any[]>([]);
    const [modalCoresOpen, setModalCoresOpen] = useState(false);

    useEffect(() => {
        if (produtoSelecionadoId) {
            const p = todosProdutos?.find(prod => prod.id === produtoSelecionadoId);
            let parsed: any[] = [];
            if (p && p.produto_cores) {
                parsed = Array.isArray(p.produto_cores) ? [...p.produto_cores] : [];
            }

            if (empresaId) {
                const invStr = localStorage.getItem(`estoque_cores_${empresaId}`);
                if (invStr) {
                    try {
                        const inv = JSON.parse(invStr);
                        const prodInv = inv.filter((i: any) => i.produtoId === produtoSelecionadoId);
                        prodInv.forEach((pi: any) => {
                            if (pi.cor && pi.cor !== "Única" && pi.cor !== "Sem cor definida") {
                                if (!parsed.find((c: any) => c.descricao === pi.cor)) {
                                    parsed.push({ descricao: pi.cor, codigo: null });
                                }
                            }
                        });
                    } catch (e) {}
                }
            }
            setCoresProduto(parsed);
        } else {
            setCoresProduto([]);
        }
        setCorSelecionada("");
    }, [produtoSelecionadoId, todosProdutos, empresaId]);

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
            setDataEntrega(pedidoData.pedido.data_entrega || "");
            setStatusPedido(pedidoData.pedido.status || "VENDA");

            // Carrega quantidades faltantes salvas localmente para este pedido se houver
            let faltasSalvas: Record<string, number> = {};
            if (id) {
                try {
                    const str = localStorage.getItem(`pedido_faltas_${id}`);
                    if (str) faltasSalvas = JSON.parse(str);
                } catch (e) {}
            }

            setItens(pedidoData.itensData.map((i: any) => {
                const key = `${i.produto_id}_${i.cor || ""}`;
                const faltaVal = faltasSalvas[key] !== undefined ? faltasSalvas[key] : (i.quantidade || 0);
                return {
                    produto_id: i.produto_id,
                    produto_nome: i.produtos?.nome,
                    produto_sku: i.produtos?.sku,
                    quantidade: i.quantidade,
                    quantidade_falta: faltaVal,
                    preco_unitario: i.preco_unitario,
                    cor: i.cor || "",
                    codigo_cor: i.codigo_cor || "",
                    tipo_desconto: i.tipo_desconto || 'percentual',
                    desconto: i.desconto || 0,
                    subtotal: calcularSubtotal(
                        i.quantidade,
                        i.preco_unitario,
                        i.tipo_desconto || 'percentual',
                        i.desconto || 0
                    )
                };
            }));
        }
    }, [pedidoData, id]);

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

    const { data: todosProdutos } = useProdutos(true);

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
        if (tipo.includes("VENDA PERDIDA")) return "VENDA PERDIDA";
        if (tipo.includes("PROJEÇÃO")) return "PROJEÇÃO";
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

        let preco = 0;
        let produto_nome = "";
        let produto_sku = "";

        const produtoTabela = produtosDaTabela?.find(p => p.produto_id === produtoSelecionadoId);
        if (produtoTabela) {
            preco = produtoTabela.preco;
            produto_nome = produtoTabela.produto_nome;
            produto_sku = produtoTabela.produto_sku;
        } else {
            const prod = todosProdutos?.find(p => p.id === produtoSelecionadoId);
            if (prod) {
                preco = 0;
                produto_nome = prod.nome;
                produto_sku = prod.sku || "";
            } else {
                toast.error("Produto não encontrado.");
                return;
            }
        }

        const parsedDescLocal = parseFloat(descontoGlobal.replace(",", "."));
        const descLocalValido = isNaN(parsedDescLocal) || parsedDescLocal < 0 ? 0 : parsedDescLocal;

        // Verifica se o produto já existe na lista com a mesma cor, se sim, soma a quantidade
        setItens(prev => {
            const existing = prev.find(i => i.produto_id === produtoSelecionadoId && (i.cor || "") === corSelecionada);
            if (existing) {
                return prev.map(i => {
                    if (i.produto_id === produtoSelecionadoId && (i.cor || "") === corSelecionada) {
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
            const colorObj = coresProduto.find(c => c.descricao === corSelecionada);
            return [...prev, {
                produto_id: produtoSelecionadoId,
                produto_nome: produto_nome,
                produto_sku: produto_sku,
                cor: corSelecionada,
                codigo_cor: colorObj?.codigo || "",
                quantidade: qtd,
                preco_unitario: preco,
                tipo_desconto: descontoGlobalTipo,
                desconto: descLocalValido,
                subtotal: calcularSubtotal(qtd, preco, descontoGlobalTipo, descLocalValido)
            }];
        });

        // Limpa formulário de item
        setProdutoSelecionadoId("");
        setQuantidade("1");
        setCorSelecionada("");
    };

    const handleConfirmarCoresModal = (novosItens: any[]) => {
        if (!novosItens || novosItens.length === 0) return;

        setItens(prev => {
            let atualizados = [...prev];

            novosItens.forEach(novo => {
                const index = atualizados.findIndex(
                    i => i.produto_id === novo.produto_id && (i.cor || "") === (novo.cor || "")
                );

                if (index >= 0) {
                    const itemExistente = atualizados[index];
                    const novaQtd = Number(itemExistente.quantidade) + Number(novo.quantidade);
                    const subtotal = calcularSubtotal(
                        novaQtd,
                        novo.preco_unitario,
                        novo.tipo_desconto,
                        novo.desconto
                    );

                    atualizados[index] = {
                        ...itemExistente,
                        quantidade: novaQtd,
                        quantidade_falta: (itemExistente.quantidade_falta !== undefined ? itemExistente.quantidade_falta : itemExistente.quantidade) + Number(novo.quantidade),
                        preco_unitario: novo.preco_unitario,
                        tipo_desconto: novo.tipo_desconto,
                        desconto: novo.desconto,
                        subtotal
                    };
                } else {
                    const subtotal = calcularSubtotal(
                        novo.quantidade,
                        novo.preco_unitario,
                        novo.tipo_desconto,
                        novo.desconto
                    );

                    atualizados.push({
                        produto_id: novo.produto_id,
                        produto_nome: novo.produto_nome,
                        produto_sku: novo.produto_sku,
                        cor: novo.cor,
                        codigo_cor: novo.codigo_cor,
                        quantidade: novo.quantidade,
                        quantidade_falta: novo.quantidade,
                        preco_unitario: novo.preco_unitario,
                        tipo_desconto: novo.tipo_desconto,
                        desconto: novo.desconto,
                        subtotal
                    });
                }
            });

            return atualizados;
        });

        const totalQtd = novosItens.reduce((acc, curr) => acc + curr.quantidade, 0);
        toast.success(`${totalQtd} itens adicionados ao pedido!`);
    };

    const handleRemoveItem = (produtoId: string, cor: string = "") => {
        setItens(prev => prev.filter(i => !(i.produto_id === produtoId && (i.cor || "") === cor)));
    };

    const handleUpdateItemFalta = (produtoId: string, cor: string = "", valorStr: string) => {
        const val = valorStr === "" ? 0 : parseFloat(valorStr.replace(',', '.'));
        const valFinal = isNaN(val) || val < 0 ? 0 : val;
        setItens(prev => {
            const updated = prev.map(item => {
                if (item.produto_id === produtoId && (item.cor || "") === cor) {
                    return { ...item, quantidade_falta: valFinal };
                }
                return item;
            });
            if (id) {
                try {
                    const faltasMap: Record<string, number> = {};
                    updated.forEach(it => {
                        const key = `${it.produto_id}_${it.cor || ""}`;
                        faltasMap[key] = it.quantidade_falta !== undefined ? Number(it.quantidade_falta) : (it.quantidade || 0);
                    });
                    localStorage.setItem(`pedido_faltas_${id}`, JSON.stringify(faltasMap));
                    window.dispatchEvent(new Event("storage"));
                } catch (e) {}
            }
            return updated;
        });
    };

    const handleUpdateItemDiscount = (produtoId: string, cor: string = "", campo: 'tipo_desconto' | 'desconto', valor: any) => {
        setItens(prev => prev.map(item => {
            if (item.produto_id === produtoId && (item.cor || "") === cor) {
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

    const persistFaltas = (pedidoId: string) => {
        if (!pedidoId) return;
        try {
            const faltasMap: Record<string, number> = {};
            itens.forEach(it => {
                const key = `${it.produto_id}_${it.cor || ""}`;
                faltasMap[key] = it.quantidade_falta !== undefined ? Number(it.quantidade_falta) : (it.quantidade || 0);
            });
            localStorage.setItem(`pedido_faltas_${pedidoId}`, JSON.stringify(faltasMap));
            window.dispatchEvent(new Event("storage"));
        } catch (e) {}
    };

    const saveMutation = useMutation({
        mutationFn: async (novoStatusOverride?: string) => {
            if (itens.length === 0) throw new Error("Adicione pelo menos um item ao pedido");

            const statusEnum = novoStatusOverride || statusPedido || parseStatusFromTipoVenda(tipoVenda);

            let pedidoId = id;

            if (isEditing) {
                const { error: updateError } = await supabase
                    .from("pedidos")
                    .update({
                        data_emissao: dataEmissao,
                        numero: numero || null,
                        cliente_id: clienteId || null,
                        tabela_preco_id: tabelaPrecoId || null,
                        tipo_venda: tipoVenda,
                        movimenta_estoque: movimentaEstoque,
                        observacao: observacao,
                        data_entrega: dataEntrega || null,
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
                        cliente_id: clienteId || null,
                        tabela_preco_id: tabelaPrecoId || null,
                        tipo_venda: tipoVenda,
                        movimenta_estoque: movimentaEstoque,
                        observacao: observacao,
                        data_entrega: dataEntrega || null,
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
                cor: item.cor || null,
                codigo_cor: item.codigo_cor || null,
                tipo_desconto: item.tipo_desconto,
                desconto: item.desconto
            }));

            const { error: itensError } = await supabase
                .from("pedido_itens")
                .insert(itensParaInserir);

            if (itensError) throw itensError;

            if (pedidoId) {
                persistFaltas(pedidoId);
            }
        },
        onSuccess: () => {
            toast.success("Pedido salvo com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["pedidos"] });
            queryClient.invalidateQueries({ queryKey: ["todas-vendas-programacao"] });
            navigate("/pedidos");
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    const handleFinalizarPedido = async () => {
        const isFinalizado = statusPedido === "FINALIZADO";
        const novoStatus = isFinalizado ? "VENDA" : "FINALIZADO";
        
        // Se estiver finalizando, preenche falta = 0 automaticamente se o usuário desejar
        if (!isFinalizado) {
            setItens(prev => prev.map(item => ({
                ...item,
                quantidade_falta: 0
            })));
        }
        
        setStatusPedido(novoStatus);
        
        if (id) {
            try {
                const faltasMap: Record<string, number> = {};
                itens.forEach(it => {
                    const key = `${it.produto_id}_${it.cor || ""}`;
                    faltasMap[key] = !isFinalizado ? 0 : (it.quantidade_falta !== undefined ? it.quantidade_falta : it.quantidade);
                });
                localStorage.setItem(`pedido_faltas_${id}`, JSON.stringify(faltasMap));
                window.dispatchEvent(new Event("storage"));

                const { error } = await supabase
                    .from("pedidos")
                    .update({ status: novoStatus })
                    .eq("id", id);
                if (error) throw error;
                queryClient.invalidateQueries({ queryKey: ["pedidos"] });
                queryClient.invalidateQueries({ queryKey: ["todas-vendas-programacao"] });
                toast.success(!isFinalizado ? "Pedido marcado como FINALIZADO com sucesso!" : "Pedido reaberto com sucesso!");
            } catch (err: any) {
                toast.error("Erro ao alterar status: " + err.message);
            }
        } else {
            toast.info(!isFinalizado ? "Status alterado para FINALIZADO. Salve o pedido para confirmar." : "Status alterado para VENDA.");
        }
    };

    const handleSave = () => {
        saveMutation.mutate();
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/pedidos")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground">
                                {isEditing ? "Editar Pedido" : "Novo Pedido"}
                            </h1>
                            {statusPedido === "FINALIZADO" ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 text-xs px-2.5 py-0.5">
                                    <CheckCircle className="w-3.5 h-3.5" /> FINALIZADO
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-slate-600 border-slate-300 text-xs px-2.5 py-0.5">
                                    {statusPedido}
                                </Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground mt-1">
                            {isEditing ? "Atualize as informações do pedido" : "Crie um novo orçamento ou venda"}
                        </p>
                    </div>
                </div>

                {/* BOTÃO PEDIDO FINALIZADO NO TOPO */}
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant={statusPedido === "FINALIZADO" ? "outline" : "default"}
                        className={cn(
                            "font-semibold transition-all shadow-sm",
                            statusPedido === "FINALIZADO"
                                ? "border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        )}
                        onClick={handleFinalizarPedido}
                    >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {statusPedido === "FINALIZADO" ? "Reabrir Pedido" : "Finalizar Pedido"}
                    </Button>
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
                                <Label>Data de Entrega</Label>
                                <Input
                                    type="date"
                                    value={dataEntrega}
                                    onChange={e => setDataEntrega(e.target.value)}
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
                                        <SelectItem value="[4] - VENDA PERDIDA">[4] - VENDA PERDIDA</SelectItem>
                                        <SelectItem value="[5] - PROJEÇÃO">[5] - PROJEÇÃO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Linha 2 */}
                            <div className="space-y-2">
                                <Label>Cliente</Label>
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
                                <Label>Tabela de Preço</Label>
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
                                <div className="col-span-12 sm:col-span-4 space-y-2">
                                    <Label>Produto</Label>
                                    <Popover open={produtoPopoverOpen} onOpenChange={setProdutoPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={produtoPopoverOpen}
                                                className="w-full justify-between font-normal text-left truncate"
                                            >
                                                {produtoSelecionadoId
                                                    ? (() => {
                                                        const p = todosProdutos?.find((prod) => prod.id === produtoSelecionadoId);
                                                        return p ? `${p.sku ? `[${p.sku}] ` : ""}${p.nome}` : "Selecione um produto...";
                                                    })()
                                                    : "Selecione um produto..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Pesquisar por código ou nome..." />
                                                <CommandList>
                                                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                                    <CommandGroup>
                                                        {todosProdutos?.map((p) => {
                                                            const pt = produtosDaTabela?.find(t => t.produto_id === p.id);
                                                            const precoDisplay = pt ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pt.preco) : "(Sem preço na tabela)";
                                                            return (
                                                                <CommandItem
                                                                    key={p.id}
                                                                    value={`${p.sku || ""} ${p.nome}`}
                                                                    onSelect={() => {
                                                                        setProdutoSelecionadoId(p.id);
                                                                        setProdutoPopoverOpen(false);
                                                                        setTimeout(() => {
                                                                            setModalCoresOpen(true);
                                                                        }, 80);
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4 flex-shrink-0",
                                                                            produtoSelecionadoId === p.id ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <span className="truncate">{p.sku ? `[${p.sku}] ` : ""}{p.nome} - {precoDisplay}</span>
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="col-span-12 sm:col-span-3 space-y-2">
                                    <Label>Cor</Label>
                                    <Select 
                                        value={corSelecionada || undefined} 
                                        onValueChange={(val) => setCorSelecionada(val || "")} 
                                        disabled={!produtoSelecionadoId}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={coresProduto.length > 0 ? "Selecione a cor..." : "Sem cores"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Única">Única</SelectItem>
                                            {coresProduto
                                                .filter((c: any) => c && c.descricao && String(c.descricao).trim() !== "" && String(c.descricao).trim().toLowerCase() !== "única" && String(c.descricao).trim().toLowerCase() !== "unica")
                                                .map((c: any, index: number) => (
                                                    <SelectItem key={`${c.descricao}_${index}`} value={String(c.descricao).trim()}>
                                                        {c.codigo ? `[${c.codigo}] ` : ""}{c.descricao}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-6 sm:col-span-1 space-y-2">
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
                                <div className="col-span-12 sm:col-span-12 mt-2 flex flex-wrap gap-2.5 items-center">
                                    <Button 
                                        type="button" 
                                        onClick={() => setModalCoresOpen(true)} 
                                        disabled={!produtoSelecionadoId}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                                    >
                                        <Palette className="h-4 w-4 mr-1.5" /> Abrir Grade de Cores e Quantidades
                                    </Button>
                                    <Button onClick={handleAddItem} variant="outline" className="text-slate-700">
                                        <Plus className="h-4 w-4 mr-1" /> Adicionar Cor Individual
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm italic py-2">
                                Selecione uma Tabela de Preço acima para visualizar e adicionar produtos.
                            </p>
                        )}

                        {/* Modal de Seleção de Cores e Quantidades em Grade */}
                        {produtoSelecionadoId && (
                            <DialogSelecionarCoresPedido
                                open={modalCoresOpen}
                                onOpenChange={setModalCoresOpen}
                                produtoId={produtoSelecionadoId}
                                produtoNome={todosProdutos?.find(p => p.id === produtoSelecionadoId)?.nome || ""}
                                produtoSku={todosProdutos?.find(p => p.id === produtoSelecionadoId)?.sku || ""}
                                precoUnitario={Number(produtosDaTabela?.find(t => t.produto_id === produtoSelecionadoId)?.preco) || 0}
                                empresaId={empresaId || ""}
                                descontoPadraoTipo={descontoGlobalTipo}
                                descontoPadraoValor={parseFloat(descontoGlobal) || 0}
                                itensJaNoPedido={itens.filter(i => i.produto_id === produtoSelecionadoId)}
                                onConfirmar={handleConfirmarCoresModal}
                            />
                        )}

                        {/* Lista de Itens */}
                        <div className="overflow-x-auto rounded-md border mt-4">
                            <Table>
                                <TableHeader className="bg-secondary/50">
                                    <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead>Cód. Cor</TableHead>
                                        <TableHead>Cor</TableHead>
                                        <TableHead className="text-right">Qtd</TableHead>
                                        <TableHead className="text-center font-bold text-amber-700 bg-amber-50/60 w-[110px]">Falta</TableHead>
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
                                            <TableCell colSpan={10} className="text-center py-6 text-muted-foreground">
                                                Nenhum item adicionado ao pedido
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        itens.map((item, index) => {
                                            const faltaVal = item.quantidade_falta !== undefined ? item.quantidade_falta : item.quantidade;
                                            return (
                                                <TableRow key={index} className={statusPedido === "FINALIZADO" ? "bg-muted/20" : ""}>
                                                    <TableCell className="font-medium">
                                                        {item.produto_sku ? `[${item.produto_sku}] ` : ""}{item.produto_nome}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground font-mono">
                                                        {item.codigo_cor || "-"}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {item.cor || "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">{item.quantidade}</TableCell>
                                                    
                                                    {/* COLUNA FALTA */}
                                                    <TableCell className="text-center bg-amber-50/30">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            className={cn(
                                                                "h-8 w-[85px] text-center mx-auto font-bold",
                                                                faltaVal === 0 
                                                                    ? "text-emerald-700 bg-emerald-50/50 border-emerald-300" 
                                                                    : "text-amber-800 bg-amber-50 border-amber-300"
                                                            )}
                                                            value={item.quantidade_falta !== undefined ? item.quantidade_falta : item.quantidade}
                                                            onChange={e => handleUpdateItemFalta(item.produto_id, item.cor || "", e.target.value)}
                                                            placeholder="0"
                                                        />
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario)}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Select
                                                            value={item.tipo_desconto}
                                                            onValueChange={(val: any) => handleUpdateItemDiscount(item.produto_id, item.cor || "", 'tipo_desconto', val)}
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
                                                            onChange={e => handleUpdateItemDiscount(item.produto_id, item.cor || "", 'desconto', e.target.value)}
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
                                                            onClick={() => handleRemoveItem(item.produto_id, item.cor || "")}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
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
