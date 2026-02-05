import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, ArrowRight, Loader2, PackagePlus } from "lucide-react";

export default function ListaLancamentoMateriais() {
    const navigate = useNavigate();
    const [busca, setBusca] = useState("");

    const { data: lotes, isLoading } = useQuery({
        queryKey: ["lotes-ativos-materiais"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("lotes")
                .select(`
                    id,
                    numero_lote,
                    nome_lote,
                    produto:produtos(nome, sku),
                    finalizado
                `)
                .eq("finalizado", false) // Only active lots? Or allow all? User might want to launch late. Let's show all but order by recent/active.
                // Actually usually you launch materials while production is active.
                // Let's stick to active for now or filtering.
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data;
        },
    });

    const lotesFiltrados = lotes?.filter((lote) => {
        const termo = busca.toLowerCase();
        return (
            lote.nome_lote.toLowerCase().includes(termo) ||
            lote.numero_lote.toString().includes(termo) ||
            lote.produto?.nome.toLowerCase().includes(termo) ||
            lote.produto?.sku?.toLowerCase().includes(termo)
        );
    });

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <PackagePlus className="h-6 w-6" />
                    Lançamento de Materiais
                </h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar lote..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : lotesFiltrados && lotesFiltrados.length > 0 ? (
                <div className="border rounded-md">
                    <div className="border rounded-md">
                        <Table className="hidden md:table">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Lote</TableHead>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lotesFiltrados.map((lote) => (
                                    <TableRow
                                        key={lote.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => navigate(`/lotes/${lote.id}/materiais`)}
                                    >
                                        <TableCell className="font-medium">
                                            #{lote.numero_lote} - {lote.nome_lote}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{lote.produto?.nome}</span>
                                                {lote.produto?.sku && (
                                                    <span className="text-xs text-muted-foreground">{lote.produto.sku}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {!lote.finalizado ? (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200">
                                                    Em produção
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">Finalizado</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="ghost">
                                                Lançar
                                                <ArrowRight className="h-4 w-4 ml-2" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {/* Versão Mobile (Cards) */}
                        <div className="md:hidden space-y-3 p-4 bg-muted/10">
                            {lotesFiltrados.map((lote) => (
                                <div
                                    key={lote.id}
                                    className="bg-background border rounded-lg p-4 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                                    onClick={() => navigate(`/lotes/${lote.id}/materiais`)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg">#{lote.numero_lote}</h3>
                                        {!lote.finalizado ? (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] h-5 px-1.5">
                                                Em produção
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Finalizado</Badge>
                                        )}
                                    </div>

                                    <div className="mb-3 space-y-1">
                                        <p className="text-sm font-medium leading-tight">{lote.nome_lote}</p>
                                        <p className="text-xs text-muted-foreground">{lote.produto?.nome}</p>
                                    </div>

                                    <div className="flex items-center justify-end border-t pt-3 mt-3">
                                        <span className="text-sm font-medium text-primary flex items-center gap-1">
                                            Lançar Materiais <ArrowRight className="h-3.5 w-3.5" />
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-md bg-muted/10">
                    Nenhum lote encontrado.
                </div>
            )}
        </div>
    );
}
