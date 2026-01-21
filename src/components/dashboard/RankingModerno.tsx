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
            compact ? "pt-2 pb-0" : "pt-10 pb-4 md:pb-6"
        )}>
            <div className={cn("flex flex-row justify-center items-end gap-1 md:gap-4 transition-all",
                compact ? "min-h-[60px]" : "min-h-[200px]"
            )}>

                {/* 2º Lugar (Esquerda) */}
                <div className="order-1 flex-1 w-full md:w-auto max-w-sm flex flex-col justify-end">
                    {segundo && (
                        <div className={cn("bg-white rounded-t-lg rounded-b-md shadow-sm border border-slate-100 flex flex-col items-center relative justify-between transition-all",
                            compact ? "h-[55px] p-1 scale-95 origin-bottom" : "h-[170px] p-3"
                        )}>
                            <div className={cn("absolute z-10", compact ? "-top-2" : "-top-8")}>
                                <Medalha rank={2} className={compact ? "w-4 h-4" : "w-14 h-14"} />
                            </div>

                            <div className={cn("text-center w-full space-y-1", compact ? "mt-2" : "mt-6")}>
                                <div className="min-h-[2.5rem] flex items-end justify-center">
                                    <h3 className={cn("font-bold text-slate-700 uppercase tracking-wide leading-tight px-1", compact ? "text-[6px] truncate" : "text-xs line-clamp-2")}>{segundo.colaborador.nome}</h3>
                                </div>
                                <p className={cn("text-slate-400 font-medium hidden", compact ? "hidden" : "block text-[10px]")}>2º Lugar</p>

                                <div className={cn("font-black text-slate-700 tracking-tighter", compact ? "text-xs" : "text-2xl")}>
                                    {segundo.totalPercentual.toFixed(0)}%
                                </div>

                                <div className={cn("w-full bg-slate-100 rounded-full overflow-hidden relative", compact ? "h-1" : "h-2")}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-slate-300 to-slate-500 w-[50%] transition-all duration-1000" style={{ width: `${Math.min(segundo.totalPercentual, 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 1º Lugar (Centro - Maior) */}
                <div className={cn("order-2 flex-1 w-full md:w-auto max-w-sm z-20", compact ? "-mt-4" : "-mt-8 md:-mt-16")}>
                    {primeiro && (
                        <div className={cn("bg-white rounded-t-lg rounded-b-md shadow-md border-t-2 border-yellow-400 flex flex-col items-center relative justify-between transition-all",
                            compact ? "h-[70px] p-1 scale-100" : "h-[210px] p-3"
                        )}>
                            <div className={cn("absolute z-10", compact ? "-top-3" : "-top-8")}>
                                <Medalha rank={1} className={compact ? "w-6 h-6" : "w-16 h-16"} />
                            </div>

                            <div className={cn("text-center w-full space-y-1", compact ? "mt-3" : "mt-10")}>
                                <div className="min-h-[2.5rem] flex items-end justify-center">
                                    <h3 className={cn("font-bold text-yellow-600 uppercase tracking-widest leading-tight px-1", compact ? "text-[6px] truncate" : "text-sm line-clamp-2")}>{primeiro.colaborador.nome}</h3>
                                </div>
                                <p className={cn("text-yellow-600 font-medium hidden", compact ? "hidden" : "block text-[10px]")}>1º Lugar</p>

                                <div className={cn("font-black text-slate-900 tracking-tighter drop-shadow-sm", compact ? "text-sm" : "text-4xl")}>
                                    {primeiro.totalPercentual.toFixed(0)}%
                                </div>

                                <div className={cn("w-full bg-yellow-50 rounded-full overflow-hidden relative border border-yellow-100", compact ? "h-1.5" : "h-3")}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-400 transition-all duration-1000" style={{ width: `${Math.min(primeiro.totalPercentual, 100)}%` }}></div>
                                    {/* Shimmer effect overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full -translate-x-full animate-shimmer"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3º Lugar (Direita) */}
                <div className="order-3 flex-1 w-full md:w-auto max-w-sm flex flex-col justify-end">
                    {terceiro && (
                        <div className={cn("bg-white rounded-t-lg rounded-b-md shadow-sm border border-slate-100 flex flex-col items-center relative justify-between transition-all",
                            compact ? "h-[55px] p-1 scale-95 origin-bottom" : "h-[170px] p-3"
                        )}>
                            <div className={cn("absolute z-10", compact ? "-top-2" : "-top-8")}>
                                <Medalha rank={3} className={compact ? "w-4 h-4" : "w-14 h-14"} />
                            </div>

                            <div className={cn("text-center w-full space-y-1", compact ? "mt-2" : "mt-6")}>
                                <div className="min-h-[2.5rem] flex items-end justify-center">
                                    <h3 className={cn("font-bold text-orange-900 uppercase tracking-wide leading-tight px-1", compact ? "text-[6px] truncate" : "text-xs line-clamp-2")}>{terceiro.colaborador.nome}</h3>
                                </div>
                                <p className={cn("text-slate-400 font-medium hidden", compact ? "hidden" : "block text-[10px]")}>3º Lugar</p>

                                <div className={cn("font-black text-slate-700 tracking-tighter", compact ? "text-xs" : "text-2xl")}>
                                    {terceiro.totalPercentual.toFixed(0)}%
                                </div>

                                <div className={cn("w-full bg-orange-50 rounded-full overflow-hidden relative", compact ? "h-1" : "h-2")}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-300 to-orange-500 w-[50%] transition-all duration-1000" style={{ width: `${Math.min(terceiro.totalPercentual, 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
