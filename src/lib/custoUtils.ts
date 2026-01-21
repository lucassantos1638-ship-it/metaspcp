export interface CustoDetalhes {
  tempoMinutos: number;
  tempoHoras: number;
  custoPorHora: number;
  custoTotal: number;
}

/**
 * Calcula o custo total baseado no tempo em minutos e custo por hora
 */
export function calcularCusto(
  tempoMinutos: number,
  custoPorHora: number
): CustoDetalhes {
  const tempoHoras = tempoMinutos / 60;
  const custoTotal = tempoHoras * custoPorHora;

  return {
    tempoMinutos,
    tempoHoras,
    custoPorHora,
    custoTotal,
  };
}

/**
 * Formata o custo em reais
 */
export function formatarCusto(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

/**
 * Formata tempo em horas, minutos e segundos
 */
export function formatarTempoDetalhado(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const mins = Math.floor(minutos % 60);
  const segs = Math.round((minutos % 1) * 60);

  const partes: string[] = [];
  if (horas > 0) partes.push(`${horas}h`);
  if (mins > 0) partes.push(`${mins}min`);
  if (segs > 0 || partes.length === 0) partes.push(`${segs}s`);

  return partes.join(" ");
}
