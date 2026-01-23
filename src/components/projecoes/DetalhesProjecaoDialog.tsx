import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdicionarItemProjecao, useAtualizarItemProjecao, useRemoverItemProjecao, useProjecao } from "@/hooks/useProjecoes";
import { formatarCusto } from "@/lib/custoUtils";
import { Loader2, Plus, Trash2, Search, Save, Filter } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useProdutos } from "@/hooks/useProdutos";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DetalhesProjecaoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projecao: any;
}

export default function DetalhesProjecaoDialog({
    open,
    onOpenChange,
    projecao: projecaoInicial,
}: DetalhesProjecaoDialogProps) {
    // Determine ID from initial object
    const id = projecaoInicial?.id;

    // Fetch fresh data
    const { data: projecaoData, isLoading: isLoadingProjecao } = useProjecao(id);

    // Use fetched data if available, otherwise initial (or null)
    const projecao = projecaoData || projecaoInicial;

    const [adicionando, setAdicionando] = useState(false);
    const adicionarItem = useAdicionarItemProjecao();
    const removerItem = useRemoverItemProjecao();
    const atualizarItem = useAtualizarItemProjecao();

    // State for adding new item
    const [buscaProduto, setBuscaProduto] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("todos"); // todos, nome, sku
    const [produtoSelecionado, setProdutoSelecionado] = useState<any | null>(null);
    const [quantidadeNovo, setQuantidadeNovo] = useState("1");
    // Date editing state
    const [editandoData, setEditandoData] = useState(false);
    // Initialize date from projection
    const [novaData, setNovaData] = useState(projecao?.data_referencia ? format(parseISO(projecao.data_referencia), "yyyy-mm-dd") : "");

    const { data: produtos } = useProdutos();

    // Filter products for search
    const produtosFiltrados = useMemo(() => {
        if (!buscaProduto) return [];
        const termo = buscaProduto.toLowerCase();

        return produtos?.filter(p => {
            if (!p.ativo) return false;
            if (filtroTipo === "nome") return p.nome.toLowerCase().includes(termo);
            if (filtroTipo === "sku") return p.sku?.toLowerCase().includes(termo);
            // Default: check both
            return p.nome.toLowerCase().includes(termo) || p.sku?.toLowerCase().includes(termo);
        }).slice(0, 10) || [];
    }, [produtos, buscaProduto, filtroTipo]);

    if (!projecao && !projecaoInicial) return null;

    const handleAdicionar = async () => {
        if (!produtoSelecionado || !quantidadeNovo) return;

        // Use selected price based on projection setting
        const preco = projecao.tabela_preco === 'cnpj'
            ? Number(produtoSelecionado.preco_cnpj || 0)
            : Number(produtoSelecionado.preco_cpf || 0);

        await adicionarItem.mutateAsync({
            projecao_id: projecao.id,
            produto_id: produtoSelecionado.id,
            quantidade: Number(quantidadeNovo),
            valor_unitario: preco
        });

        // Reset fields but keep dialog open/ready
        setProdutoSelecionado(null);
        setQuantidadeNovo("1");
        setBuscaProduto("");
        // Focus back to search (optional)
    };

    const totalValor = projecao.itens?.reduce((acc: number, item: any) => acc + (Number(item.quantidade) * Number(item.valor_unitario)), 0) || 0;
    const totalQtde = projecao.itens?.reduce((acc: number, item: any) => acc + Number(item.quantidade), 0) || 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 border-b">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <DialogTitle className="text-2xl font-bold">{projecao.cliente_nome}</DialogTitle>
                            <div className="flex items-center gap-2 text-base text-muted-foreground">
                                <span>{projecao.data_referencia ? format(parseISO(projecao.data_referencia), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Sem data'}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-muted-foreground">Total Estimado</div>
                            <div className="text-2xl font-bold text-primary">{formatarCusto(totalValor)}</div>
                            <div className="text-xs text-muted-foreground">{totalQtde} itens</div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col p-6">

                    {adicionando ? (
                        <div className="border rounded-md p-4 bg-muted/20 mb-4 space-y-4 animate-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm">Adicionar Produto</h4>
                                <Button variant="ghost" size="sm" onClick={() => setAdicionando(false)}>Cancelar</Button>
                            </div>

                            {!produtoSelecionado ? (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                                            <SelectTrigger className="w-[140px]">
                                                <div className="flex items-center gap-2">
                                                    <Filter className="h-4 w-4" />
                                                    <SelectValue />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">Todos</SelectItem>
                                                <SelectItem value="nome">Nome</SelectItem>
                                                <SelectItem value="sku">Código (SKU)</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder={filtroTipo === 'sku' ? "Digite o código..." : "Digite o nome ou código..."}
                                                value={buscaProduto}
                                                onChange={e => setBuscaProduto(e.target.value)}
                                                className="pl-9"
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {buscaProduto && (
                                        <div className="border rounded-md mt-2 max-h-40 overflow-y-auto bg-background shadow-lg z-50">
                                            {produtosFiltrados.map(p => (
                                                <div
                                                    key={p.id}
                                                    className="p-2 hover:bg-muted cursor-pointer flex justify-between items-center text-sm"
                                                    onClick={() => setProdutoSelecionado(p)}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{p.nome}</span>
                                                        <span className="text-xs text-muted-foreground">SKU: {p.sku || '-'}</span>
                                                    </div>
                                                    <span className="font-semibold text-primary">
                                                        {formatarCusto(projecao.tabela_preco === 'cnpj' ? p.preco_cnpj : p.preco_cpf)}
                                                    </span>
                                                </div>
                                            ))}
                                            {produtosFiltrados.length === 0 && (
                                                <div className="p-2 text-center text-muted-foreground text-sm">Nenhum produto encontrado</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-end gap-4">
                                    <div className="flex-1 space-y-2">
                                        <Label>Produto</Label>
                                        <div className="flex items-center justify-between border p-2 rounded-md bg-background">
                                            <div>
                                                <div className="font-medium">{produtoSelecionado.nome}</div>
                                                <div className="text-xs text-muted-foreground">SKU: {produtoSelecionado.sku}</div>
                                            </div>
                                            <Button variant="ghost" size="xs" onClick={() => setProdutoSelecionado(null)}>Trocar</Button>
                                        </div>
                                    </div>
                                    <div className="w-24 space-y-2">
                                        <Label>Qtd</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={quantidadeNovo}
                                            onChange={e => setQuantidadeNovo(e.target.value)}
                                        />
                                    </div>
                                    <Button onClick={handleAdicionar} disabled={adicionarItem.isPending}>
                                        {adicionarItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                        Adicionar
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex justify-end mb-4">
                            <Button onClick={() => setAdicionando(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar Produto
                            </Button>
                        </div>
                    )}

                    <div className="border rounded-md flex-1 relative overflow-hidden">
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader className="sticky top-0 bg-card z-10">
                                    <TableRow>
                                        <TableHead className="w-24">SKU</TableHead>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="text-right w-24">Qtd</TableHead>
                                        <TableHead className="text-right w-32">Valor Un.</TableHead>
                                        <TableHead className="text-right w-32">Total</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {projecao.itens?.map((item: any) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-muted-foreground font-mono text-xs">
                                                {item.produto?.sku || '-'}
                                            </TableCell>
                                            <TableCell className="font-medium">{item.produto?.nome}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Input
                                                        className="h-7 w-20 text-right"
                                                        type="number"
                                                        defaultValue={item.quantidade}
                                                        onBlur={(e) => {
                                                            const val = Number(e.target.value);
                                                            if (val !== item.quantidade) {
                                                                atualizarItem.mutate({ id: item.id, quantidade: val });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground text-sm">
                                                {formatarCusto(item.valor_unitario)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatarCusto(item.quantidade * item.valor_unitario)}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    onClick={() => removerItem.mutate(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!projecao.itens || projecao.itens.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                Nenhum item adicionado à projeção.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-muted/10">
                    <Button onClick={() => onOpenChange(false)}>Salvar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
