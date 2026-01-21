import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Medal, Trophy, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface RankingPremiumProps {
    top3: RankingItem[];
}

// Custom Medal SVGs for a more realistic look matching the reference
const MedalSVG = ({ rank, className }: { rank: 1 | 2 | 3, className?: string }) => {
    const colors = {
        1: { main: "#EAB308", light: "#FDE047", ribbon: "#ef4444" }, // Gold + Red Ribbon
        2: { main: "#94a3b8", light: "#cbd5e1", ribbon: "#3b82f6" }, // Silver + Blue Ribbon
        3: { main: "#ea580c", light: "#fdba74", ribbon: "#3b82f6" }  // Bronze + Blue Ribbon
    };

    const c = colors[rank];

    return (
        <svg viewBox="0 0 100 120" className={cn("drop-shadow-lg", className)}>
            {/* Ribbon */}
            <path d="M30 0 L50 30 L70 0" fill={c.ribbon} />
            <path d="M30 0 L20 10 L40 40 L50 30" fill={c.ribbon} style={{ filter: 'brightness(0.8)' }} />
            <path d="M70 0 L80 10 L60 40 L50 30" fill={c.ribbon} style={{ filter: 'brightness(0.8)' }} />

            {/* Medal Circle */}
            <circle cx="50" cy="70" r="28" fill={c.main} stroke={c.light} strokeWidth="2" />
            <circle cx="50" cy="70" r="23" fill="none" stroke={c.light} strokeWidth="1" opacity="0.5" strokeDasharray="3 2" />

            {/* Rank Number */}
            <text x="50" y="82" textAnchor="middle" fill="#FFFFFF" fontSize="24" fontWeight="900" style={{ textShadow: '0px 2px 2px rgba(0,0,0,0.3)' }}>
                {rank}
            </text>

            {/* Laurels inside medal */}
            <path d="M35 75 Q30 65 35 55" stroke="white" strokeWidth="2" fill="none" opacity="0.4" />
            <path d="M65 75 Q70 65 65 55" stroke="white" strokeWidth="2" fill="none" opacity="0.4" />
        </svg>
    );
}

export function RankingPremium({ top3 }: RankingPremiumProps) {
    return (
        <div className="relative py-8">
            <div className="flex flex-wrap md:flex-nowrap justify-center items-end gap-6 min-h-[450px]">

                {/* 2º Lugar */}
                <div className="order-2 md:order-1 flex-1 min-w-[300px] max-w-[350px]">
                    {top3[1] && (
                        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex flex-col items-center relative h-[380px] justify-between transition-transform hover:-translate-y-2 duration-300">
                            <div className="absolute -top-10">
                                <MedalSVG rank={2} className="w-24 h-24" />
                            </div>

                            <div className="mt-12 text-center w-full">
                                <h3 className="text-xl font-bold text-gray-600 mb-1">{top3[1].colaborador.nome}</h3>
                                <div className="text-5xl font-black text-gray-800 tracking-tighter mb-6">
                                    {top3[1].totalPercentual.toFixed(1)}%
                                </div>

                                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-6 relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-400 to-gray-300 w-[44%]" style={{ width: `${Math.min(top3[1].totalPercentual, 100)}%` }}></div>
                                </div>

                                <div className="bg-blue-50 text-blue-600 font-bold py-3 px-6 rounded-xl w-full flex items-center justify-center gap-2">
                                    <TrendingUp className="w-4 h-4" /> EM PROGRESSO
                                </div>

                                {top3[1].atividades.length > 0 && (
                                    <p className="mt-4 text-[10px] text-gray-400 uppercase tracking-widest text-center">
                                        {top3[1].atividades.map(a => a.nome).join(", ").slice(0, 40)}...
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 1º Lugar */}
                <div className="order-1 md:order-2 flex-1 min-w-[320px] max-w-[380px] z-10 -mt-12">
                    {top3[0] && (
                        <div className="bg-white rounded-3xl p-8 shadow-2xl border-2 border-yellow-100 flex flex-col items-center relative h-[450px] justify-between scale-105 transition-transform hover:-translate-y-2 duration-300">
                            {/* Top Badge */}
                            <div className="absolute -top-16 flex flex-col items-center text-yellow-500">
                                <div className="bg-yellow-500 text-white p-2 rounded-lg shadow-lg mb-2">
                                    <Trophy className="w-6 h-6" />
                                </div>
                                <Star className="w-6 h-6 fill-current animate-pulse" />
                            </div>

                            <div className="absolute -top-12">
                                <MedalSVG rank={1} className="w-32 h-32" />
                            </div>

                            <div className="mt-20 text-center w-full">
                                <h3 className="text-2xl font-bold text-yellow-600 mb-2 uppercase tracking-wide">{top3[0].colaborador.nome}</h3>
                                <div className="text-7xl font-black text-yellow-600 tracking-tighter mb-8 drop-shadow-sm">
                                    {top3[0].totalPercentual.toFixed(1)}%
                                </div>

                                <div className="w-full bg-yellow-50 h-4 rounded-full overflow-hidden mb-8 relative border border-yellow-100">
                                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-400" style={{ width: `${Math.min(top3[0].totalPercentual, 100)}%` }}></div>
                                </div>

                                <div className="bg-yellow-50 text-yellow-600 border border-yellow-200 font-bold py-4 px-8 rounded-xl w-full flex items-center justify-center gap-2 shadow-sm">
                                    <Star className="w-5 h-5 fill-current" /> TOP PERFORMANCE
                                </div>

                                {top3[0].atividades.length > 0 && (
                                    <p className="mt-6 text-xs text-gray-400 uppercase tracking-widest font-semibold text-center">
                                        {top3[0].atividades.map(a => a.nome).join(", ")}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 3º Lugar */}
                <div className="order-3 flex-1 min-w-[300px] max-w-[350px]">
                    {top3[2] && (
                        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex flex-col items-center relative h-[380px] justify-between transition-transform hover:-translate-y-2 duration-300">
                            <div className="absolute -top-10">
                                <MedalSVG rank={3} className="w-24 h-24" />
                            </div>

                            <div className="mt-12 text-center w-full">
                                <h3 className="text-xl font-bold text-orange-800 mb-1">{top3[2].colaborador.nome}</h3>
                                <div className="text-5xl font-black text-gray-800 tracking-tighter mb-6">
                                    {top3[2].totalPercentual.toFixed(1)}%
                                </div>

                                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-6 relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-300 via-orange-500 to-orange-400" style={{ width: `${Math.min(top3[2].totalPercentual, 100)}%` }}></div>
                                </div>

                                <div className="bg-blue-50 text-blue-600 font-bold py-3 px-6 rounded-xl w-full flex items-center justify-center gap-2">
                                    <TrendingUp className="w-4 h-4" /> EM PROGRESSO
                                </div>

                                {top3[2].atividades.length > 0 && (
                                    <p className="mt-4 text-[10px] text-gray-400 uppercase tracking-widest text-center">
                                        {top3[2].atividades.map(a => a.nome).join(", ").slice(0, 40)}...
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
