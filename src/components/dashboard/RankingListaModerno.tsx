import { User } from "lucide-react";

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

interface RankingListaModernoProps {
    restante: RankingItem[];
}

export function RankingListaModerno({ restante }: RankingListaModernoProps) {
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
                            className="relative w-[220px] bg-white rounded-xl p-3 flex flex-col justify-between group hover:-translate-y-1 transition-all duration-300 shadow-sm border border-gray-100 hover:shadow-lg"
                        >
                            {/* Header: Posicao e Status Dot */}
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-black text-gray-200">
                                        {String(item.posicao).padStart(2, '0')}
                                    </span>
                                </div>
                                <div className={`w-2 h-2 rounded-full ${item.totalPercentual >= 100 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-400'}`} />
                            </div>

                            {/* Infos */}
                            <div className="mb-2">
                                <div className="text-[8px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Colaborador</div>
                                <h4 className="font-bold text-sm text-gray-800 line-clamp-1 group-hover:text-amber-600 transition-colors">
                                    {item.colaborador.nome}
                                </h4>
                            </div>

                            {/* Progress */}
                            <div className="space-y-1">
                                <div className="flex justify-between items-end">
                                    <span className="text-xl font-black text-gray-800">{item.totalPercentual.toFixed(1)}%</span>
                                </div>

                                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-500 rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${Math.min(item.totalPercentual, 100)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="border-t border-gray-50 mt-2 pt-2 flex justify-between items-center">
                                <p className="text-[8px] text-gray-400 truncate max-w-[140px]">
                                    {item.atividades.map(a => a.nome).join(", ")}
                                </p>
                                <User className="w-3 h-3 text-gray-300" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
