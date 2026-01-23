import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, User, ChevronRight, Users } from "lucide-react";
import { useProjecoes } from "@/hooks/useProjecoes";
import { formatarCusto } from "@/lib/custoUtils";
import { useNavigate } from "react-router-dom";
import NovaProjecaoDialog from "@/components/projecoes/NovaProjecaoDialog";
import DetalhesProjecaoDialog from "@/components/projecoes/DetalhesProjecaoDialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjecaoVendas() {
    const { data: projecoes, isLoading } = useProjecoes();
    const [dialogNovaOpen, setDialogNovaOpen] = useState(false);
    const [projecaoSelecionada, setProjecaoSelecionada] = useState<any>(null);
    const navigate = useNavigate();

    // Group projections by user ID
    const usuarios = useMemo(() => {
        if (!projecoes) return {};
        return projecoes.reduce((acc: any, proj: any) => {
            const userId = proj.usuario_id;
            if (!acc[userId]) {
                acc[userId] = {
                    id: userId,
                    nome: proj.usuario_nome || "Desconhecido",
                    projecoes: []
                };
            }
            acc[userId].projecoes.push(proj);
            return acc;
        }, {});
    }, [projecoes]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Projeção de Vendas</h2>
                    <p className="text-muted-foreground">
                        Acompanhe e projete suas metas de vendas futuras.
                    </p>
                </div>
                <Button onClick={() => setDialogNovaOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Projeção
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
                            <p>Nenhuma projeção encontrada</p>
                            <Button variant="outline" size="sm" onClick={() => setDialogNovaOpen(true)}>
                                Criar primeira projeção
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <div className="flex flex-col gap-2">
                        {Object.values(usuarios).map((user: any) => {
                            const totalValor = user.projecoes.reduce((acc: number, p: any) => {
                                return acc + (p.itens?.reduce((sum: number, item: any) => sum + (item.quantidade * item.valor_unitario), 0) || 0);
                            }, 0);
                            const totalProjs = user.projecoes.length;

                            return (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer group shadow-sm"
                                    onClick={() => navigate(`/projecao-vendas/${user.id}`)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-primary/10 p-2 rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-base leading-none">{user.nome || "Usuário"}</h3>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {totalProjs} {totalProjs === 1 ? 'projeção' : 'projeções'}
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

            <NovaProjecaoDialog
                open={dialogNovaOpen}
                onOpenChange={setDialogNovaOpen}
                onProjecaoCriada={(novaProjecao) => {
                    setProjecaoSelecionada(novaProjecao);
                    // Need to ensure DetalhesDialog is available in this component?
                    /* 
                       Wait, ProjecaoVendas.tsx (the version I overwrote in Step 515) DOES NOT HAVE DetalhesProjecaoDialog anymore!
                       I removed it when I switched to "List View" in step 515 because the user asked for "lista mais fina" and I simplified it.
                       BUT, I need to check if I kept it.
                       Checking file content...
                       It seems I removed `DetalhesProjecaoDialog` import and usage in Step 515 overwrite.
                       I need to add it back to `ProjecaoVendas.tsx` so "Nova Projeção" can open it.
                       Or, navigating to `ProjecaoMensal`?
                       No, "Nova Projeção" creates it. It should open immediately for editing items.
                       So I must add `DetalhesProjecaoDialog` back to `ProjecaoVendas.tsx`.
                    */
                }}
            />
            {/* I need to add DetalhesProjecaoDialog back */}
            {projecaoSelecionada && (
                <DetalhesProjecaoDialog // This component needs to be imported
                    open={!!projecaoSelecionada}
                    onOpenChange={(open) => !open && setProjecaoSelecionada(null)}
                    projecao={projecaoSelecionada}
                />
            )}
        </div>
    );
}
