import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatarTempoProdutivo, formatarData } from "@/lib/timeUtils";
import { formatarCusto } from "@/lib/custoUtils";
import { FullscreenWrapper } from "@/components/ui/fullscreen-wrapper";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Info, Loader2 } from "lucide-react";
import { useEmpresaId } from "@/hooks/useEmpresaId";

interface Atividade {
  nome: string;
  tipo: string;
  quantidade: number;
  tempo: number;
  custo: number;
  meta: number;
  percentual: number;
  lotes: string[];
}

interface DadosDiarios {
  dia: string;
  quantidade: number;
  tempo: number;
  custo: number;
  percentual: number;
}

interface Resumo {
  totalQuantidade: number;
  totalTempo: number;
  totalPercentual: number;
  totalCusto: number;
}

interface RelatorioData {
  atividades: Atividade[];
  dadosDiarios: DadosDiarios[] | null;
  melhorDia: DadosDiarios | null;
  piorDia: DadosDiarios | null;
  atividadesParaMelhorar: Atividade[];
  pontosFortesArray: Atividade[];
  resumo: Resumo;
}

// Helper types for the query result
interface ProducaoItem {
  subetapa_id: string | null;
  etapa_id: string | null;
  etapas?: { nome: string; custo_por_hora: number } | null;
  subetapas?: { nome: string; custo_por_hora: number } | null;
  tempo_produtivo_minutos: number;
  quantidade_produzida: number;
  data_inicio: string;
  hora_inicio: string;
  data_fim: string;
  hora_fim: string;
  lotes: { numero_lote: string; nome_lote: string } | null;
}

