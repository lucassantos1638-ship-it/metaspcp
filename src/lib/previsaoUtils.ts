// Contar dias úteis entre duas datas (seg-sex)
export function contarDiasUteis(dataInicio: Date, dataFim: Date): number {
  let dias = 0;
  const atual = new Date(dataInicio);
  
  while (atual <= dataFim) {
    const diaSemana = atual.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      dias++;
    }
    atual.setDate(atual.getDate() + 1);
  }
  
  return dias;
}

// Adicionar N dias úteis a uma data
export function adicionarDiasUteis(data: Date, dias: number): Date {
  const resultado = new Date(data);
  let diasAdicionados = 0;
  
  while (diasAdicionados < dias) {
    resultado.setDate(resultado.getDate() + 1);
    const diaSemana = resultado.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasAdicionados++;
    }
  }
  
  return resultado;
}

// Formatar duração em horas/dias
export function formatarDuracao(horas: number): string {
  if (horas < 24) {
    return `${horas.toFixed(1)}h`;
  }
  const dias = Math.floor(horas / 9); // 9h úteis por dia
  const horasRestantes = horas % 9;
  return `${dias} dias${horasRestantes > 0 ? ` e ${horasRestantes.toFixed(1)}h` : ''}`;
}
