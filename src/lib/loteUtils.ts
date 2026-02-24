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

  terceirizado?: boolean;
  entidade_id?: string | null;
  servico_id?: string | null;
  quantidade_enviada?: number | null;
  quantidade_devolvida?: number | null;
  entidade?: { nome: string } | null;
  servico?: { nome: string; valor: number } | null;
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
  colaboradores_detalhes: { nome: string; tempo: number; quantidade: number }[];
  status: 'concluida' | 'em_andamento' | 'pendente';
  is_terceirizado?: boolean;
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
          colaboradores_detalhes: [],
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
        colaboradores_detalhes: [],
        status: 'pendente'
      });
    }
  });

  // 2. Preencher com dados reais de produção
  producoes.forEach(prod => {
    // Se for terceirizado, agrupamos por serviço para ficar detalhado
    const key = prod.terceirizado
      ? `terceirizado-${prod.servico_id || 'general'}`
      : `${prod.etapa_id}-${prod.subetapa_id || 'main'}`;

    // Se não existir (caso de etapa apagada, terceirizado, ou inconsistência), cria
    if (!etapasMap.has(key)) {
      etapasMap.set(key, {
        etapa_id: prod.terceirizado ? 'terceirizado' : prod.etapa_id,
        subetapa_id: prod.terceirizado ? prod.servico_id : prod.subetapa_id,
        etapa_nome: prod.terceirizado ? 'Terceirização' : (prod.etapa?.nome || 'Desconhecido'),
        subetapa_nome: prod.terceirizado ? (prod.servico?.nome || 'Serviço G.') : (prod.subetapa?.nome || null),
        etapa_ordem: prod.terceirizado ? 999 : (prod.etapa?.ordem || 999),
        quantidade_produzida: 0,
        quantidade_total: quantidadeTotal,
        percentual: 0,
        tempo_total: 0,
        tempo_normal: 0,
        tempo_extra: 0,
        custo_total: 0,
        colaboradores: [],
        colaboradores_detalhes: [],
        status: 'pendente',
        is_terceirizado: prod.terceirizado
      });
    }

    const etapa = etapasMap.get(key)!;

    // Cálculo de custos
    if (prod.terceirizado) {
      // Custo de terceirização = quantidade_devolvida * valor do serviço
      const qtdeValida = Number(prod.quantidade_devolvida) || 0;
      const valorServico = Number(prod.servico?.valor) || 0;
      etapa.custo_total += (qtdeValida * valorServico);

      // Controlando a quantidade visualmente na tabela
      if (prod.status === 'finalizado') {
        etapa.quantidade_produzida += qtdeValida;
      } else if (prod.status === 'em_aberto') {
        etapa.quantidade_produzida += qtdeValida; // Mostrar o que já devolveu mesmo aberto
      }

      if (prod.entidade?.nome) {
        if (!etapa.colaboradores.includes(prod.entidade.nome)) {
          etapa.colaboradores.push(prod.entidade.nome);
        }
      }
    } else {
      const custoHora = prod.colaborador_custo_hora || 0;
      const custoExtra = prod.colaborador_custo_extra || custoHora;

      const minutosNormais = Math.max(0, Number(prod.minutos_normais) || 0);
      const minutosExtras = Math.max(0, Number(prod.minutos_extras) || 0);

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
        // Guardar lista de colaboradores (mantendo compatibilidade)
        if (!etapa.colaboradores.includes(prod.colaborador_nome)) {
          etapa.colaboradores.push(prod.colaborador_nome);
        }

        // Guardar detalhes por colaborador
        const colabIndex = etapa.colaboradores_detalhes.findIndex(c => c.nome === prod.colaborador_nome);
        const tempoProd = Number(prod.tempo_produtivo_minutos) || 0;
        const qtdProd = Number(prod.quantidade_produzida) || 0;

        if (colabIndex >= 0) {
          etapa.colaboradores_detalhes[colabIndex].tempo += tempoProd;
          etapa.colaboradores_detalhes[colabIndex].quantidade += qtdProd;
        } else {
          etapa.colaboradores_detalhes.push({
            nome: prod.colaborador_nome,
            tempo: tempoProd,
            quantidade: qtdProd
          });
        }
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
