import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Search, Calendar as CalendarIcon } from "lucide-react";

interface AtividadeMeta {
    nome: string;
    tipo: "Etapa" | "Subetapa";
    produzido: number;
    meta: number;
    falta: number;
    percentual: number;
}

interface ColaboradorProgresso {
    colaborador: {
        id: string;
        nome: string;
    };
    atividades: AtividadeMeta[];
}

function SearchableSelect({
    value,
    onValueChange,
    options,
    placeholder,
    disabled
}: {
    value: string;
    onValueChange: (val: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal bg-background"
                    disabled={disabled}
                >
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Pesquisar..." />
                    <CommandList>
                        <CommandEmpty>Nenhum resultado.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onValueChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function MonthYearPicker({ value, onChange }: { value: string, onChange: (val: string) => void }) {
    const [ano, mes] = value.split("-");

    const meses = [
        { value: "01", label: "Janeiro" },
        { value: "02", label: "Fevereiro" },
        { value: "03", label: "Março" },
        { value: "04", label: "Abril" },
        { value: "05", label: "Maio" },
        { value: "06", label: "Junho" },
        { value: "07", label: "Julho" },
        { value: "08", label: "Agosto" },
        { value: "09", label: "Setembro" },
        { value: "10", label: "Outubro" },
        { value: "11", label: "Novembro" },
        { value: "12", label: "Dezembro" },
    ];

    const anos = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 2 + i));

    return (
        <div className="flex bg-background border rounded-md shadow-sm h-10 items-center px-1 space-x-1">
            <CalendarIcon className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
            <Select value={mes} onValueChange={(v) => onChange(`${ano}-${v}`)}>
                <SelectTrigger className="h-8 border-0 shadow-none focus:ring-0 w-[120px]">
                    <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                    {meses.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div className="w-px h-4 bg-border mx-1" />
            <Select value={ano} onValueChange={(v) => onChange(`${v}-${mes}`)}>
                <SelectTrigger className="h-8 border-0 shadow-none focus:ring-0 w-[80px]">
                    <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                    {anos.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

const ListaProgressoMetas = () => {
    const empresaId = useEmpresaId();
    const dataAtual = new Date();
    const mesAtualFormatado = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, "0")}`;
    const [mesAno, setMesAno] = useState(mesAtualFormatado);
    const [colaboradorId, setColaboradorId] = useState("all");
    const [hasConsulted, setHasConsulted] = useState(false);

    const { data: colaboradoresList } = useQuery({
        queryKey: ["colaboradores-metas-lista", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data } = await supabase
                .from("colaboradores")
                .select("id, nome")
                .eq("empresa_id", empresaId)
                .eq("ativo", true)
                .order("nome");
            return data || [];
        }
    });

    const { data: progresso, isLoading, refetch } = useQuery({
        queryKey: ["progresso-metas-lista", mesAno, empresaId],
        enabled: false,
        queryFn: async (): Promise<ColaboradorProgresso[]> => {
            const [ano, mes] = mesAno.split("-");
            const dataInicio = `${ano}-${mes}-01`;
            const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
            const dataFim = `${ano}-${mes}-${ultimoDia}`;

            // 1. Buscar colaboradores ativos
            const { data: colaboradores } = await supabase
                .from("colaboradores")
                .select("id, nome")
                .eq("empresa_id", empresaId)
                .eq("ativo", true)
                .order("nome");

            // 2. Buscar definições de metas
            const { data: metas } = await supabase
                .from("metas")
                .select(`
          etapa_id,
          subetapa_id,
          meta,
          etapas(nome),
          subetapas(nome)
        `)
                .eq("empresa_id", empresaId);

            if (!colaboradores || !metas) return [];

            // 3. Para cada colaborador, buscar suas produções e calcular progresso
            const progressoPromises = colaboradores.map(async (colaborador) => {
                const { data: producoes } = await supabase
                    .from("producoes")
                    .select(`
            etapa_id,
            subetapa_id,
            quantidade_produzida,
            etapas(nome),
            subetapas(nome)
          `)
                    .eq("colaborador_id", colaborador.id)
                    .gte("data_inicio", dataInicio)
                    .lte("data_inicio", dataFim);

                if (!producoes || producoes.length === 0) {
                    return null;
                }

                const atividadesMap = new Map<string, AtividadeMeta>();

                producoes.forEach((prod: any) => {
                    const chave = prod.subetapa_id
                        ? `sub-${prod.subetapa_id}`
                        : `etapa-${prod.etapa_id}`;

                    const metaConfig = metas.find((m: any) =>
                        prod.subetapa_id
                            ? m.subetapa_id === prod.subetapa_id
                            : (m.etapa_id === prod.etapa_id && !m.subetapa_id)
                    );

                    if (!atividadesMap.has(chave)) {
                        atividadesMap.set(chave, {
                            nome: prod.subetapa_id ? prod.subetapas?.nome : prod.etapas?.nome,
                            tipo: prod.subetapa_id ? "Subetapa" : "Etapa",
                            produzido: 0,
                            meta: metaConfig?.meta || 0,
                            falta: 0,
                            percentual: 0
                        });
                    }

                    const atual = atividadesMap.get(chave)!;
                    atual.produzido += prod.quantidade_produzida;
                });

                const atividadesCalc: AtividadeMeta[] = Array.from(atividadesMap.values()).map((a) => ({
                    ...a,
                    falta: Math.max(0, a.meta - a.produzido),
                    percentual: a.meta > 0 ? (a.produzido / a.meta) * 100 : 0
                }));

                const atividadesComMeta = atividadesCalc.filter((a) => a.meta > 0);

                if (atividadesComMeta.length === 0) return null;

                return {
                    colaborador,
                    atividades: atividadesComMeta
                };
            });

            const results = await Promise.all(progressoPromises);
            return results.filter((item): item is ColaboradorProgresso => item !== null);
        },
    });

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle>Acompanhamento de Metas</CardTitle>
                        <CardDescription>Progresso individual por atividade no mês selecionado</CardDescription>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <div className="w-full sm:w-[250px]">
                            <SearchableSelect
                                value={colaboradorId}
                                onValueChange={setColaboradorId}
                                placeholder="Todos os colaboradores"
                                options={[
                                    { value: "all", label: "Todos os colaboradores" },
                                    ...(colaboradoresList?.map(c => ({ value: c.id, label: c.nome })) || [])
                                ]}
                            />
                        </div>
                        <div className="w-full sm:w-auto shrink-0">
                            <MonthYearPicker
                                value={mesAno}
                                onChange={(val) => {
                                    setMesAno(val);
                                    setHasConsulted(false);
                                }}
                            />
                        </div>
                        <Button
                            onClick={() => {
                                setHasConsulted(true);
                                refetch();
                            }}
                            disabled={isLoading}
                        >
                            <Search className="h-4 w-4 mr-2" />
                            Consultar
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {!hasConsulted ? (
                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center space-y-3">
                        <Search className="h-12 w-12 text-muted-foreground/30" />
                        <p>Selecione o mês desejado e clique em Consultar para visualizar o progresso das metas.</p>
                    </div>
                ) : isLoading ? (
                    <div className="text-center py-8">Carregando dados...</div>
                ) : !progresso || progresso.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Nenhuma meta em andamento encontrada para este período.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {progresso
                            .filter(item => colaboradorId === "all" || item.colaborador.id === colaboradorId)
                            .map((item) => (
                                <div key={item.colaborador.id} className="border rounded-md p-3 text-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                            {item.colaborador.nome.charAt(0)}
                                        </div>
                                        <h3 className="font-semibold text-base">{item.colaborador.nome}</h3>
                                    </div>

                                    {/* Desktop Table View */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="h-8">
                                                    <TableHead className="h-8 py-1">Atividade</TableHead>
                                                    <TableHead className="h-8 py-1 text-right">Meta</TableHead>
                                                    <TableHead className="h-8 py-1 text-right">Produzido</TableHead>
                                                    <TableHead className="h-8 py-1 text-right">Falta</TableHead>
                                                    <TableHead className="h-8 py-1 w-[200px]">Progresso</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {item.atividades.map((ativ: AtividadeMeta, idx: number) => (
                                                    <TableRow key={idx} className="h-8">
                                                        <TableCell className="py-1 font-medium">{ativ.nome}</TableCell>
                                                        <TableCell className="py-1 text-right">{ativ.meta}</TableCell>
                                                        <TableCell className="py-1 text-right">{ativ.produzido}</TableCell>
                                                        <TableCell className="py-1 text-right">
                                                            {ativ.falta > 0 ? (
                                                                <span className="text-red-500 font-semibold">{ativ.falta}</span>
                                                            ) : (
                                                                <span className="text-green-500 font-bold">✓</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-1">
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between text-[10px]">
                                                                    <span>{ativ.percentual.toFixed(1)}%</span>
                                                                    {ativ.percentual >= 100 && <span className="text-green-600 font-bold">Meta Batida!</span>}
                                                                </div>
                                                                <Progress
                                                                    value={Math.min(ativ.percentual, 100)}
                                                                    className={ativ.percentual >= 100 ? "bg-green-100 h-1.5" : "h-1.5"}
                                                                    indicatorClassName={ativ.percentual >= 100 ? "bg-green-500" : ""}
                                                                />
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Mobile List View */}
                                    <div className="md:hidden space-y-3 pt-2">
                                        {item.atividades.map((ativ: AtividadeMeta, idx: number) => (
                                            <div key={idx} className="bg-muted/30 rounded p-2.5">
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <span className="font-medium text-sm text-foreground/90">{ativ.nome}</span>
                                                    {ativ.falta <= 0 && <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-0.5 rounded-full">Batida!</span>}
                                                </div>

                                                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                                    <span>Meta: <strong className="text-foreground">{ativ.meta}</strong></span>
                                                    <span>Feito: <strong className="text-foreground">{ativ.produzido}</strong></span>
                                                    <span>Falta: <strong className={ativ.falta > 0 ? "text-red-500" : "text-green-500"}>{ativ.falta > 0 ? ativ.falta : "✓"}</strong></span>
                                                </div>

                                                <div className="space-y-1">
                                                    <Progress
                                                        value={Math.min(ativ.percentual, 100)}
                                                        className={ativ.percentual >= 100 ? "bg-green-100 h-2" : "h-2"}
                                                        indicatorClassName={ativ.percentual >= 100 ? "bg-green-500" : ""}
                                                    />
                                                    <div className="text-right text-[10px] font-bold text-primary">
                                                        {ativ.percentual.toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 flex items-center justify-end gap-3 border-t pt-2">
                                        <span className="font-bold text-sm">Pontuação Total:</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-lg font-bold text-primary">
                                                {item.atividades.reduce((acc, curr) => acc + curr.percentual, 0).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ListaProgressoMetas;
