import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Save, Loader2, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EditarEtapasProdutoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    produtoId: string;
    produtoNome: string;
}

interface Etapa {
    id: string;
    nome: string;
    empresa_id: string;
    ordem: number;
}

interface Subetapa {
    id: string;
    nome: string;
    etapa_id: string;
    empresa_id: string;
}

interface EtapaSelecionada {
    id?: string; // ID da relação produto_etapa se já existir
    etapaId: string;
    etapaNome: string;
    subetapaId: string | null;
    subetapaNome: string | null;
    ordem: number;
    obrigatoria: boolean;
}

export default function EditarEtapasProdutoDialog({
    open,
    onOpenChange,
    produtoId,
    produtoNome,
}: EditarEtapasProdutoDialogProps) {
    const empresaId = useEmpresaId();
    const queryClient = useQueryClient();
    const [etapasSelecionadas, setEtapasSelecionadas] = useState<EtapaSelecionada[]>([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Seleção, 2: Ordenação

    // Carregar etapas disponíveis
    const { data: etapasDisponiveis = [], isLoading: isLoadingEtapas } = useQuery<Etapa[]>({
        queryKey: ["etapas", empresaId],
        enabled: !!empresaId && open,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("etapas")
                .select("*")
                .eq("empresa_id", empresaId)
                .order("ordem");
            if (error) throw error;
            return data;
        }
    });

    // Carregar subetapas disponíveis
    const { data: subetapasDisponiveis = [] } = useQuery<Subetapa[]>({
        queryKey: ["subetapas", empresaId],
        enabled: !!empresaId && open,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("subetapas")
                .select("*")
                .eq("empresa_id", empresaId);
            if (error) throw error;
            return data;
        }
    });

    // Carregar configuração atual do produto
    useEffect(() => {
        if (open && produtoId) {
            const fetchProdutoEtapas = async () => {
                const { data, error } = await supabase
                    .from("produto_etapas")
                    .select(`
            id,
            ordem,
            obrigatoria,
            etapa:etapas(id, nome),
            subetapa:subetapas(id, nome)
          `)
                    .eq("produto_id", produtoId)
                    .order("ordem");

                if (!error && data) {
                    const etapasFormatadas = data.map((item: any) => ({
                        id: item.id,
                        etapaId: item.etapa.id,
                        etapaNome: item.etapa.nome,
                        subetapaId: item.subetapa?.id || null,
                        subetapaNome: item.subetapa?.nome || null,
                        ordem: item.ordem,
                        obrigatoria: item.obrigatoria,
                    }));
                    setEtapasSelecionadas(etapasFormatadas);
                }
            };

            fetchProdutoEtapas();
            setStep(1); // Resetar para o passo 1 ao abrir
        }
    }, [open, produtoId]);

    const toggleEtapa = (etapa: Etapa, subetapa: Subetapa | null) => {
        const targetEtapaId = etapa.id;
        const targetSubetapaId = subetapa?.id || null;

        const index = etapasSelecionadas.findIndex(
            (e) => e.etapaId === targetEtapaId && e.subetapaId === targetSubetapaId
        );

        let novasEtapas = [...etapasSelecionadas];

        if (index >= 0) {
            // Remover
            novasEtapas.splice(index, 1);
        } else {
            // Adicionar
            novasEtapas.push({
                etapaId: etapa.id,
                etapaNome: etapa.nome,
                subetapaId: subetapa?.id || null,
                subetapaNome: subetapa?.nome || null,
                ordem: etapasSelecionadas.length + 1,
                obrigatoria: true,
            });
        }

        setEtapasSelecionadas(novasEtapas);
    };

    const moverEtapa = (index: number, direcao: 'cima' | 'baixo') => {
        if (direcao === 'cima' && index === 0) return;
        if (direcao === 'baixo' && index === etapasSelecionadas.length - 1) return;

        const novasEtapas = [...etapasSelecionadas];
        const novoIndex = direcao === 'cima' ? index - 1 : index + 1;

        // Trocar posições
        [novasEtapas[index], novasEtapas[novoIndex]] = [novasEtapas[novoIndex], novasEtapas[index]];

        // Atualizar ordem numérica baseada no índice
        novasEtapas.forEach((item, idx) => {
            item.ordem = idx + 1;
        });

        setEtapasSelecionadas(novasEtapas);
    };

    const handleSalvar = async () => {
        setLoading(true);
        try {
            // Primeiro, remover todas as etapas existentes para este produto
            // (Estratégia mais simples para lidar com reordenação e remoção)
            // Nota: Isso pode perder histórico se não feito com cuidado, mas para configuração é aceitável
            // Se precisarmos manter IDs para integridade referencial, seria mais complexo

            const { error: deleteError } = await supabase
                .from("produto_etapas")
                .delete()
                .eq("produto_id", produtoId);

            if (deleteError) throw deleteError;

            if (etapasSelecionadas.length > 0) {
                const etapasParaInserir = etapasSelecionadas.map((e, idx) => ({
                    produto_id: produtoId,
                    etapa_id: e.etapaId,
                    subetapa_id: e.subetapaId,
                    ordem: idx + 1, // Garantir ordem sequencial correta
                    obrigatoria: e.obrigatoria,
                    empresa_id: empresaId,
                }));

                const { error: insertError } = await supabase
                    .from("produto_etapas")
                    .insert(etapasParaInserir);

                if (insertError) throw insertError;
            }

            toast({
                title: "Etapas atualizadas com sucesso!",
            });

            queryClient.invalidateQueries({ queryKey: ["produto", produtoId] });
            queryClient.invalidateQueries({ queryKey: ["produtos"] });
            onOpenChange(false);
        } catch (error: any) {
            toast({
                title: "Erro ao salvar etapas",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Gerenciar Etapas - {produtoNome}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Navegação de Passos */}
                    <div className="flex items-center justify-center space-x-2 mb-4">
                        <div className={`h-2 w-2 rounded-full ${step === 1 ? 'bg-primary' : 'bg-muted'}`} />
                        <div className={`h-1 w-8 ${step === 2 ? 'bg-primary' : 'bg-muted'}`} />
                        <div className={`h-2 w-2 rounded-full ${step === 2 ? 'bg-primary' : 'bg-muted'}`} />
                    </div>

                    {step === 1 && (
                        <div className="space-y-4">
                            <Alert className="bg-blue-50 border-blue-200">
                                <AlertDescription className="text-blue-800">
                                    Selecione todas as etapas e subetapas que compõem este produto. No próximo passo você poderá definir a ordem de produção.
                                </AlertDescription>
                            </Alert>

                            {isLoadingEtapas ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : etapasDisponiveis.length === 0 ? (
                                <div className="text-center py-8 border rounded-lg bg-muted/20">
                                    <p className="text-muted-foreground mb-2">Nenhuma etapa cadastrada no sistema.</p>
                                    <Button variant="link" onClick={() => onOpenChange(false)}>Ir para Configurações</Button>
                                </div>
                            ) : (
                                <Accordion type="multiple" className="w-full border rounded-lg px-2">
                                    {etapasDisponiveis.map((etapa) => {
                                        const subetapasEtapa = subetapasDisponiveis.filter(
                                            (s) => s.etapa_id === etapa.id
                                        );
                                        const temSubetapas = subetapasEtapa.length > 0;

                                        const estaSelecionada = (subId: string | null) =>
                                            etapasSelecionadas.some(e => e.etapaId === etapa.id && e.subetapaId === subId);

                                        return (
                                            <AccordionItem key={etapa.id} value={etapa.id} className="border-b last:border-0">
                                                <AccordionTrigger className="hover:no-underline py-3">
                                                    <div className="flex items-center gap-3">
                                                        {!temSubetapas && (
                                                            <Checkbox
                                                                checked={estaSelecionada(null)}
                                                                onCheckedChange={() => toggleEtapa(etapa, null)}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        )}
                                                        <span className={!temSubetapas && estaSelecionada(null) ? "font-semibold text-primary" : ""}>
                                                            {etapa.nome}
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                {temSubetapas && (
                                                    <AccordionContent>
                                                        <div className="space-y-2 pl-4 pb-2">
                                                            {subetapasEtapa.map((subetapa) => (
                                                                <div
                                                                    key={subetapa.id}
                                                                    className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                                                                    onClick={() => toggleEtapa(etapa, subetapa)}
                                                                >
                                                                    <Checkbox
                                                                        checked={estaSelecionada(subetapa.id)}
                                                                        onCheckedChange={() => toggleEtapa(etapa, subetapa)}
                                                                    />
                                                                    <Label className="cursor-pointer flex-1">
                                                                        {subetapa.nome}
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </AccordionContent>
                                                )}
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            )}

                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm text-muted-foreground">
                                    {etapasSelecionadas.length} etapa(s) selecionada(s)
                                </span>
                                <Button onClick={() => setStep(2)} disabled={etapasSelecionadas.length === 0}>
                                    Organizar Ordem <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <Alert className="bg-orange-50 border-orange-200">
                                <AlertTriangle className="h-4 w-4 text-orange-600" />
                                <AlertDescription className="text-orange-800">
                                    Arraste ou use as setas para definir a ordem exata de produção. Isso impactará o fluxo de trabalho.
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                {etapasSelecionadas.map((etapa, idx) => (
                                    <div
                                        key={`${etapa.etapaId}-${etapa.subetapaId}`}
                                        className="flex items-center gap-3 rounded-lg border p-3 bg-card hover:shadow-sm transition-shadow"
                                    >
                                        <div className="flex flex-col gap-1 text-muted-foreground">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                disabled={idx === 0}
                                                onClick={() => moverEtapa(idx, 'cima')}
                                            >
                                                <ArrowUp className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                disabled={idx === etapasSelecionadas.length - 1}
                                                onClick={() => moverEtapa(idx, 'baixo')}
                                            >
                                                <ArrowDown className="h-3 w-3" />
                                            </Button>
                                        </div>

                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                                            {idx + 1}
                                        </div>

                                        <div className="flex-1">
                                            <p className="font-medium">
                                                {etapa.subetapaNome || etapa.etapaNome}
                                            </p>
                                            {etapa.subetapaNome && (
                                                <p className="text-xs text-muted-foreground">
                                                    {etapa.etapaNome}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between pt-4">
                                <Button variant="outline" onClick={() => setStep(1)}>
                                    Voltar e Editar
                                </Button>
                                <Button onClick={handleSalvar} disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar Configuração
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
