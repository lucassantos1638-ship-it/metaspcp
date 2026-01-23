import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Play } from "lucide-react";
import { useIniciarProducao, useColaboradorTemAtividadeAberta } from "@/hooks/useProducaoStartStop";
import { useEmpresaId } from "@/hooks/useEmpresaId";

export default function FormularioIniciarAtividade() {
  const empresaId = useEmpresaId();
  const [colaboradorId, setColaboradorId] = useState("");
  const [loteId, setLoteId] = useState("");
  const [etapaId, setEtapaId] = useState("");
  const [subetapaId, setSubetapaId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [dataInicio, setDataInicio] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [horaInicio, setHoraInicio] = useState(new Date().toTimeString().slice(0, 5));
  const [segundosInicio, setSegundosInicio] = useState("0");

  const iniciarProducao = useIniciarProducao();
  const { data: atividadeAberta } = useColaboradorTemAtividadeAberta(colaboradorId);

  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: lotes } = useQuery({
    queryKey: ["lotes-ativos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("finalizado", false)
        .order("numero_lote");
      if (error) throw error;
      return data;
    },
    staleTime: 0, // Always fetch fresh to ensure we don't show finalized lots
  });

  // Buscar o produto do lote selecionado
  const { data: selectedLote } = useQuery({
    queryKey: ["lote", loteId],
    enabled: !!loteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select("produto_id, quantidade_total")
        .eq("id", loteId)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  // Buscar etapas vinculadas ao produto
  const { data: produtoEtapas } = useQuery({
    queryKey: ["produto_etapas", selectedLote?.produto_id],
    enabled: !!selectedLote?.produto_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_etapas")
        .select("etapa_id, subetapa_id, ordem")
        .eq("produto_id", selectedLote.produto_id)
        .order("ordem");
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  const { data: etapas } = useQuery({
    queryKey: ["etapas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etapas")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  // Filtrar etapas baseadas no produto selecionado
  const etapasFiltradas = etapas?.filter(etapa => {
    // Se não há produto selecionado ou não carregou regras, mostrar todas (ou nenhuma? User pediu filtro estrito)
    // Se o user diz "se não tiver cadastrada não é pra aparecer", entende-se que se a lista de produto_etapas existir (mesmo vazia?), deve respeitar.
    // Mas se o produto não tiver NENHUMA configuração, talvez mostre todas ou avise?
    // Vamos assumir: Se houver registros em produto_etapas, filtra. Se não houver, mostra tudo (comportamento padrão atual) OU mostra nada.
    // O user disse: "vai aparecer... se no cadastro do produto tiver cadastrado".
    // Vamos filtrar apenas se houver produto_etapas definido. Caso contrário, mantém comportamento original para não quebrar produtos legados.
    // ATUALIZAÇÃO REQUISITO: "se o produto não tiver etapas... não e pra aparecer".
    // Isso implica que se não tem configuração, não aparece nada.
    if (!produtoEtapas || produtoEtapas.length === 0) return false;

    return produtoEtapas.some(pe => pe.etapa_id === etapa.id);
  });

  const { data: subetapas } = useQuery({
    queryKey: ["subetapas", etapaId, empresaId],
    queryFn: async () => {
      if (!etapaId) return [];
      const { data, error } = await supabase
        .from("subetapas")
        .select("*")
        .eq("etapa_id", etapaId)
        .eq("empresa_id", empresaId)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!etapaId && !!empresaId,
  });

  // Filtrar subetapas também
  const subetapasFiltradas = subetapas?.filter(sub => {
    if (!produtoEtapas || produtoEtapas.length === 0) return false;
    // Se a etapa tem subetapas no produto_etapas, deve validar.
    // A query de produto_etapas retorna o par etapa_id + subetapa_id.
    // Se existir alguma entrada para esta etapa COM subetapa especifica, filtra.
    const etapaConfig = produtoEtapas.filter(pe => pe.etapa_id === etapaId);

    // Verifica se existe alguma subetapa configurada (ID não nulo)
    const temConfigSubetapa = etapaConfig.some(pe => pe.subetapa_id !== null);

    if (temConfigSubetapa) {
      // Se tiver config, mostra APENAS as cadastradas
      return etapaConfig.some(pe => pe.subetapa_id === sub.id);
    }

    // Se não tiver config de subetapa (mas a etapa está liberada), bloqueia subetapas.
    return false;
  });

  // Se um lote estiver selecionado, DEVE usar o filtro (mesmo que resulte em vazio).
  // Se não houver lote selecionado, mostra todas (opcional, mas como o fluxo exige lote, ok).
  // A correção principal é: se produtoEtapas for vazio ([]), listaEtapas deve ser vazia e não fallback para etapas.

  const listaEtapas = (loteId && selectedLote) ? etapasFiltradas : etapas;
  const listaSubetapas = (loteId && selectedLote) ? subetapasFiltradas : subetapas;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!colaboradorId || !loteId || !etapaId) {
      return;
    }

    iniciarProducao.mutate(
      {
        colaborador_id: colaboradorId,
        lote_id: loteId,
        etapa_id: etapaId,
        subetapa_id: subetapaId || null,
        quantidade_produzida: quantidade ? parseInt(quantidade) : null,
        data_inicio: dataInicio,
        hora_inicio: horaInicio,
        segundos_inicio: parseInt(segundosInicio),
        empresa_id: empresaId,
      },
      {
        onSuccess: () => {
          // Limpar formulário
          setColaboradorId("");
          setLoteId("");
          setEtapaId("");
          setSubetapaId("");
          setQuantidade("");
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          setDataInicio(`${year}-${month}-${day}`);
          setHoraInicio(new Date().toTimeString().slice(0, 5));
          setSegundosInicio("0");
        },
      }
    );
  };

  const temAtividadeAberta = !!atividadeAberta;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {temAtividadeAberta && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Este colaborador já possui uma atividade em aberto. Finalize antes de iniciar uma nova.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="colaborador">Colaborador *</Label>
          <Select value={colaboradorId} onValueChange={setColaboradorId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o colaborador" />
            </SelectTrigger>
            <SelectContent>
              {colaboradores?.map((colab) => (
                <SelectItem key={colab.id} value={colab.id}>
                  {colab.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lote">Lote *</Label>
          <Select value={loteId} onValueChange={setLoteId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o lote" />
            </SelectTrigger>
            <SelectContent>
              {lotes?.map((lote) => (
                <SelectItem key={lote.id} value={lote.id}>
                  {lote.numero_lote} - {lote.nome_lote}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="etapa">Etapa *</Label>
          <Select value={etapaId} onValueChange={(value) => {
            setEtapaId(value);
            setSubetapaId("");
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a etapa" />
            </SelectTrigger>
            <SelectContent>
              {listaEtapas?.map((etapa) => (
                <SelectItem key={etapa.id} value={etapa.id}>
                  {etapa.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loteId && produtoEtapas && produtoEtapas.length === 0 && (
            <p className="text-xs text-destructive">Este produto não possui etapas configuradas.</p>
          )}
        </div>

        {listaSubetapas && listaSubetapas.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="subetapa">Subetapa</Label>
            <Select value={subetapaId} onValueChange={setSubetapaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a subetapa (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {listaSubetapas.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="data-inicio">Data de Início *</Label>
          <Input
            type="date"
            id="data-inicio"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hora-inicio">Hora de Início *</Label>
          <div className="flex gap-2">
            <Input
              type="time"
              id="hora-inicio"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="flex-1"
              required
            />

          </div>
        </div>
      </div>

      {/* Aviso de Bloqueio por Quantidade não definida */}
      {selectedLote && selectedLote.quantidade_total <= 0 && etapaId && listaEtapas && listaEtapas.find(e => e.id === etapaId)?.ordem > 1 && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Não é possível iniciar etapas posteriores enquanto a quantidade do lote não for definida (final da Etapa 1).
          </AlertDescription>
        </Alert>
      )}

      {selectedLote && selectedLote.quantidade_total <= 0 && etapaId && listaEtapas && listaEtapas.find(e => e.id === etapaId)?.ordem === 1 && (
        <Alert className="mt-4 bg-yellow-50 text-yellow-800 border-yellow-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            A quantidade do lote será solicitada ao finalizar esta etapa.
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={
          iniciarProducao.isPending ||
          temAtividadeAberta ||
          (selectedLote && selectedLote.quantidade_total <= 0 && etapaId && listaEtapas && listaEtapas.find(e => e.id === etapaId)?.ordem > 1)
        }
      >
        <Play className="mr-2 h-4 w-4" />
        {iniciarProducao.isPending ? "Iniciando..." : "Iniciar Atividade"}
      </Button>
    </form>
  );
}
