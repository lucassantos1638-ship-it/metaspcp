import { Trophy, Star, TrendingUp } from "lucide-react";
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

interface RankingModernoProps {
    top3: RankingItem[];
    compact?: boolean;
}

// Medalha SVG Component - Clean & Realistic Style
const Medalha = ({ rank, className }: { rank: 1 | 2 | 3, className?: string }) => {
    const props = {
        1: {
            fill: "url(#gradGold)",
            stroke: "#B7791F",
            ribbon: "#ef4444",
            text: "1",
            shadow: "drop-shadow-[0_10px_10px_rgba(234,179,8,0.4)]"
        },
        2: {
            fill: "url(#gradSilver)",
            stroke: "#64748B",
            ribbon: "#3b82f6",
            text: "2",
            shadow: "drop-shadow-[0_10px_10px_rgba(148,163,184,0.4)]"
        },
        3: {
            fill: "url(#gradBronze)",
            stroke: "#9A3412",
            ribbon: "#3b82f6",
            text: "3",
            shadow: "drop-shadow-[0_10px_10px_rgba(234,88,12,0.4)]"
        }
    }[rank];

    return (
        <svg viewBox="0 0 100 120" className={cn(props.shadow, className, "overflow-visible")}>
            <defs>
                <linearGradient id="gradGold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FDE047" />
                    <stop offset="50%" stopColor="#EAB308" />
                    <stop offset="100%" stopColor="#CA8A04" />
                </linearGradient>
                <linearGradient id="gradSilver" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F1F5F9" />
                    <stop offset="50%" stopColor="#CBD5E1" />
                    <stop offset="100%" stopColor="#94A3B8" />
                </linearGradient>
                <linearGradient id="gradBronze" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFEDD5" />
                    <stop offset="50%" stopColor="#FB923C" />
                    <stop offset="100%" stopColor="#EA580C" />
                </linearGradient>
            </defs>

            {/* Fita / Ribbon */}
            <path d="M32 0 L50 25 L68 0" fill={props.ribbon} style={{ filter: 'brightness(0.8)' }} />
            <path d="M20 0 L32 0 L50 25 L38 25 Z" fill={props.ribbon} />
            <path d="M80 0 L68 0 L50 25 L62 25 Z" fill={props.ribbon} />

            {/* Medalha Corpo */}
            <circle cx="50" cy="70" r="32" fill={props.fill} stroke={props.stroke} strokeWidth="2" />
            <circle cx="50" cy="70" r="26" fill="none" stroke="white" strokeWidth="1" opacity="0.6" strokeDasharray="4 2" />

            {/* Número */}
            <text x="50" y="82" textAnchor="middle" fill="white" fontSize="28" fontWeight="900" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                {props.text}
            </text>
        </svg>
    );
};

