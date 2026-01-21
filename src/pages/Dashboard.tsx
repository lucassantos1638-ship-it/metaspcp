import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FullscreenWrapper } from "@/components/ui/fullscreen-wrapper";
import { useEmpresaId } from "@/hooks/useEmpresaId";

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

const getStatusEmoji = (percentual: number) => {
  if (percentual >= 100) return "✅";
  if (percentual >= 90) return "🔥";
  return "📈";
};

const getStatusText = (percentual: number) => {
  if (percentual >= 100) return "Meta Batida";
  if (percentual >= 90) return "Acima de 90%";
  return "Em Progresso";
};

const getEmojiPorFaixa = (percentual: number) => {
  if (percentual >= 70) return "🟢";
  if (percentual >= 40) return "🟡";
  return "🔴";
};

const Dashboard = () => {
  const empresaId = useEmpresaId();
  const dataAtual = new Date();
  const mesAtualFormatado = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, "0")}`;
  const [mesAno, setMesAno] = useState(mesAtualFormatado);

  // Buscar configuração da velocidade do scroll e estilo
  const { data: config } = useQuery({
    queryKey: ["configuracoes-empresa", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_empresa")
        .select("velocidade_scroll_dashboard, estilo_lista_dashboard")
        .eq("empresa_id", empresaId)
        .single();
      return data;
    },
  });

  const velocidadeScroll = Math.max(config?.velocidade_scroll_dashboard ?? 120, 60);
  const estiloLista = config?.estilo_lista_dashboard || 'lista_rolante';

  const { data: ranking, isLoading } = useQuery({
    queryKey: ["ranking-metas", mesAno, empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const [ano, mes] = mesAno.split("-");
      const dataInicio = `${ano}-${mes}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      const dataFim = `${ano}-${mes}-${ultimoDia}`;

      const { data: colaboradores, error: errorColab } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");

      if (errorColab) throw errorColab;

      const { data: metas, error: errorMetas } = await supabase
        .from("metas")
        .select(`
          *,
          etapas(nome),
          subetapas(nome)
        `)
        .eq("empresa_id", empresaId);

      if (errorMetas) throw errorMetas;

      const resultado: RankingItem[] = [];

      for (const colaborador of colaboradores || []) {
        const { data: producoes, error: errorProd } = await supabase
          .from("producoes")
          .select(`
            *,
            etapas(nome),
            subetapas(nome)
          `)
          .eq("colaborador_id", colaborador.id)
          .gte("data_inicio", dataInicio)
          .lte("data_inicio", dataFim);

        if (errorProd) throw errorProd;

        const atividadesMap = new Map<string, { meta: number; produzido: number }>();

        for (const producao of producoes || []) {
          const chaveAtividade = producao.subetapa_id
            ? `${producao.etapa_id}-${producao.subetapa_id}`
            : producao.etapa_id;

          const metaCorrespondente = metas?.find((m) =>
            producao.subetapa_id
              ? m.subetapa_id === producao.subetapa_id
              : m.etapa_id === producao.etapa_id && !m.subetapa_id
          );

          if (metaCorrespondente) {
            const nomeAtividade = producao.subetapa_id
              ? (producao.subetapas as any)?.nome || "Subetapa"
              : (producao.etapas as any)?.nome || "Etapa";

            if (!atividadesMap.has(chaveAtividade)) {
              atividadesMap.set(chaveAtividade, {
                meta: metaCorrespondente.meta,
                produzido: 0,
              });
            }

            const atual = atividadesMap.get(chaveAtividade)!;
            atual.produzido += producao.quantidade_produzida;
          }
        }

        const atividades: AtividadeDesempenho[] = Array.from(atividadesMap.entries()).map(
          ([chave, dados]) => {
            const producaoExemplo = producoes?.find((p) =>
              p.subetapa_id
                ? `${p.etapa_id}-${p.subetapa_id}` === chave
                : p.etapa_id === chave
            );

            const nome = producaoExemplo?.subetapa_id
              ? (producaoExemplo.subetapas as any)?.nome || "Subetapa"
              : (producaoExemplo.etapas as any)?.nome || "Etapa";

            return {
              nome,
              meta: dados.meta,
              produzido: dados.produzido,
              percentual: (dados.produzido / dados.meta) * 100,
            };
          }
        );

        const totalPercentual = atividades.reduce((sum, a) => sum + a.percentual, 0);

        resultado.push({
          posicao: 0,
          colaborador,
          totalPercentual,
          atividades,
        });
      }

      resultado.sort((a, b) => b.totalPercentual - a.totalPercentual);
      resultado.forEach((item, idx) => {
        item.posicao = idx + 1;
      });

      return resultado;
    },
    refetchInterval: 30000,
  });

  const top3 = ranking?.slice(0, 3) || [];
  const restante = ranking?.slice(3) || [];

  const renderListaRolante = () => (
    <div className="h-[300px] sm:h-[400px] overflow-hidden relative rounded-lg border">
      <div
        className="animate-scroll-up"
        style={{
          animationDuration: `${velocidadeScroll}s`
        }}
      >
        {restante.map((item, idx) => (
          <div
            key={`${item.colaborador.id}-${idx}`}
            className="flex items-center justify-between p-4 bg-card border-b border-border hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-2 sm:gap-4 flex-1">
              <span className="text-lg sm:text-2xl font-bold text-muted-foreground w-8 sm:w-12">
                {item.posicao}º
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base sm:text-lg truncate">{item.colaborador.nome}</p>

                <Progress value={Math.min(item.totalPercentual, 100)} className="h-2 mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-lg sm:text-2xl font-bold text-primary">
                {item.totalPercentual.toFixed(1)}%
              </span>
              <span className="text-2xl sm:text-3xl">{getEmojiPorFaixa(item.totalPercentual)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderGridCards = () => (
    <div className="relative h-[320px] sm:h-[380px]">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none rounded-l-lg" />

      <div className="overflow-hidden relative rounded-lg border h-full">
        <div
          className="animate-scroll-horizontal flex gap-4 sm:gap-6 h-full items-center min-w-max"
          style={{
            animationDuration: `${velocidadeScroll}s`,
            willChange: 'transform',
            paddingLeft: '1rem',
            paddingRight: '1rem'
          }}
        >
          {restante.map((item, idx) => (
            <Card
              key={`${item.colaborador.id}-${idx}`}
              className="flex-shrink-0 w-[280px] sm:w-[320px] h-[280px] sm:h-[340px] hover:shadow-lg transition-shadow"
            >
              <CardHeader className="text-center pb-3">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-3xl font-bold text-muted-foreground">
                    {item.posicao}º
                  </span>
                  <span className="text-3xl">
                    {getEmojiPorFaixa(item.totalPercentual)}
                  </span>
                </div>
                <CardTitle className="text-lg">{item.colaborador.nome}</CardTitle>

              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <span className="text-3xl font-bold text-primary">
                    {item.totalPercentual.toFixed(1)}%
                  </span>
                </div>
                <Badge
                  className="w-full justify-center text-sm py-1.5"
                  variant={item.totalPercentual >= 100 ? "default" : "secondary"}
                >
                  {getStatusEmoji(item.totalPercentual)} {getStatusText(item.totalPercentual)}
                </Badge>
                <Progress
                  value={Math.min(item.totalPercentual, 100)}
                  className="h-2.5"
                />
                {item.atividades.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center line-clamp-2">
                    {item.atividades.map(a => a.nome).join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none rounded-r-lg" />
    </div>
  );

  return (
    <FullscreenWrapper title="Ranking Geral de Metas">
      <div className="space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">Ranking Geral de Metas</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Desempenho mensal dos colaboradores</p>
          </div>
          <div className="w-full sm:w-auto">
            <Input
              type="month"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
              className="w-full sm:w-[200px]"
            />
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">Carregando ranking...</p>
        ) : !ranking || ranking.length === 0 ? (
          <Card className="p-12">
            <p className="text-center text-muted-foreground">
              Nenhuma produção registrada neste período
            </p>
          </Card>
        ) : (
          <>
            {/* Pódio dos Top 3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {/* 2º Lugar */}
              {top3[1] && (
                <Card className="border-2 border-gray-400 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                  <CardHeader className="text-center pb-2">
                    <div className="text-4xl sm:text-5xl md:text-6xl mb-2">🥈</div>
                    <CardTitle className="text-lg sm:text-xl md:text-2xl">{top3[1].colaborador.nome}</CardTitle>

                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-center">
                      <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">
                        {top3[1].totalPercentual.toFixed(1)}%
                      </span>
                    </div>
                    <Badge className="w-full justify-center text-sm sm:text-base py-2">
                      {getStatusEmoji(top3[1].totalPercentual)} {getStatusText(top3[1].totalPercentual)}
                    </Badge>
                    <Progress value={Math.min(top3[1].totalPercentual, 100)} className="h-3" />
                    {top3[1].atividades.length > 0 && (
                      <p className="text-xs text-muted-foreground text-center">
                        {top3[1].atividades.map(a => a.nome).join(", ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 1º Lugar */}
              {top3[0] && (
                <Card className="border-4 border-yellow-500 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 shadow-2xl md:transform md:scale-110">
                  <CardHeader className="text-center pb-2">
                    <div className="text-4xl sm:text-6xl md:text-7xl mb-2">🥇</div>
                    <CardTitle className="text-xl sm:text-2xl md:text-3xl">{top3[0].colaborador.nome}</CardTitle>

                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-center">
                      <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary">
                        {top3[0].totalPercentual.toFixed(1)}%
                      </span>
                    </div>
                    <Badge className="w-full justify-center text-base sm:text-lg py-2">
                      {getStatusEmoji(top3[0].totalPercentual)} {getStatusText(top3[0].totalPercentual)}
                    </Badge>
                    <Progress value={Math.min(top3[0].totalPercentual, 100)} className="h-4" />
                    {top3[0].atividades.length > 0 && (
                      <p className="text-xs text-muted-foreground text-center">
                        {top3[0].atividades.map(a => a.nome).join(", ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 3º Lugar */}
              {top3[2] && (
                <Card className="border-2 border-orange-600 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
                  <CardHeader className="text-center pb-2">
                    <div className="text-4xl sm:text-5xl md:text-6xl mb-2">🥉</div>
                    <CardTitle className="text-lg sm:text-xl md:text-2xl">{top3[2].colaborador.nome}</CardTitle>

                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-center">
                      <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">
                        {top3[2].totalPercentual.toFixed(1)}%
                      </span>
                    </div>
                    <Badge className="w-full justify-center text-sm sm:text-base py-2">
                      {getStatusEmoji(top3[2].totalPercentual)} {getStatusText(top3[2].totalPercentual)}
                    </Badge>
                    <Progress value={Math.min(top3[2].totalPercentual, 100)} className="h-3" />
                    {top3[2].atividades.length > 0 && (
                      <p className="text-xs text-muted-foreground text-center">
                        {top3[2].atividades.map(a => a.nome).join(", ")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Lista Animada dos Demais Colaboradores */}
            {restante.length > 0 && (
              <Card className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl sm:text-2xl font-bold">Demais Colaboradores</h2>
                  <Badge variant="outline" className="text-sm">
                    {estiloLista === 'lista_rolante' ? '📜 Vertical ⬇️' : '🎴 Horizontal ➡️'}
                  </Badge>
                </div>

                {estiloLista === 'lista_rolante' ? renderListaRolante() : renderGridCards()}
              </Card>
            )}
          </>
        )}
      </div>
    </FullscreenWrapper>
  );
};

export default Dashboard;