const RelatorioColaborador = () => {
  const empresaId = useEmpresaId();
  const [colaboradorId, setColaboradorId] = useState<string>("");
  const [mesAno, setMesAno] = useState<string>("");
  const [loteId, setLoteId] = useState<string>("todos");
  const [diaEspecifico, setDiaEspecifico] = useState<string>("");
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);

  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: lotes } = useQuery({
    queryKey: ["lotes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("numero_lote");
      if (error) throw error;
      return data;
    },
  });

  const { data: relatorio, isLoading } = useQuery({
    queryKey: ["relatorio-colaborador", colaboradorId, mesAno, loteId, diaEspecifico],
    enabled: mostrarRelatorio && !!colaboradorId && !!mesAno,
    queryFn: async () => {
      const [ano, mes] = mesAno.split("-");

      // Fetch detailed collaborator info to ensure we have the rate
      const { data: colabInfo } = await supabase
        .from("colaboradores")
        .select("custo_por_hora")
        .eq("id", colaboradorId)
        .single();

      const custoColabFixo = colabInfo?.custo_por_hora;

      let query = supabase.from("producoes").select(`*, etapas(nome, custo_por_hora), subetapas(nome, custo_por_hora), lotes(numero_lote, nome_lote)`).eq("colaborador_id", colaboradorId);

      if (diaEspecifico) {
        query = query.eq("data_inicio", diaEspecifico);
      } else {
        const dataInicio = `${ano}-${mes}-01`;
        const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
        const dataFim = `${ano}-${mes}-${ultimoDia}`;
        query = query.gte("data_inicio", dataInicio).lte("data_inicio", dataFim);
      }

      if (loteId !== "todos") query = query.eq("lote_id", loteId);

      const { data: producoes, error } = await query;
      if (error) throw error;

      const { data: metas } = await supabase.from("metas").select("*");

      const atividades = new Map<string, any>(); // Intermediate map, typed loosely during aggregation but converted later
      const producoesPorDia = new Map<string, { dia: string; quantidade: number; tempo: number; custo: number }>();

      (producoes as unknown as ProducaoItem[])?.forEach((prod) => {
        const chave = prod.subetapa_id || prod.etapa_id;
        const nome = prod.subetapas?.nome || prod.etapas?.nome;
        const tipo = prod.subetapa_id ? "subetapa" : "etapa";

        // Use manually fetched collaborator rate, fallback to stage/substage
        const custoPorHora = custoColabFixo
          ? Number(custoColabFixo)
          : (prod.subetapa_id ? (prod.subetapas?.custo_por_hora || 0) : (prod.etapas?.custo_por_hora || 0));

        let tempoMinutos = 0;
        if (prod.data_inicio && prod.hora_inicio && prod.data_fim && prod.hora_fim) {
          const inicio = new Date(`${prod.data_inicio}T${prod.hora_inicio}`);
          const fim = new Date(`${prod.data_fim}T${prod.hora_fim}`);
          const diffMs = fim.getTime() - inicio.getTime();
          tempoMinutos = Math.max(0, Math.floor(diffMs / 1000 / 60));
        }

        const tempoHoras = tempoMinutos / 60;
        const custo = tempoHoras * Number(custoPorHora);

        if (!atividades.has(chave)) {
          const meta = metas?.find((m) => tipo === "subetapa" ? m.subetapa_id === chave : m.etapa_id === chave);
          atividades.set(chave, { nome, tipo, quantidade: 0, tempo: 0, custo: 0, meta: meta?.meta || 0, percentual: 0, lotes: new Set() });
        }

        const ativ = atividades.get(chave);
        ativ.quantidade += prod.quantidade_produzida;
        ativ.tempo += tempoMinutos;
        ativ.custo += custo;
        ativ.lotes.add(`${prod.lotes.numero_lote} - ${prod.lotes.nome_lote}`);

        if (!diaEspecifico) {
          const dia = prod.data_inicio;
          if (!producoesPorDia.has(dia)) producoesPorDia.set(dia, { dia, quantidade: 0, tempo: 0, custo: 0 });
          const dadosDia = producoesPorDia.get(dia);
          dadosDia.quantidade += prod.quantidade_produzida;
          dadosDia.tempo += tempoMinutos;
          dadosDia.custo += custo;
        }
      });

      const atividadesArray = Array.from(atividades.values()).map((ativ) => ({ ...ativ, percentual: ativ.meta > 0 ? (ativ.quantidade / ativ.meta) * 100 : 0, lotes: Array.from(ativ.lotes) }));

      const totalQuantidade = atividadesArray.reduce((sum, ativ) => sum + ativ.quantidade, 0);
      const totalTempo = atividadesArray.reduce((sum, ativ) => sum + ativ.tempo, 0);
      const totalMeta = atividadesArray.reduce((sum, ativ) => sum + ativ.meta, 0);
      const totalPercentual = totalMeta > 0 ? (totalQuantidade / totalMeta) * 100 : 0;
      const totalCusto = atividadesArray.reduce((sum, ativ) => sum + ativ.custo, 0);

      let dadosDiariosArray = null, melhorDia = null, piorDia = null;

      if (!diaEspecifico && producoesPorDia.size > 0) {
        const metaDiaria = totalMeta / producoesPorDia.size;
        dadosDiariosArray = Array.from(producoesPorDia.values()).map((dia) => ({ ...dia, percentual: metaDiaria > 0 ? (dia.quantidade / metaDiaria) * 100 : 0 })).sort((a, b) => a.dia.localeCompare(b.dia));
        if (dadosDiariosArray.length > 0) {
          melhorDia = dadosDiariosArray.reduce((max, dia) => dia.percentual > max.percentual ? dia : max);
          piorDia = dadosDiariosArray.reduce((min, dia) => dia.percentual < min.percentual ? dia : min);
        }
      }

      const atividadesParaMelhorar = atividadesArray.filter(ativ => ativ.meta > 0 && ativ.percentual < 100).sort((a, b) => a.percentual - b.percentual).slice(0, 3);
      const pontosFortesArray = atividadesArray.filter(ativ => ativ.meta > 0 && ativ.percentual >= 100).sort((a, b) => b.percentual - a.percentual).slice(0, 3);

      return { atividades: atividadesArray, dadosDiarios: dadosDiariosArray, melhorDia, piorDia, atividadesParaMelhorar, pontosFortesArray, resumo: { totalQuantidade, totalTempo, totalPercentual, totalCusto } };
    },
  });

  const colaboradorSelecionado = colaboradores?.find((c) => c.id === colaboradorId);

  return (
    <FullscreenWrapper title="Relatório Individual por Colaborador">
      <Card>
        <CardHeader><CardTitle>Relatório Individual por Colaborador</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div><label className="text-sm font-medium mb-2 block">Colaborador</label><Select value={colaboradorId} onValueChange={setColaboradorId}><SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger><SelectContent>{colaboradores?.map((colab) => (<SelectItem key={colab.id} value={colab.id}>{colab.nome}</SelectItem>))}</SelectContent></Select></div>
            <div><label className="text-sm font-medium mb-2 block">Mês/Ano</label><Input type="month" value={mesAno} onChange={(e) => setMesAno(e.target.value)} placeholder="Selecione mês e ano" /></div>
            <div><label className="text-sm font-medium mb-2 block">Dia Específico (Opcional)</label><Input type="date" value={diaEspecifico} onChange={(e) => setDiaEspecifico(e.target.value)} placeholder="Filtrar por dia" disabled={!mesAno} /></div>
            <div><label className="text-sm font-medium mb-2 block">Lote</label><Select value={loteId} onValueChange={setLoteId}><SelectTrigger><SelectValue placeholder="Todos os lotes" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os lotes</SelectItem>{lotes?.map((lote) => (<SelectItem key={lote.id} value={lote.id}>{lote.numero_lote} - {lote.nome_lote}</SelectItem>))}</SelectContent></Select></div>
            <div className="flex items-end gap-2"><Button className="flex-1" onClick={() => setMostrarRelatorio(true)} disabled={!colaboradorId || !mesAno}>Gerar</Button><Button variant="outline" className="flex-1" onClick={() => { setColaboradorId(""); setMesAno(""); setLoteId("todos"); setDiaEspecifico(""); setMostrarRelatorio(false); }}>Limpar</Button></div>
          </div>

          {isLoading && (<div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>)}
          {diaEspecifico && !isLoading && mostrarRelatorio && (<Alert><Info className="h-4 w-4" /><AlertDescription>Visualizando dados do dia {formatarData(diaEspecifico)}. Remova o filtro de dia para ver o gráfico mensal.</AlertDescription></Alert>)}

          {mostrarRelatorio && relatorio && !isLoading && (
            <div className="space-y-6">
              <Card><CardHeader><CardTitle className="text-lg">Resumo - {colaboradorSelecionado?.nome}</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 sm:grid-cols-4 gap-4"><div><p className="text-sm text-muted-foreground">Total Produzido</p><p className="text-2xl font-bold">{relatorio.resumo.totalQuantidade}</p></div><div><p className="text-sm text-muted-foreground">Tempo Total</p><p className="text-2xl font-bold">{formatarTempoProdutivo(relatorio.resumo.totalTempo)}</p></div><div><p className="text-sm text-muted-foreground">Custo Total</p><p className="text-2xl font-bold text-blue-600">{formatarCusto(relatorio.resumo.totalCusto)}</p></div><div><p className="text-sm text-muted-foreground">Desempenho Geral</p><p className={`text-2xl font-bold ${relatorio.resumo.totalPercentual >= 100 ? "text-green-600" : relatorio.resumo.totalPercentual >= 70 ? "text-yellow-600" : "text-red-600"}`}>{relatorio.resumo.totalPercentual.toFixed(1)}%</p></div></div></CardContent></Card>

              {!diaEspecifico && relatorio.melhorDia && relatorio.piorDia && (<div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><Card className="bg-green-50 border-green-200"><CardHeader><CardTitle className="text-sm text-green-700">🏆 Melhor Dia do Mês</CardTitle></CardHeader><CardContent><p className="font-semibold text-lg">{formatarData(relatorio.melhorDia.dia)}</p><p className="text-green-600 font-bold text-2xl">{relatorio.melhorDia.percentual.toFixed(1)}%</p><p className="text-sm text-muted-foreground mt-2">{relatorio.melhorDia.quantidade} unidades • {formatarTempoProdutivo(relatorio.melhorDia.tempo)}</p></CardContent></Card><Card className="bg-red-50 border-red-200"><CardHeader><CardTitle className="text-sm text-red-700">📉 Pior Dia do Mês</CardTitle></CardHeader><CardContent><p className="font-semibold text-lg">{formatarData(relatorio.piorDia.dia)}</p><p className="text-red-600 font-bold text-2xl">{relatorio.piorDia.percentual.toFixed(1)}%</p><p className="text-sm text-muted-foreground mt-2">{relatorio.piorDia.quantidade} unidades • {formatarTempoProdutivo(relatorio.piorDia.tempo)}</p></CardContent></Card></div>)}

              {!diaEspecifico && relatorio.dadosDiarios && relatorio.dadosDiarios.length > 0 && (<Card><CardHeader><CardTitle>📊 Desempenho Diário no Mês</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><LineChart data={relatorio.dadosDiarios}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dia" tickFormatter={(value) => { const date = new Date(value + "T00:00:00"); return `${date.getDate()}/${date.getMonth() + 1}`; }} /><YAxis /><Tooltip labelFormatter={(value) => formatarData(value as string)} formatter={(value: number | string, name: string) => { if (name === 'custo') return [formatarCusto(Number(value)), 'Custo']; if (name === 'tempo') return [formatarTempoProdutivo(Number(value)), 'Tempo']; if (name === 'percentual') return [`${Number(value).toFixed(1)}%`, 'Desempenho']; return [value, name]; }} /><Legend /><Line type="monotone" dataKey="percentual" stroke="hsl(var(--primary))" name="Desempenho (%)" strokeWidth={2} /><Line type="monotone" dataKey="quantidade" stroke="hsl(var(--chart-2))" name="Quantidade" strokeWidth={2} /></LineChart></ResponsiveContainer></CardContent></Card>)}

              {relatorio.atividades.length > 0 && (<Card><CardHeader><CardTitle>ðŸŽ¯ AnÃ¡lise de Desempenho</CardTitle></CardHeader><CardContent className="space-y-6">{relatorio.atividadesParaMelhorar.length > 0 && (<div><h3 className="font-semibold text-lg mb-3 text-orange-600">Etapas que Precisam de AtenÃ§Ã£o</h3><div className="space-y-2">{relatorio.atividadesParaMelhorar.map((ativ, idx) => (<div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 border-orange-200"><div><p className="font-medium">{ativ.nome}</p><p className="text-sm text-muted-foreground">Produzido: {ativ.quantidade} / Meta: {ativ.meta}</p></div><div className="text-right"><p className="text-2xl font-bold text-orange-600">{ativ.percentual.toFixed(1)}%</p><p className="text-sm text-muted-foreground">Faltam {ativ.meta - ativ.quantidade} unidades</p></div></div>))}</div></div>)}{relatorio.pontosFortesArray.length > 0 && (<div><h3 className="font-semibold text-lg mb-3 text-green-600">â­ Pontos Fortes</h3><div className="space-y-2">{relatorio.pontosFortesArray.map((ativ, idx) => (<div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200"><div><p className="font-medium">{ativ.nome}</p><p className="text-sm text-muted-foreground">Produzido: {ativ.quantidade} / Meta: {ativ.meta}</p></div><div className="text-right"><p className="text-2xl font-bold text-green-600">{ativ.percentual.toFixed(1)}%</p></div></div>))}</div></div>)}<div className="p-4 bg-blue-50 rounded-lg border border-blue-200"><h4 className="font-semibold mb-2">ðŸ’¡ Resumo da AnÃ¡lise</h4><ul className="text-sm space-y-1"><li>â€¢ Total de atividades avaliadas: {relatorio.atividades.length}</li><li>â€¢ Atividades acima da meta: {relatorio.pontosFortesArray.length}</li><li>â€¢ Atividades que precisam melhorar: {relatorio.atividadesParaMelhorar.length}</li>{relatorio.resumo.totalTempo > 0 && (<li>â€¢ Custo mÃ©dio por hora: {formatarCusto(relatorio.resumo.totalCusto / (relatorio.resumo.totalTempo / 60))}</li>)}</ul></div></CardContent></Card>)}

              <Card><CardHeader><CardTitle>ðŸ“‹ Detalhamento por Atividade</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Atividade</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Tempo</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Meta</TableHead><TableHead className="text-right">%</TableHead><TableHead>Lotes</TableHead></TableRow></TableHeader><TableBody>{relatorio.atividades.map((ativ, index) => (<TableRow key={index}><TableCell className="font-medium">{ativ.nome}<span className="text-xs text-muted-foreground ml-2">({ativ.tipo})</span></TableCell><TableCell className="text-right">{ativ.quantidade}</TableCell><TableCell className="text-right">{formatarTempoProdutivo(ativ.tempo)}</TableCell><TableCell className="text-right text-blue-600 font-medium">{formatarCusto(ativ.custo)}</TableCell><TableCell className="text-right">{ativ.meta || "-"}</TableCell><TableCell className="text-right"><span className={`font-semibold ${ativ.percentual >= 100 ? "text-green-600" : ativ.percentual >= 70 ? "text-yellow-600" : "text-red-600"}`}>{ativ.meta > 0 ? `${ativ.percentual.toFixed(1)}%` : "-"}</span></TableCell><TableCell className="text-sm text-muted-foreground">{ativ.lotes.join(", ")}</TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
            </div>
          )}

          {mostrarRelatorio && relatorio && relatorio.atividades.length === 0 && !isLoading && (<p className="text-center text-muted-foreground py-8">Nenhuma produção encontrada para os filtros selecionados</p>)}
        </CardContent>
      </Card>
    </FullscreenWrapper>
  );
};

export default RelatorioColaborador;