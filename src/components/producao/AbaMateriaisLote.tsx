import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Save, Lock, PenSquare, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatarCusto } from "@/lib/custoUtils";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Tipos
interface MaterialConsumo {
    id: string; // id do consumo se existir
    material_id: string;
    cor_id: string | null;
    quantidade_informada: number;
    unidade_informada: string;
    fator_conversao: number;
    quantidade_real: number;
    finalizado: boolean;
    observacao: string | null;
    // Dados 'Join'
    material: {
        id: string;
        nome: string;
        unidade_medida: string;
        preco_custo: number;
        tem_conversao_pacote: boolean;
        fator_conversao_pacote: number;
    };
    cor?: {
        id: string;
        nome: string;
    } | null;
}

interface ItemMaterialProps {
    produtoMaterial: any;
    loteId: string;
    consumos: any[];
}

function ItemMaterial({ produtoMaterial, loteId, consumos }: ItemMaterialProps) {
    const queryClient = useQueryClient();
    const material = produtoMaterial.material;
    const empresaId = useEmpresaId();

    // Filtrar consumos para ESTE material
    const consumosDesteMaterial = consumos?.filter(c => c.material_id === material.id) || [];

    // Estado para novo lançamento
    const [isAdding, setIsAdding] = useState(false);
    const [corId, setCorId] = useState<string>("default");
    const [qtd, setQtd] = useState("");
    const [unidade, setUnidade] = useState("PADRAO"); // PADRAO ou PACOTE

    // Estado para edição (Rascunho)
    const [editingConsumo, setEditingConsumo] = useState<MaterialConsumo | null>(null);
    const [editQtd, setEditQtd] = useState("");
    const [editMode, setEditMode] = useState<"ADD" | "SUB">("ADD");
    const [editUnidade, setEditUnidade] = useState("PADRAO");

    // Estado de Expansão (Novo UI)
    const [isExpanded, setIsExpanded] = useState(false);

    // Calcular Total Consumido
    const totalConsumido = useMemo(() => {
        return consumosDesteMaterial.reduce((acc, curr) => acc + Number(curr.quantidade_real || 0), 0);
    }, [consumosDesteMaterial]);

    // Buscar Cores se necessário
    const { data: cores } = useQuery({
        queryKey: ["cores-material", material.id],
        queryFn: async () => {
            const { data } = await supabase.from("materiais_cores").select("*").eq("material_id", material.id);
            return data || [];
        },
        enabled: isAdding || consumosDesteMaterial.length > 0
    });

    // Calcular conversão: Se 'PACOTE', usa o fator do cadastro (se não tiver, usa 1)
    const fatorConversaoAplicado = unidade === "PACOTE"
        ? (material.fator_conversao_pacote || 1)
        : 1;

    // Mutações
    const salvarConsumo = useMutation({
        mutationFn: async () => {
            const qtdNum = Number(qtd.replace(",", "."));

            if (!qtdNum || qtdNum <= 0) throw new Error("Quantidade inválida");
            if (!empresaId) throw new Error("Empresa não identificada");

            const { error } = await supabase.from("lote_consumo").insert({
                empresa_id: empresaId,
                lote_id: loteId,
                material_id: material.id,
                cor_id: corId === "default" ? null : corId,
                quantidade_informada: qtdNum,
                unidade_informada: unidade,
                fator_conversao: fatorConversaoAplicado,
                finalizado: false
            });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["consumo-materiais", loteId] });
            setIsAdding(false);
            setQtd("");
            setUnidade("PADRAO");
            toast({ title: "Lançamento salvo!" });
        },
        onError: (err) => toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" })
    });

    const atualizarConsumo = useMutation({
        mutationFn: async () => {
            if (!editingConsumo) return;
            const qtdInput = Number(editQtd.replace(",", "."));
            if (!qtdInput || qtdInput <= 0) throw new Error("Quantidade inválida");

            // 1. Calcular o ajuste em Valor Real (Unidades)
            const fatorInput = editUnidade === "PACOTE"
                ? (editingConsumo.material.fator_conversao_pacote || 1)
                : 1;
            const deltaReal = qtdInput * fatorInput;

            // 2. Converter esse delta real para a unidade que está salva no banco
            // Se foi salvo em PACOTE, divide pelo fator do registro para achar quantos pacotes (ou fração) representa
            // Se foi salvo em PADRAO, fator é 1, então deltaStored = deltaReal
            const fatorRegistro = editingConsumo.fator_conversao || 1;
            const deltaStored = deltaReal / fatorRegistro;

            // 3. Atualizar a Quantidade Informada
            let novaQuantidadeInformada = Number(editingConsumo.quantidade_informada);
            if (editMode === "ADD") {
                novaQuantidadeInformada += deltaStored;
            } else {
                novaQuantidadeInformada -= deltaStored;
            }

            if (novaQuantidadeInformada < 0) throw new Error("A quantidade final não pode ser negativa");

            const { error } = await supabase
                .from("lote_consumo")
                .update({
                    quantidade_informada: novaQuantidadeInformada,
                })
                .eq("id", editingConsumo.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["consumo-materiais", loteId] });
            setEditingConsumo(null);
            setEditQtd("");
            setEditUnidade("PADRAO");
            toast({ title: "Quantidade atualizada!" });
        },
        onError: (err) => toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" })
    });

    const finalizarConsumo = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("lote_consumo").update({ finalizado: true }).eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["consumo-materiais", loteId] });
            toast({ title: "Finalizado com sucesso" });
        }
    });

    const excluirConsumo = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("lote_consumo").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["consumo-materiais", loteId] });
            toast({ title: "Excluído com sucesso" });
        }
    });

    return (
        <div className="mb-3 border rounded-lg bg-card overflow-hidden shadow-sm transition-all hover:border-primary/30">
            {/* Header / Linha Resumo */}
            {/* Header / Linha Resumo */}
            <div
                className="flex items-center justify-between p-3 md:p-4 cursor-pointer hover:bg-muted/5 gap-2"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex flex-col gap-1">
                    <h4 className="font-bold text-sm md:text-base flex flex-wrap items-center gap-2">
                        {material.nome}
                        {totalConsumido > 0 && (
                            <Badge variant="secondary" className="text-[10px] md:text-xs font-normal">
                                Total: {totalConsumido.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {material.unidade_medida}
                            </Badge>
                        )}
                    </h4>
                    <p className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1">
                        {material.unidade_medida} • {formatarCusto(material.preco_custo)}
                    </p>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    className={`shrink-0 ${isExpanded ? "bg-muted" : ""}`}
                >
                    <span className="hidden md:inline">{isExpanded ? "Recolher" : "Lançar / Ver Detalhes"}</span>
                    <span className="md:hidden">{isExpanded ? "Fechar" : "Abrir"}</span>
                    {isExpanded ? <ChevronUp className="ml-1 md:ml-2 h-4 w-4" /> : <ChevronDown className="ml-1 md:ml-2 h-4 w-4" />}
                </Button>
            </div>

            {/* Conteúdo Expandido */}
            {isExpanded && (
                <div className="p-4 border-t bg-muted/10 animate-in slide-in-from-top-1 duration-200">

                    {/* Botão de Novo Lançamento (se não estiver adicionando) */}
                    <div className="flex justify-end mb-4">
                        <Button
                            size="sm"
                            variant={isAdding ? "secondary" : "default"}
                            onClick={() => setIsAdding(!isAdding)}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            {isAdding ? "Cancelar Lançamento" : "Novo Lançamento"}
                        </Button>
                    </div>

                    {/* Form de Adição */}
                    {isAdding && (
                        <div className="bg-muted/30 p-3 md:p-4 rounded-lg mb-4 border animate-in fade-in zoom-in-95">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                {/* Cor */}
                                <div className="md:col-span-3 space-y-1.5">
                                    <label className="text-xs font-medium">Cor</label>
                                    <Select value={corId} onValueChange={setCorId}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="default">Padrão (Sem cor)</SelectItem>
                                            {cores?.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Unidade (Checkbox para Pacote) */}
                                <div className="md:col-span-3 h-full flex items-end pb-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`chk-pacote-${material.id}`}
                                            checked={unidade === "PACOTE"}
                                            onCheckedChange={(checked) => setUnidade(checked ? "PACOTE" : "PADRAO")}
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <Label
                                                htmlFor={`chk-pacote-${material.id}`}
                                                className="text-sm font-medium leading-none cursor-pointer"
                                            >
                                                Lançar em Pacote?
                                            </Label>
                                            <p className="text-[10px] text-muted-foreground">
                                                (x{material.fator_conversao_pacote || 1} {material.unidade_medida})
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Quantidade */}
                                <div className="md:col-span-3 space-y-1.5">
                                    <label className="text-xs font-medium">Quantidade {unidade === "PACOTE" && "(Pacotes)"}</label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={qtd}
                                        onChange={e => setQtd(e.target.value)}
                                        className="h-9"
                                    />
                                    {unidade === "PACOTE" && qtd && !isNaN(Number(qtd)) && (
                                        <p className="text-[10px] text-muted-foreground text-right">
                                            Total: <strong>{(Number(qtd) * material.fator_conversao_pacote).toFixed(2)} {material.unidade_medida}</strong>
                                        </p>
                                    )}
                                </div>

                                {/* Botão Salvar */}
                                <div className="md:col-span-3">
                                    <Button
                                        onClick={() => salvarConsumo.mutate()}
                                        disabled={salvarConsumo.isPending || !qtd}
                                        className="w-full h-9"
                                    >
                                        {salvarConsumo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                        Salvar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lista de Consumos Lançados */}
                    {consumosDesteMaterial.length > 0 ? (
                        <div className="space-y-2">
                            {consumosDesteMaterial.map(consumo => {
                                const corNome = consumo.cor_id && cores ? cores.find((c: any) => c.id === consumo.cor_id)?.nome : "Padrão";
                                const isPacote = consumo.unidade_informada === 'PACOTE';

                                return (
                                    <div key={consumo.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 bg-background border rounded-md hover:border-primary/30 transition-colors gap-2 text-sm">
                                        <div className="flex items-center gap-2 w-full justify-between sm:justify-start sm:w-auto">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-[10px] h-5 bg-muted text-muted-foreground font-normal border-0">{corNome}</Badge>

                                                <div className="flex items-baseline gap-1">
                                                    <span className="font-bold text-sm">
                                                        {Number(consumo.quantidade_informada).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground uppercase">
                                                        {isPacote ? 'Pct(s)' : material.unidade_medida}
                                                    </span>
                                                </div>
                                            </div>

                                            {isPacote && (
                                                <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">
                                                    = {Number(consumo.quantidade_real).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {material.unidade_medida}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-end w-full sm:w-auto gap-0 sm:gap-1 bg-muted/20 sm:bg-transparent rounded p-1 sm:p-0 mt-0">
                                            {consumo.finalizado ? (
                                                <div className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-[10px] font-medium w-full justify-center sm:w-auto">
                                                    <Lock className="h-3 w-3" /> <span>Finalizado</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 w-full justify-end">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-8 px-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                                        onClick={() => {
                                                            setEditingConsumo({ ...consumo, material });
                                                            setEditUnidade("PADRAO");
                                                        }}
                                                        title="Ajustar"
                                                    >
                                                        <PenSquare className="h-4 w-4" />
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-8 px-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                                                        onClick={() => finalizarConsumo.mutate(consumo.id)}
                                                        title="Finalizar"
                                                    >
                                                        <Lock className="h-4 w-4" />
                                                    </Button>

                                                    <div className="w-px h-4 bg-border mx-0.5"></div>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-8 px-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                                        onClick={() => excluirConsumo.mutate(consumo.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        !isAdding && (
                            <div className="text-sm text-muted-foreground italic text-center py-4 bg-muted/10 rounded border border-dashed">
                                Clique em "Novo Lançamento" para adicionar consumo.
                            </div>
                        )
                    )}

                    {/* Dialog de Edição (Mantido igual) */}
                    {editingConsumo && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <div className="bg-background rounded-lg shadow-lg w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="p-4 border-b">
                                    <h3 className="font-semibold text-lg text-center">Ajustar Quantidade</h3>
                                    <p className="text-xs text-muted-foreground text-center">
                                        {editingConsumo.material.nome} - {editingConsumo.unidade_informada === 'PACOTE' ? 'Pacotes' : editingConsumo.material.unidade_medida}
                                    </p>
                                </div>

                                <div className="p-6 space-y-6">
                                    <div className="flex flex-col items-center justify-center space-y-2 py-2">
                                        <span className="text-sm text-muted-foreground">Quantidade Atual</span>
                                        <span className="text-4xl font-bold tracking-tight">
                                            {Number(editingConsumo.quantidade_real || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                            <span className="text-lg font-normal text-muted-foreground ml-2">
                                                {editingConsumo.material.unidade_medida}
                                            </span>
                                        </span>
                                    </div>

                                    <div className="bg-muted p-1 rounded-lg grid grid-cols-2">
                                        <button
                                            onClick={() => setEditMode("ADD")}
                                            className={`text-sm font-medium py-2 rounded-md transition-all ${editMode === "ADD" ? "bg-background shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
                                        >
                                            Adicionar (+)
                                        </button>
                                        <button
                                            onClick={() => setEditMode("SUB")}
                                            className={`text-sm font-medium py-2 rounded-md transition-all ${editMode === "SUB" ? "bg-background shadow text-destructive" : "text-muted-foreground hover:text-foreground"}`}
                                        >
                                            Remover (-)
                                        </button>
                                    </div>

                                    {/* Opção de Pacote no Ajuste */}
                                    <div className="flex justify-center pb-2">
                                        <div className="flex items-center space-x-2 bg-muted/30 px-3 py-2 rounded-md border">
                                            <Checkbox
                                                id="chk-edit-pacote"
                                                checked={editUnidade === "PACOTE"}
                                                onCheckedChange={(checked) => setEditUnidade(checked ? "PACOTE" : "PADRAO")}
                                            />
                                            <div className="grid gap-0.5 leading-none">
                                                <Label
                                                    htmlFor="chk-edit-pacote"
                                                    className="text-sm font-medium leading-none cursor-pointer"
                                                >
                                                    Ajustar em Pacote?
                                                </Label>
                                                <p className="text-[10px] text-muted-foreground">
                                                    (x{editingConsumo.material.fator_conversao_pacote || 1} {editingConsumo.material.unidade_medida})
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium uppercase text-muted-foreground">
                                                {editMode === "ADD" ? "Quanto deseja adicionar?" : "Quanto deseja remover?"}
                                            </label>
                                            <div className="relative">
                                                <div className={`absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center border-r font-bold ${editMode === "ADD" ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10"}`}>
                                                    {editMode === "ADD" ? "+" : "-"}
                                                </div>
                                                <Input
                                                    type="number"
                                                    value={editQtd}
                                                    onChange={e => setEditQtd(e.target.value)}
                                                    className="pl-12 text-lg h-12"
                                                    placeholder="0.00"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>

                                        {editQtd && !isNaN(Number(editQtd)) && (
                                            <div className="flex justify-between items-center pt-2 border-t mt-4">
                                                <span className="text-sm font-medium">Novo Total:</span>
                                                <span className="text-lg font-bold">
                                                    {(() => {
                                                        const qtdInput = Number(editQtd.replace(",", "."));
                                                        const fatorInput = editUnidade === "PACOTE" ? (editingConsumo.material.fator_conversao_pacote || 1) : 1;
                                                        const deltaReal = qtdInput * fatorInput;

                                                        const atualReal = Number(editingConsumo.quantidade_real || 0);

                                                        const novoTotalReal = editMode === "ADD"
                                                            ? atualReal + deltaReal
                                                            : Math.max(0, atualReal - deltaReal);

                                                        return `${novoTotalReal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${editingConsumo.material.unidade_medida}`;
                                                    })()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 bg-muted/20 border-t flex gap-3">
                                    <Button variant="outline" className="flex-1" onClick={() => {
                                        setEditingConsumo(null);
                                        setEditQtd("");
                                    }}>
                                        Cancelar
                                    </Button>
                                    <Button
                                        className={`flex-1 ${editMode === "SUB" ? "hover:bg-destructive" : ""}`}
                                        disabled={!editQtd || atualizarConsumo.isPending}
                                        variant={editMode === "SUB" ? "destructive" : "default"}
                                        onClick={() => atualizarConsumo.mutate()}
                                    >
                                        {atualizarConsumo.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Confirmar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function AbaMateriaisLote({ loteId, produtoId }: { loteId: string, produtoId: string }) {
    // 1. Buscar Materiais do Produto (BOM)
    const { data: materiaisProduto, isLoading: isLoadingRef } = useQuery({
        queryKey: ["produto-materiais-consumo", produtoId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("produto_materiais")
                .select(`
                    *,
                    material:materiais(
                        id,
                        nome,
                        unidade_medida,
                        preco_custo,
                        tem_conversao_pacote,
                        fator_conversao_pacote
                    )
                `)
                .eq("produto_id", produtoId);

            if (error) throw error;
            return data;
        }
    });

    // 2. Buscar Consumo já lançado
    const { data: consumos, isLoading: isLoadingConsumo } = useQuery({
        queryKey: ["consumo-materiais", loteId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("lote_consumo")
                .select("*")
                .eq("lote_id", loteId)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    if (isLoadingRef || isLoadingConsumo) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
    }

    if (!materiaisProduto || materiaisProduto.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-lg text-muted-foreground">Este produto não possui Ficha Técnica cadastrada.</p>
                <p className="text-sm">Vincule materiais ao produto para liberar o lançamento de consumo.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Lançamento de Cores e Materiais</h3>
            </div>

            {materiaisProduto.map((pm: any) => (
                <ItemMaterial
                    key={pm.id}
                    produtoMaterial={pm}
                    loteId={loteId}
                    consumos={consumos || []}
                />
            ))}
        </div>
    );
}