export function RankingModerno({ top3, compact = false }: RankingModernoProps) {
    // Garantir que temos 3 posições preenchidas (mesmo que undefined) para o layout não quebrar
    const primeiro = top3[0];
    const segundo = top3[1];
    const terceiro = top3[2];

    return (
        <div className={cn("relative w-full max-w-5xl mx-auto transition-all",
            compact ? "pt-16 pb-4" : "pt-32 pb-12 md:pb-16"
        )}>
            <div className={cn("flex flex-row justify-center items-end gap-2 md:gap-8 transition-all",
                compact ? "min-h-[300px]" : "min-h-[480px]"
            )}>

                {/* 2º Lugar (Esquerda) */}
                <div className="order-1 flex-1 w-full md:w-auto max-w-sm flex flex-col justify-end">
                    {segundo && (
                        <div className={cn("bg-white rounded-t-3xl rounded-b-xl shadow-xl border border-slate-100 flex flex-col items-center relative justify-between transition-all",
                            compact ? "h-[260px] p-4 scale-95 origin-bottom" : "h-[360px] p-6"
                        )}>
                            <div className={cn("absolute z-10", compact ? "-top-8" : "-top-12")}>
                                <Medalha rank={2} className={compact ? "w-16 h-16" : "w-24 h-24"} />
                            </div>

                            <div className={cn("text-center w-full space-y-2", compact ? "mt-8" : "mt-14")}>
                                <div>
                                    <h3 className={cn("font-bold text-slate-700 uppercase tracking-wide", compact ? "text-sm" : "text-xl")}>{segundo.colaborador.nome}</h3>
                                    <p className="text-sm text-slate-400 font-medium">2º Lugar</p>
                                </div>

                                <div className={cn("font-black text-slate-700 tracking-tighter", compact ? "text-3xl" : "text-5xl")}>
                                    {segundo.totalPercentual.toFixed(1)}%
                                </div>

                                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-slate-300 to-slate-500 w-[50%] transition-all duration-1000" style={{ width: `${Math.min(segundo.totalPercentual, 100)}%` }}></div>
                                </div>

                                {!compact && (
                                    <div className="bg-slate-50 border border-slate-100 py-3 rounded-xl w-full flex items-center justify-center gap-2 text-slate-600 font-semibold text-sm">
                                        <TrendingUp className="w-4 h-4" /> Em Progresso
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 1º Lugar (Centro - Maior) */}
                <div className={cn("order-2 flex-1 w-full md:w-auto max-w-sm z-20", compact ? "-mt-4" : "-mt-8 md:-mt-16")}>
                    {primeiro && (
                        <div className={cn("bg-white rounded-t-3xl rounded-b-xl shadow-2xl border-t-4 border-yellow-400 flex flex-col items-center relative justify-between transition-all",
                            compact ? "h-[320px] p-4 scale-100" : "h-[440px] p-8"
                        )}>
                            {/* Badge Top */}
                            <div className={cn("absolute flex flex-col items-center animate-bounce-slow", compact ? "-top-14" : "-top-20")}>
                                <div className="bg-yellow-400 text-yellow-950 p-2.5 rounded-full shadow-lg mb-2">
                                    <Trophy className={compact ? "w-5 h-5" : "w-6 h-6 stroke-[2.5]"} />
                                </div>
                            </div>

                            <div className={cn("absolute z-10", compact ? "-top-10" : "-top-12")}>
                                <Medalha rank={1} className={compact ? "w-24 h-24" : "w-32 h-32"} />
                            </div>

                            <div className={cn("text-center w-full space-y-3", compact ? "mt-12" : "mt-20")}>
                                <div>
                                    <h3 className={cn("font-bold text-yellow-600 uppercase tracking-widest", compact ? "text-lg" : "text-2xl")}>{primeiro.colaborador.nome}</h3>
                                    <div className="flex items-center justify-center gap-1 mt-1">
                                        <Star className={compact ? "w-3 h-3 fill-yellow-400 text-yellow-400" : "w-4 h-4 fill-yellow-400 text-yellow-400"} />
                                        <Star className={compact ? "w-3 h-3 fill-yellow-400 text-yellow-400" : "w-4 h-4 fill-yellow-400 text-yellow-400"} />
                                        <Star className={compact ? "w-3 h-3 fill-yellow-400 text-yellow-400" : "w-4 h-4 fill-yellow-400 text-yellow-400"} />
                                    </div>
                                </div>

                                <div className={cn("font-black text-slate-900 tracking-tighter drop-shadow-sm", compact ? "text-5xl" : "text-7xl")}>
                                    {primeiro.totalPercentual.toFixed(1)}%
                                </div>

                                <div className="w-full bg-yellow-50 h-4 rounded-full overflow-hidden relative border border-yellow-100">
                                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-400 transition-all duration-1000" style={{ width: `${Math.min(primeiro.totalPercentual, 100)}%` }}></div>
                                    {/* Shimmer effect overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full -translate-x-full animate-shimmer"></div>
                                </div>

                                <div className={cn("bg-yellow-50 border border-yellow-200 text-yellow-800 font-bold rounded-xl w-full flex items-center justify-center gap-2 shadow-sm",
                                    compact ? "py-2 px-4 text-xs" : "py-4 px-6 text-base"
                                )}>
                                    <Star className={compact ? "w-3 h-3 fill-yellow-600" : "w-5 h-5 fill-yellow-600"} /> TOP PERFORMANCE
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3º Lugar (Direita) */}
                <div className="order-3 flex-1 w-full md:w-auto max-w-sm flex flex-col justify-end">
                    {terceiro && (
                        <div className={cn("bg-white rounded-t-3xl rounded-b-xl shadow-xl border border-slate-100 flex flex-col items-center relative justify-between transition-all",
                            compact ? "h-[260px] p-4 scale-95 origin-bottom" : "h-[360px] p-6"
                        )}>
                            <div className={cn("absolute z-10", compact ? "-top-8" : "-top-12")}>
                                <Medalha rank={3} className={compact ? "w-16 h-16" : "w-24 h-24"} />
                            </div>

                            <div className={cn("text-center w-full space-y-2", compact ? "mt-8" : "mt-14")}>
                                <div>
                                    <h3 className={cn("font-bold text-orange-900 uppercase tracking-wide", compact ? "text-sm" : "text-xl")}>{terceiro.colaborador.nome}</h3>
                                    <p className="text-sm text-slate-400 font-medium">3º Lugar</p>
                                </div>

                                <div className={cn("font-black text-slate-700 tracking-tighter", compact ? "text-3xl" : "text-5xl")}>
                                    {terceiro.totalPercentual.toFixed(1)}%
                                </div>

                                <div className="w-full bg-orange-50 h-3 rounded-full overflow-hidden relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-300 to-orange-500 w-[50%] transition-all duration-1000" style={{ width: `${Math.min(terceiro.totalPercentual, 100)}%` }}></div>
                                </div>

                                {!compact && (
                                    <div className="bg-slate-50 border border-slate-100 py-3 rounded-xl w-full flex items-center justify-center gap-2 text-slate-600 font-semibold text-sm">
                                        <TrendingUp className="w-4 h-4" /> Em Progresso
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

