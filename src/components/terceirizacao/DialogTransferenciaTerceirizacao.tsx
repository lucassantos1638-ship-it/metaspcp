import React, { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMateriais, useMaterial } from "@/hooks/useMateriais";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";

interface DialogTransferenciaProps {
  activeCompanyId: string | null;
  trigger?: React.ReactNode;
  initialData?: {
    tipoMov?: "TRANSFERENCIA" | "REMESSA" | "RETORNO";
    loteOrigemId?: string;
    materialId?: string;
    saldoDoLote?: number;
    quantidadePreenchida?: string;
    documentoPreenchido?: string;
    origemIdPreenchida?: string;
    destinoIdPreenchida?: string;
  };
}

export function DialogTransferenciaTerceirizacao({ 
  activeCompanyId, 
  trigger,
  initialData 
}: DialogTransferenciaProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();
  const { data: materiais } = useMateriais(true);
  const { user } = useAuth();

  const [tipoMov, setTipoMov] = useState<"TRANSFERENCIA" | "REMESSA" | "RETORNO">(initialData?.tipoMov || "TRANSFERENCIA");
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [codigoLote, setCodigoLote] = useState("");
  const [materialId, setMaterialId] = useState(initialData?.materialId || "");
  const [corOrigem, setCorOrigem] = useState("");
  const [materialDestinoId, setMaterialDestinoId] = useState("mesmo");
  const [corDestino, setCorDestino] = useState("mesma");
  const [coresOrigem, setCoresOrigem] = useState<string[]>([]);
  const [coresDestino, setCoresDestino] = useState<string[]>([]);

  const { data: materialDetalhadoOrigem } = useMaterial(materialId || null);
  const { data: materialDetalhadoDestino } = useMaterial((materialDestinoId === "mesmo" ? materialId : materialDestinoId) || null);

  useEffect(() => {
    if (materialDetalhadoOrigem && materialDetalhadoOrigem.cores) {
      setCoresOrigem(materialDetalhadoOrigem.cores.map(c => c.codigo ? `${c.codigo} - ${c.nome}` : c.nome));
    } else {
      setCoresOrigem([]);
    }
  }, [materialDetalhadoOrigem]);

  useEffect(() => {
    if (materialDetalhadoDestino && materialDetalhadoDestino.cores) {
      setCoresDestino(materialDetalhadoDestino.cores.map(c => c.codigo ? `${c.codigo} - ${c.nome}` : c.nome));
    } else {
      setCoresDestino([]);
    }
  }, [materialDetalhadoDestino]);
  const [quantidade, setQuantidade] = useState("");
  const [perda, setPerda] = useState("");
  const [documento, setDocumento] = useState("");
  const [loteOrigemId, setLoteOrigemId] = useState(initialData?.loteOrigemId || "");
  const [loteDestinoId, setLoteDestinoId] = useState("novo");

  // Busca as entidades terceirizadas para o select
  const { data: entidades } = useQuery({
    queryKey: ["entidades-terceirizadas-dialog", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("entidade")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .eq("tipo", "terceirizado")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  // Busca lotes da empresa de origem para poder deduzir (opcional)
  const { data: lotesOrigem } = useQuery({
    queryKey: ["lotes-origem", origemId],
    queryFn: async () => {
      if (!origemId) return [];
      const { data, error } = await supabase
        .from("lotes_terceiros")
        .select("id, codigo_lote")
        .eq("entidade_fornecedor_id", origemId)
        .not("status", "eq", "CONCLUIDO")
        .not("status", "eq", "CANCELADO");
      if (error) throw error;
      return data;
    },
    enabled: !!origemId,
  });

    // Busca lotes da empresa de destino para poder adicionar
  const { data: lotesDestino } = useQuery({
    queryKey: ["lotes-destino", destinoId],
    queryFn: async () => {
      if (!destinoId || destinoId === "MINHA_EMPRESA") return [];
      const { data, error } = await supabase
        .from("lotes_terceiros")
        .select("id, codigo_lote")
        .eq("entidade_fornecedor_id", destinoId)
        .not("status", "eq", "CONCLUIDO")
        .not("status", "eq", "CANCELADO");
      if (error) throw error;
      return data;
    },
    enabled: !!destinoId && destinoId !== "MINHA_EMPRESA",
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        // We only set initial data on open, so we don't freeze the inputs if the user tries to change them
        if (initialData.materialId) setMaterialId(initialData.materialId);
        if (initialData.loteOrigemId) setLoteOrigemId(initialData.loteOrigemId);
      }

      if (tipoMov === "TRANSFERENCIA" && activeCompanyId) {
        setOrigemId(activeCompanyId);
      } else if (tipoMov === "RETORNO" && activeCompanyId) {
        setOrigemId(activeCompanyId);
        setDestinoId("MINHA_EMPRESA");
      } else if (tipoMov === "REMESSA" && activeCompanyId) {
        setOrigemId("MINHA_EMPRESA");
        setDestinoId(activeCompanyId);
      }
    }
  }, [open, tipoMov, activeCompanyId]);

  // Handle setting initialData's tipoMov ONLY when opening the dialog
  useEffect(() => {
    if (open && initialData) {
      if (initialData.tipoMov) setTipoMov(initialData.tipoMov);
      if (initialData.quantidadePreenchida) setQuantidade(initialData.quantidadePreenchida);
      if (initialData.documentoPreenchido) setDocumento(initialData.documentoPreenchido);
      if (initialData.origemIdPreenchida) setOrigemId(initialData.origemIdPreenchida);
      if (initialData.destinoIdPreenchida) setDestinoId(initialData.destinoIdPreenchida);
    }
  }, [open, initialData]);

  // Auto-calculate perda and percentage if saldoDoLote is available
  useEffect(() => {
    if (tipoMov === "RETORNO" && initialData?.saldoDoLote !== undefined && quantidade) {
      const qtdRetornada = parseFloat(quantidade);
      if (!isNaN(qtdRetornada)) {
        const diff = initialData.saldoDoLote - qtdRetornada;
        if (diff > 0) {
          setPerda(diff.toFixed(2));
        } else {
          setPerda("");
        }
      }
    }
  }, [quantidade, tipoMov, initialData?.saldoDoLote]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!empresaId) return;
    if (!materialId || !quantidade) {
      toast.error("Material de origem e quantidade são obrigatórios");
      return;
    }

    const idMatDestino = materialDestinoId === "mesmo" ? materialId : materialDestinoId;
    let entOrigem = origemId === "MINHA_EMPRESA" ? null : origemId;
    let entDestino = destinoId === "MINHA_EMPRESA" ? null : destinoId;

    if (entOrigem === entDestino && materialId === idMatDestino) {
      toast.error("Você selecionou a mesma Empresa e o mesmo Material para o Destino. O material não sairá do lugar!");
      return;
    }

    setIsLoading(true);

    try {
      const materialSelected = materiais?.find((m) => m.id === materialId);
      const unidade = materialSelected?.unidade_medida || "KG";

      let novoLoteDestinoId = null;

      // Se o material está indo para um parceiro e ele pediu para criar NOVO lote
      if (entDestino && loteDestinoId === "novo") {
        const codigoGerado = `TRF-${documento}-${Math.floor(Math.random() * 1000)}`;
        const { data: loteData, error: loteError } = await supabase.from("lotes_terceiros").insert({
          empresa_id: empresaId,
          codigo_lote: codigoGerado,
          material_original_id: materialId,
          produto_atual_id: idMatDestino,
          cor_original: corOrigem || "Única",
          cor_atual: corDestino === "mesma" ? (corOrigem || "Única") : (corDestino || "Única"),
          quantidade_inicial: parseFloat(quantidade),
          unidade: unidade,
          entidade_fornecedor_id: entDestino,
          data_inicio: new Date().toISOString().split("T")[0],
          observacao: `Gerado auto. via ${tipoMov} - NFe: ${documento}`,
          status: "ABERTO",
          usuario_criador_id: user?.id,
        }).select("id").single();

        if (loteError) {
          console.error("Erro ao criar lote destino:", loteError);
          throw new Error("Não foi possível criar o lote de destino automaticamente.");
        }
        novoLoteDestinoId = loteData.id;
      } else if (entDestino && loteDestinoId !== "nenhum") {
        // O usuário escolheu colocar a quantidade em um Lote de Destino JÁ EXISTENTE!
        // Como a movimentação no banco só aceita 1 lote_id (que será o lote de origem para dar baixa),
        // nós adicionamos a quantidade fisicamente no lote de destino.
        const { data: loteExistente } = await supabase.from("lotes_terceiros").select("quantidade_inicial").eq("id", loteDestinoId).single();
        if (loteExistente) {
          await supabase.from("lotes_terceiros").update({
            quantidade_inicial: Number(loteExistente.quantidade_inicial) + parseFloat(quantidade)
          }).eq("id", loteDestinoId);
        }
      }

      // Definir qual lote_id será atrelado à movimentação principal
      // Se for Retorno, atrelamos ao loteOrigemId. Se for Remessa, atrelamos ao loteDestino (novo ou existente).
      // Se for transferência, a prioridade pode ser a Origem para "dar baixa" na origem.
      let idLotePrincipal = null;
      if (tipoMov === "RETORNO") {
        idLotePrincipal = loteOrigemId !== "nenhum" ? loteOrigemId : null;
      } else if (tipoMov === "REMESSA") {
        idLotePrincipal = loteDestinoId === "novo" ? novoLoteDestinoId : (loteDestinoId !== "nenhum" ? loteDestinoId : null);
      } else {
        // Transferencia: tenta atrelar à origem para abater, mas se nao tiver, atrela ao destino
        idLotePrincipal = loteOrigemId !== "nenhum" ? loteOrigemId : (loteDestinoId === "novo" ? novoLoteDestinoId : (loteDestinoId !== "nenhum" ? loteDestinoId : null));
      }

      const recordsToInsert = [];

      // Record principal (Remessa, Retorno ou Transferencia)
      recordsToInsert.push({
        empresa_id: empresaId,
        tipo_movimentacao: tipoMov,
        entidade_origem_id: entOrigem,
        entidade_destino_id: entDestino,
        material_origem_id: materialId,
        material_destino_id: idMatDestino,
        cor_origem: corOrigem || "Única",
        cor_destino: corDestino === "mesma" ? (corOrigem || "Única") : (corDestino || "Única"),
        quantidade: parseFloat(quantidade),
        unidade: unidade,
        documento: documento,
        lote_id: idLotePrincipal,
        usuario_id: user?.id,
        observacao: `NFe: ${documento} - ${tipoMov}${perda && tipoMov === 'RETORNO' ? ` | Mais perda: ${perda}${unidade}` : ''}`,
      });

      // Se for Retorno e tiver perda informada
      if (tipoMov === "RETORNO" && perda && parseFloat(perda) > 0) {
        recordsToInsert.push({
          empresa_id: empresaId,
          tipo_movimentacao: "PERDA",
          entidade_origem_id: entOrigem,
          entidade_destino_id: null,
          material_origem_id: materialId,
          material_destino_id: idMatDestino,
          cor_origem: corOrigem || "Única",
          cor_destino: corOrigem || "Única",
          quantidade: parseFloat(perda),
          unidade: unidade,
          documento: documento,
          lote_id: loteOrigemId !== "nenhum" ? loteOrigemId : null,
          usuario_id: user?.id,
          observacao: `Registro de Quebra/Perda vinculado à NFe: ${documento}`,
        });
      }

      await supabase.from("movimentacoes_terceiros").insert(recordsToInsert);

      // Se for RETORNO e tivermos um lote de origem selecionado, finalizamos o lote
      if (tipoMov === "RETORNO" && loteOrigemId && loteOrigemId !== "nenhum") {
        await supabase.from("lotes_terceiros").update({
          status: "CONCLUIDO"
        }).eq("id", loteOrigemId);
      }

      toast.success("Movimentação registrada com sucesso!");
      setOpen(false);
      
      // Reset
      setQuantidade("");
      setPerda("");
      setDocumento("");
      setLoteOrigemId("");
      setLoteDestinoId("novo");
      setMaterialDestinoId("mesmo");

      queryClient.invalidateQueries({ queryKey: ["historico-terceiros"] });
      queryClient.invalidateQueries({ queryKey: ["lotes-terceiros"] });
      queryClient.invalidateQueries({ queryKey: ["saldo-empresa"] });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao registrar movimentação");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? trigger : (
          <Button variant="outline" size="sm" className="bg-slate-50 text-[11px] h-8">
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
            Transferir
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferência de Material</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 mt-2">
          
          <div className="space-y-2">
            <Label>Tipo de Movimentação</Label>
            <RadioGroup 
              value={tipoMov} 
              onValueChange={(val: any) => setTipoMov(val)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="REMESSA" id="remessa" />
                <Label htmlFor="remessa" className="font-normal text-sm">Remessa (Envio)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="RETORNO" id="retorno" />
                <Label htmlFor="retorno" className="font-normal text-sm">Retorno (Volta)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="TRANSFERENCIA" id="transf" />
                <Label htmlFor="transf" className="font-normal text-sm">Entre Parceiros</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={origemId} onValueChange={setOrigemId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MINHA_EMPRESA" className="font-semibold text-blue-600">Minha Empresa</SelectItem>
                  {entidades?.map((ent) => (
                    <SelectItem key={ent.id} value={ent.id}>
                      {ent.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Destino</Label>
              <Select value={destinoId} onValueChange={setDestinoId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MINHA_EMPRESA" className="font-semibold text-blue-600">Minha Empresa</SelectItem>
                  {entidades?.map((ent) => (
                    <SelectItem key={ent.id} value={ent.id}>
                      {ent.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nota Fiscal</Label>
            <Input
              placeholder="Ex: 12345"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Material Origem</Label>
              <Select value={materialId} onValueChange={setMaterialId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o material" />
                </SelectTrigger>
                <SelectContent>
                  {materiais?.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {coresOrigem.length > 0 && (
              <div className="space-y-2">
                <Label>Cor de Origem</Label>
                <Select value={corOrigem} onValueChange={setCorOrigem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a cor" />
                  </SelectTrigger>
                  <SelectContent>
                    {coresOrigem.map((c, idx) => (
                      <SelectItem key={idx} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Transformar em (Opcional)</Label>
              <Select value={materialDestinoId} onValueChange={setMaterialDestinoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Mesmo material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mesmo" className="font-semibold text-blue-600">Manter o mesmo material</SelectItem>
                  {materiais?.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {coresDestino.length > 0 && (
              <div className="space-y-2">
                <Label>Cor Resultante</Label>
                <Select value={corDestino} onValueChange={setCorDestino}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mesma cor de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mesma" className="font-semibold text-blue-600">Mesma cor de origem</SelectItem>
                    {coresDestino.map((c, idx) => (
                      <SelectItem key={idx} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 100"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                required
              />
            </div>
            {tipoMov === "RETORNO" && (
              <div className="space-y-2">
                <Label className="flex justify-between items-center">
                  <span>Perda / Quebra (Opcional)</span>
                  {initialData?.saldoDoLote !== undefined && perda && parseFloat(perda) > 0 && (
                    <span className="text-red-500 font-bold text-[10px] bg-red-50 px-1.5 py-0.5 rounded">
                      {((parseFloat(perda) / initialData.saldoDoLote) * 100).toFixed(1)}% de perda
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 5"
                  value={perda}
                  onChange={(e) => setPerda(e.target.value)}
                />
                {initialData?.saldoDoLote !== undefined && (
                  <p className="text-[10px] text-slate-500">Saldo disponível no lote: <span className="font-semibold text-slate-700">{initialData.saldoDoLote} {materiais?.find(m => m.id === materialId)?.unidade_medida || "KG"}</span></p>
                )}
              </div>
            )}

            {tipoMov !== "RETORNO" && (
              <div className="space-y-2">
                <Label>Lote Destino</Label>
                <Select value={loteDestinoId} onValueChange={setLoteDestinoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Criar Novo Lote" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo" className="font-semibold text-emerald-600">+ Criar Novo Lote</SelectItem>
                    <SelectItem value="nenhum" className="text-slate-500">Apenas saldo (sem lote)</SelectItem>
                    {lotesDestino?.map((lote) => (
                      <SelectItem key={lote.id} value={lote.id}>
                        Lote: {lote.codigo_lote}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {(tipoMov === "RETORNO" || tipoMov === "TRANSFERENCIA") && (
            <div className="space-y-2">
              <Label>Lote Origem (Dar baixa)</Label>
              <Select value={loteOrigemId} onValueChange={setLoteOrigemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (Apenas baixar do saldo)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum (Apenas baixar do saldo)</SelectItem>
                  {lotesOrigem?.map((lote) => (
                    <SelectItem key={lote.id} value={lote.id}>
                      Lote: {lote.codigo_lote}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipoMov === "RETORNO" && perda && quantidade && (
            <div className="bg-orange-50 text-orange-800 p-3 rounded-md text-sm border border-orange-200">
              <span className="font-semibold">Cálculo de Quebra: </span> 
              A perda de {perda} representa <strong>{((parseFloat(perda) / (parseFloat(quantidade) + parseFloat(perda))) * 100).toFixed(2)}%</strong> do total original ({parseFloat(quantidade) + parseFloat(perda)}).
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              className="mr-2"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-blue-600 text-white hover:bg-blue-700">
              {isLoading ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
