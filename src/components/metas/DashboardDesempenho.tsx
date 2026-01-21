import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FullscreenWrapper } from "@/components/ui/fullscreen-wrapper";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { cn } from "@/lib/utils";

const DashboardDesempenho = () => {
  const empresaId = useEmpresaId();
  const [mesAno, setMesAno] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Buscar configurações da empresa
  const { data: config } = useQuery({
    queryKey: ["configuracoes-empresa", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_empresa")
        .select("velocidade_scroll_dashboard, estilo_lista_dashboard")
        .eq("empresa_id", empresaId)
        .single();

      if (error) {
        // Se não encontrar, retorna padrão
        return { velocidade_scroll_dashboard: 120, estilo_lista_dashboard: 'lista_rolante' };
      }
      return data;
    },
  });

  const { data: desempenho, isLoading } = useQuery({
    queryKey: ["desempenho-colaboradores", mesAno, empresaId],
    enabled: !!mesAno && !!empresaId,
    queryFn: async () => {
      const [ano, mes] = mesAno.split("-");

      const { data: colaboradores } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("nome");

      const { data: metas } = await supabase
        .from("metas")
        .select(`
          *,
          etapas(nome),
          subetapas(nome)
        `)
        .eq("empresa_id", empresaId);

      if (!colaboradores || !metas) return [];

      const dataInicio = `${ano}-${mes}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      const dataFim = `${ano}-${mes}-${ultimoDia}`;

      const desempenhoPromises = colaboradores.map(async (colaborador) => {
        const { data: producoes } = await supabase
          .from("producoes")
          .select(`
            *,
            etapas(nome),
            subetapas(nome)
          `)
          .eq("colaborador_id", colaborador.id)
          .gte("data_inicio", dataInicio)
          .lte("data_inicio", dataFim);

        if (!producoes || producoes.length === 0) {
          return {
            colaborador,
            atividades: [],
            totalPercentual: 0,
            metaBatida: false,
          };
        }

        const atividadesMap = new Map();

        producoes.forEach((prod: any) => {
          const chave = prod.subetapa_id || prod.etapa_id;
          const nome = prod.subetapas?.nome || prod.etapas?.nome;
          const tipo = prod.subetapa_id ? "subetapa" : "etapa";

          if (!atividadesMap.has(chave)) {
            const meta = metas.find((m: any) =>
              tipo === "subetapa"
                ? m.subetapa_id === chave
                : m.etapa_id === chave
            );

            atividadesMap.set(chave, {
              nome,
              produzido: 0,
              meta: meta?.meta || 0,
              percentual: 0,
            });
          }

          const ativ = atividadesMap.get(chave);
          ativ.produzido += prod.quantidade_produzida;
        });

        const atividades = Array.from(atividadesMap.values()).map((ativ: any) => ({
          ...ativ,
          percentual: ativ.meta > 0 ? (ativ.produzido / ativ.meta) * 100 : 0,
        }));

        const totalPercentual = atividades.reduce((sum, a) => sum + a.percentual, 0);
        const metaBatida = totalPercentual >= 100;

        return {
          colaborador,
          atividades,
          totalPercentual,
          metaBatida,
        };
      });

      return Promise.all(desempenhoPromises);
    },
  });

  // Efeito de scroll automático
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !config?.velocidade_scroll_dashboard) return;

    // Se estiver em modo grid, vamos fazer um scroll horizontal contínuo
    if (config.estilo_lista_dashboard === 'grid_cards') {
      let animationId: number;
      let startTime: number;
      const speed = config.velocidade_scroll_dashboard; // quanto maior, mais lento (segundos para percorrer)

      const scroll = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;

        // Multiplicador de velocidade (ajustável)
        const pixelsPerSecond = 5000 / speed;

        if (container) {
          container.scrollLeft += pixelsPerSecond / 60; // 60fps

          // Se chegou ao fim (considerando o clone dos itens), volta ao início sem o usuário perceber
          if (container.scrollLeft >= (container.scrollWidth / 2)) {
            container.scrollLeft = 0;
          }
        }

        animationId = requestAnimationFrame(scroll);
      };

      animationId = requestAnimationFrame(scroll);

      return () => cancelAnimationFrame(animationId);
    }
    // Se estiver em modo lista, scroll vertical (código existente ou similar)
    else {
      // Implementação anterior de scroll vertical ou nova se necessário
      // Por enquanto mantemos o comportamento padrão (sem auto-scroll na lista vertical 
      // ou implementar se solicitado, mas o foco é o grid agora)
    }

  }, [config, desempenho]);

  const renderCard = (item: any) => (
    <Card key={item.colaborador.id} className={cn(
      "p-4 border-2 shrink-0 bg-background",
      config?.estilo_lista_dashboard === 'grid_cards' ? "w-[300px] mx-2" : "w-full mb-3"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg truncate pr-2">
            {item.colaborador.nome}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-2xl font-bold text-primary">
            {item.totalPercentual.toFixed(1)}%
          </span>
          <Badge variant={item.metaBatida ? "default" : "secondary"}>
            {item.metaBatida ? "Meta Batida" : "Abaixo"}
          </Badge>
        </div>
      </div>

      <Progress
        value={Math.min(item.totalPercentual, 100)}
        className="h-3 mb-3"
      />

      {item.atividades.length > 0 ? (
        <p className="text-sm text-muted-foreground truncate">
          {item.atividades.map((a: any) => a.nome).join(", ")}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          Sem produção neste período
        </p>
      )}
    </Card>
  );

  return (
    <FullscreenWrapper title="Dashboard de Desempenho">
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Dashboard de Desempenho (Atualizado)</CardTitle>
            <div className="w-full md:w-64">
              <Input
                type="month"
                value={mesAno}
                onChange={(e) => setMesAno(e.target.value)}
                placeholder="Selecione mês/ano"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-6">
          {!mesAno ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-center text-muted-foreground text-lg">
                Selecione um mês/ano para visualizar o desempenho
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-center text-muted-foreground text-lg">Carregando...</p>
            </div>
          ) : desempenho && desempenho.length > 0 ? (
            <div
              ref={scrollRef}
              className={cn(
                config?.estilo_lista_dashboard === 'grid_cards'
                  ? "flex flex-row overflow-x-hidden py-4 items-center h-full"
                  : "flex flex-col space-y-3 overflow-y-auto h-full pr-2"
              )}
            >
              {/* Renderizar itens normais */}
              {desempenho.map((item) => renderCard(item))}

              {/* Se for grid, duplicar itens para efeito de loop infinito se houver itens suficientes */}
              {config?.estilo_lista_dashboard === 'grid_cards' && desempenho.length > 3 && (
                <>
                  {desempenho.map((item) => renderCard({
                    ...item,
                    colaborador: { ...item.colaborador, id: `clone-${item.colaborador.id}` }
                  }))}
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-center text-muted-foreground text-lg">
                Nenhum colaborador encontrado
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </FullscreenWrapper>
  );
};

export default DashboardDesempenho;
