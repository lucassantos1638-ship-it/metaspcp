export function formatarTempoProdutivo(minutos: number): string {
  if (minutos === 0) return "0h 0min";
  
  const horas = Math.floor(minutos / 60);
  const mins = Math.floor(minutos % 60);
  const segs = Math.round((minutos % 1) * 60);
  
  const partes: string[] = [];
  if (horas > 0) partes.push(`${horas}h`);
  if (mins > 0) partes.push(`${mins}min`);
  if (segs > 0) partes.push(`${segs}s`);
  
  return partes.join(" ") || "0h 0min";
}

export function minutosParaHoras(minutos: number): number {
  return minutos / 60;
}

export function formatarData(data: string): string {
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

export function formatarHora(hora: string): string {
  return hora.substring(0, 5);
}
