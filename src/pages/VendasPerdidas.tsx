import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, User, ChevronRight, Users } from "lucide-react";
import { useVendasPerdidas } from "@/hooks/useVendasPerdidas";
import { useNavigate } from "react-router-dom";
import NovaVendaPerdidaDialog from "@/components/vendas-perdidas/NovaVendaPerdidaDialog";
import DetalhesVendaPerdidaDialog from "@/components/vendas-perdidas/DetalhesVendaPerdidaDialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function VendasPerdidas() {
    const { data: vendas, isLoading } = useVendasPerdidas();
    const [dialogNovaOpen, setDialogNovaOpen] = useState(false);
    const [vendaSelecionada, setVendaSelecionada] = useState<any>(null);
    const navigate = useNavigate();

    // Group sales by user ID
    const usuarios = useMemo(() => {
        if (!vendas) return {};
        return vendas.reduce((acc: any, venda: any) => {
            const userId = venda.usuario_id;
            if (!acc[userId]) {
                acc[userId] = {
                    id: userId,
                    nome: venda.usuario_nome || "Desconhecido",
                    vendas: []
                };
            }
            acc[userId].vendas.push(venda);
            return acc;
        }, {});
    }, [vendas]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Vendas Perdidas</h2>
                    <p className="text-muted-foreground">
                        Registre e monitore vendas que não foram concretizadas.
                    </p>
                </div>
                <Button onClick={() => setDialogNovaOpen(true)} variant="destructive">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Venda Perdida
                </Button>
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                ) : Object.keys(usuarios).length === 0 ? (
                    <Card className="min-h-[300px] flex items-center justify-center border-dashed">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Users className="h-10 w-10 opacity-20" />
                            <p>Nenhuma venda perdida registrada</p>
                            <Button variant="outline" size="sm" onClick={() => setDialogNovaOpen(true)}>
                                Criar registro
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <div className="flex flex-col gap-2">
                        {Object.values(usuarios).map((user: any) => {
                            const totalVendas = user.vendas.length;

                            return (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer group shadow-sm"
                                    onClick={() => navigate(`/vendas-perdidas/${user.id}`)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-destructive/10 p-2 rounded-full group-hover:bg-destructive group-hover:text-destructive-foreground transition-colors">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-base leading-none">{user.nome || "Usuário"}</h3>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {totalVendas} {totalVendas === 1 ? 'registro' : 'registros'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <NovaVendaPerdidaDialog
                open={dialogNovaOpen}
                onOpenChange={setDialogNovaOpen}
                onVendaCriada={(novaVenda) => {
                    setVendaSelecionada(novaVenda);
                }}
            />
            {vendaSelecionada && (
                <DetalhesVendaPerdidaDialog
                    open={!!vendaSelecionada}
                    onOpenChange={(open) => !open && setVendaSelecionada(null)}
                    venda={vendaSelecionada}
                />
            )}
        </div>
    );
}
