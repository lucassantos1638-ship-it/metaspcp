import { useParams, useNavigate } from "react-router-dom";
import { useVendasPerdidas } from "@/hooks/useVendasPerdidas";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

export default function VendasPerdidasUsuario() {
    const { usuarioId } = useParams();
    const navigate = useNavigate();
    const { data: vendas, isLoading } = useVendasPerdidas();

    // Filter for this user
    const listaUsuario = useMemo(() => {
        return vendas?.filter((p: any) => p.usuario_id === usuarioId) || [];
    }, [vendas, usuarioId]);

    const usuarioNome = listaUsuario[0]?.usuario_nome || "Usuário";

    // Group by Month (yyyy-MM)
    const meses = useMemo(() => {
        const groups: any = {};
        listaUsuario.forEach((venda: any) => {
            const date = parseISO(venda.data_referencia);
            const key = format(date, "yyyy-MM");
            if (!groups[key]) {
                groups[key] = {
                    key,
                    date,
                    count: 0
                };
            }
            groups[key].count++;
        });
        // Sort descending
        return Object.values(groups).sort((a: any, b: any) => b.date.getTime() - a.date.getTime());
    }, [listaUsuario]);

    if (isLoading) {
        return <div className="space-y-4 p-8">
            <Skeleton className="h-10 w-48" />
            <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
        </div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/vendas-perdidas")}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{usuarioNome}</h2>
                    <p className="text-muted-foreground">Selecione o Mês de Referência</p>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {meses.map((mes: any) => (
                    <div
                        key={mes.key}
                        className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer group shadow-sm"
                        onClick={() => navigate(`/vendas-perdidas/${usuarioId}/${mes.key}`)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-destructive/10 p-2 rounded-full group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                                <Calendar className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base capitalize">
                                    {format(mes.date, "MMMM yyyy", { locale: ptBR })}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {mes.count} {mes.count === 1 ? 'registro' : 'registros'}
                                </p>
                            </div>
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                ))}

                {meses.length === 0 && (
                    <div className="py-10 text-center text-muted-foreground">
                        Nenhuma venda perdida encontrada para este usuário.
                    </div>
                )}
            </div>
        </div>
    );
}
