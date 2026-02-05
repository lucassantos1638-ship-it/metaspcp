interface Producao {
  etapa_id: string;
  subetapa_id: string | null;
  etapa: { nome: string; ordem: number };
  subetapa: { nome: string } | null;

  colaborador_nome?: string;
  colaborador_custo_hora?: number;
  colaborador_custo_extra?: number;
  quantidade_produzida: number | null;
  tempo_produtivo_minutos: number | null;
  minutos_normais: number | null;
  minutos_extras: number | null;
  status: string;
}

export interface EtapaProgresso {
  etapa_id: string;
  subetapa_id: string | null;
  etapa_nome: string;
  subetapa_nome: string | null;
  etapa_ordem: number;
  quantidade_produzida: number;
  quantidade_total: number;
  percentual: number;
  tempo_total: number;
  tempo_normal: number;
  tempo_extra: number;
  custo_total: number;
  colaboradores: string[];
  status: 'concluida' | 'em_andamento' | 'pendente';
}

export function agruparPorEtapa(
  producoes: Producao[],
  quantidadeTotal: number,
  todasEtapas: any[] = []
): EtapaProgresso[] {
  const etapasMap = new Map<string, EtapaProgresso>();

  // 1. Inicializar com todas as etapas (mesmo as sem produção)
  todasEtapas.forEach(etapaDef => {
    // Se tiver subetapas, cria uma entrada para cada
    if (etapaDef.subetapas && etapaDef.subetapas.length > 0) {
      etapaDef.subetapas.forEach((sub: any) => {
        const key = `${etapaDef.id}-${sub.id}`;
        etapasMap.set(key, {
          etapa_id: etapaDef.id,
          subetapa_id: sub.id,
          etapa_nome: etapaDef.nome,
          subetapa_nome: sub.nome,
          etapa_ordem: etapaDef.ordem,
          quantidade_produzida: 0,
          quantidade_total: quantidadeTotal,
          percentual: 0,
          tempo_total: 0,
          tempo_normal: 0,
          tempo_extra: 0,
          custo_total: 0,
          colaboradores: [],
          status: 'pendente'
        });
      });
    } else {
      // Etapa sem subetapas (ou trata como única)
      const key = `${etapaDef.id}-main`;
      etapasMap.set(key, {
        etapa_id: etapaDef.id,
        subetapa_id: null,
        etapa_nome: etapaDef.nome,
        subetapa_nome: null,
        etapa_ordem: etapaDef.ordem,
        quantidade_produzida: 0,
        quantidade_total: quantidadeTotal,
        percentual: 0,
        tempo_total: 0,
        tempo_normal: 0,
        tempo_extra: 0,
        custo_total: 0,
        colaboradores: [],
        status: 'pendente'
      });
    }
  });

  // 2. Preencher com dados reais de produção
  producoes.forEach(prod => {
    const key = `${prod.etapa_id}-${prod.subetapa_id || 'main'}`;

    // Se não existir (caso de etapa apagada ou inconsistência), cria
    if (!etapasMap.has(key)) {
      etapasMap.set(key, {
        etapa_id: prod.etapa_id,
        subetapa_id: prod.subetapa_id,
        etapa_nome: prod.etapa.nome,
        subetapa_nome: prod.subetapa?.nome || null,
        etapa_ordem: prod.etapa.ordem,
        quantidade_produzida: 0,
        quantidade_total: quantidadeTotal,
        percentual: 0,
        tempo_total: 0,
        tempo_normal: 0,
        tempo_extra: 0,
        custo_total: 0,
        colaboradores: [],
        status: 'pendente'
      });
    }

    const etapa = etapasMap.get(key)!;

    // Cálculo de custos
    const custoHora = prod.colaborador_custo_hora || 0;
    const custoExtra = prod.colaborador_custo_extra || custoHora;

    const minutosNormais = Number(prod.minutos_normais) || 0;
    const minutosExtras = Number(prod.minutos_extras) || 0;

    // Calcula custo independente do status (se tiver tempo registrado, tem custo)
    const custoN = (minutosNormais / 60) * custoHora;
    const custoE = (minutosExtras / 60) * custoExtra;

    etapa.custo_total += custoN + custoE;

    if (prod.status === 'finalizado') {
      etapa.quantidade_produzida += Number(prod.quantidade_produzida) || 0;
      etapa.tempo_total += Number(prod.tempo_produtivo_minutos) || 0;
      etapa.tempo_normal += minutosNormais;
      etapa.tempo_extra += minutosExtras;
    } else if (prod.status === 'em_aberto') {
      etapa.tempo_total += Number(prod.tempo_produtivo_minutos) || 0;
      etapa.tempo_normal += minutosNormais;
      etapa.tempo_extra += minutosExtras;
    }

    if (prod.colaborador_nome) {
      // Guardar lista de colaboradores
      if (!etapa.colaboradores.includes(prod.colaborador_nome)) {
        etapa.colaboradores.push(prod.colaborador_nome);
      }
    }
  });

  // 2.1 Pós-processamento para corrigir quantidades duplicadas (trabalho em equipe no mesmo lote)
  // Se a soma das quantidades exceder muito o total do lote (> 120%) 
  // E houver múltiplos registros com quantidade próxima ao total do lote,
  // assumimos que é trabalho compartilhado e não soma.
  etapasMap.forEach((etapa, key) => {
    if (etapa.quantidade_produzida > quantidadeTotal * 1.2) {
      // Filtrar produções desta etapa
      const producoesDaEtapa = producoes.filter(p => {
        const pKey = `${p.etapa_id}-${p.subetapa_id || 'main'}`;
        return pKey === key && p.status === 'finalizado';
      });

      // Verificar quantos registros têm quantidade "full" (>= 90% do total)
      const registrosFull = producoesDaEtapa.filter(p =>
        (Number(p.quantidade_produzida) || 0) >= quantidadeTotal * 0.9
      );

      if (registrosFull.length > 1) {
        // Detectado caso de duplicação por equipe
        // Definimos a quantidade produzida como a maior quantidade individual encontrada (ou o total do lote)
        // Mas para ser seguro, pegamos o MAX dos registros
        const maxQtd = Math.max(...producoesDaEtapa.map(p => Number(p.quantidade_produzida) || 0));
        etapa.quantidade_produzida = maxQtd;
      }
    }
  });

  // Calcular percentuais e status
  const etapasArray = Array.from(etapasMap.values());
  etapasArray.forEach(etapa => {
    etapa.percentual = quantidadeTotal > 0
      ? Math.round((etapa.quantidade_produzida / quantidadeTotal) * 100)
      : 0;

    if (etapa.percentual >= 100) {
      etapa.status = 'concluida';
    } else if (etapa.quantidade_produzida > 0 || etapa.colaboradores.length > 0) {
      etapa.status = 'em_andamento';
    }
  });

  return etapasArray.sort((a, b) => a.etapa_ordem - b.etapa_ordem);
}
