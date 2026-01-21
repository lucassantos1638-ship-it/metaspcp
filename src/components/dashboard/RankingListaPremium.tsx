import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { User, TrendingUp } from "lucide-react";

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

interface RankingListaPremiumProps {
    restante: RankingItem[];
}

export function RankingListaPremium({ restante }: RankingListaPremiumProps) {
    return (
        <div className="relative">
            {/* Fade Sides */}
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div className="overflow-hidden relative">
                <div
                    className="animate-scroll-horizontal flex gap-6 p-6 items-center min-w-max"
                    style={{
                        animationDuration: `120s`,
                        willChange: 'transform'
                    }}
                >
                    {restante.map((item, idx) => (
                        <div
                            key={`${item.colaborador.id}-${idx}`}
                            className="relative w-[300px] bg-white rounded-2xl p-6 flex flex-col justify-between group hover:-translate-y-1 transition-all duration-300 shadow-sm border border-gray-100 hover:shadow-xl"
                        >
                            {/* Header: Posicao e Status Dot */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-4xl font-bold text-gray-200">
                                        {String(item.posicao).padStart(2, '0')}
                                    </span>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${item.totalPercentual >= 100 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-400'}`} />
                            </div>

                            {/* Infos */}
                            <div className="mb-4">
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Colaborador</div>
                                <h4 className="font-bold text-lg text-gray-800 line-clamp-1 group-hover:text-blue-600 transition-colors">
                                    {item.colaborador.nome}
                                </h4>
                            </div>

                            {/* Progress */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-3xl font-black text-gray-800">{item.totalPercentual.toFixed(1)}%</span>
                                </div>

                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${Math.min(item.totalPercentual, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="border-t border-gray-50 mt-4 pt-3 flex justify-between items-center">
                                <p className="text-[10px] text-gray-400 truncate max-w-[180px]">
                                    {item.atividades.map(a => a.nome).join(", ")}
                                </p>
                                <User className="w-4 h-4 text-gray-300" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
