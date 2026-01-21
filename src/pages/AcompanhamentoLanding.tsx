import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList, Users } from "lucide-react";

export default function AcompanhamentoLanding() {
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
                    Acompanhamento
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Selecione o tipo de acompanhamento que deseja visualizar
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card
                    className="cursor-pointer hover:border-primary transition-colors group"
                    onClick={() => navigate("/acompanhamento-pedidos")}
                >
                    <CardHeader className="flex flex-row items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                            <ClipboardList className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Acompanhamento de Pedidos</CardTitle>
                            <CardDescription className="mt-1">
                                Visualize o progresso dos pedidos e lotes em tempo real
                            </CardDescription>
                        </div>
                    </CardHeader>
                </Card>

                <Card
                    className="cursor-pointer hover:border-primary transition-colors group"
                    onClick={() => navigate("/acompanhamento-colaboradores")}
                >
                    <CardHeader className="flex flex-row items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                            <Users className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Acompanhamento de Colaboradores</CardTitle>
                            <CardDescription className="mt-1">
                                Monitore o desempenho e atividades dos colaboradores
                            </CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            </div>
        </div>
    );
}
