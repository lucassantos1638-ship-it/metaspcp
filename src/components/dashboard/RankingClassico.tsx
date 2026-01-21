import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AtividadeDesempenho {
    nome: string;
    meta: number;
    produzido: number;
    percentual: number;
}

interface RankingItem {
    posicao: number;
    colaborador: {
        id: string;
        nome: string;
        funcao: string | null;
    };
    totalPercentual: number;
    atividades: AtividadeDesempenho[];
}

interface RankingClassicoProps {
    top3: RankingItem[];
}

const getStatusEmoji = (percentual: number) => {
    if (percentual >= 100) return "✅";
    if (percentual >= 90) return "🔥";
    return "📈";
};

const getStatusText = (percentual: number) => {
    if (percentual >= 100) return "Meta Batida";
    if (percentual >= 90) return "Acima de 90%";
    return "Em Progresso";
};

export function RankingClassico({ top3 }: RankingClassicoProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            {/* 2º Lugar */}
            {top3[1] && (
                <Card className="border-2 border-gray-400 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                    <CardHeader className="text-center pb-2">
                        <div className="text-4xl sm:text-5xl md:text-6xl mb-2">🥈</div>
                        <CardTitle className="text-lg sm:text-xl md:text-2xl">{top3[1].colaborador.nome}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-center">
                            <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">
                                {top3[1].totalPercentual.toFixed(1)}%
                            </span>
                        </div>
                        <Badge className="w-full justify-center text-sm sm:text-base py-2">
                            {getStatusEmoji(top3[1].totalPercentual)} {getStatusText(top3[1].totalPercentual)}
                        </Badge>
                        <Progress value={Math.min(top3[1].totalPercentual, 100)} className="h-3" />
                        {top3[1].atividades.length > 0 && (
                            <p className="text-xs text-muted-foreground text-center">
                                {top3[1].atividades.map(a => a.nome).join(", ")}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* 1º Lugar */}
            {top3[0] && (
                <Card className="border-4 border-yellow-500 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 shadow-2xl md:transform md:scale-110">
                    <CardHeader className="text-center pb-2">
                        <div className="text-4xl sm:text-6xl md:text-7xl mb-2">🥇</div>
                        <CardTitle className="text-xl sm:text-2xl md:text-3xl">{top3[0].colaborador.nome}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-center">
                            <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary">
                                {top3[0].totalPercentual.toFixed(1)}%
                            </span>
                        </div>
                        <Badge className="w-full justify-center text-base sm:text-lg py-2">
                            {getStatusEmoji(top3[0].totalPercentual)} {getStatusText(top3[0].totalPercentual)}
                        </Badge>
                        <Progress value={Math.min(top3[0].totalPercentual, 100)} className="h-4" />
                        {top3[0].atividades.length > 0 && (
                            <p className="text-xs text-muted-foreground text-center">
                                {top3[0].atividades.map(a => a.nome).join(", ")}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* 3º Lugar */}
            {top3[2] && (
                <Card className="border-2 border-orange-600 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
                    <CardHeader className="text-center pb-2">
                        <div className="text-4xl sm:text-5xl md:text-6xl mb-2">🥉</div>
                        <CardTitle className="text-lg sm:text-xl md:text-2xl">{top3[2].colaborador.nome}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-center">
                            <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">
                                {top3[2].totalPercentual.toFixed(1)}%
                            </span>
                        </div>
                        <Badge className="w-full justify-center text-sm sm:text-base py-2">
                            {getStatusEmoji(top3[2].totalPercentual)} {getStatusText(top3[2].totalPercentual)}
                        </Badge>
                        <Progress value={Math.min(top3[2].totalPercentual, 100)} className="h-3" />
                        {top3[2].atividades.length > 0 && (
                            <p className="text-xs text-muted-foreground text-center">
                                {top3[2].atividades.map(a => a.nome).join(", ")}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
