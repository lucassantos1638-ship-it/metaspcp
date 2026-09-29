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
import { useMateriais, useMaterial } from "@/hooks/useMateriais";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface DialogNovoLoteTerceirizacaoProps {
  entidadeFornecedorId: string | null;
}

export function DialogNovoLoteTerceirizacao({
  entidadeFornecedorId,
}: DialogNovoLoteTerceirizacaoProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();
  const { data: materiais } = useMateriais(true);
  const { user } = useAuth();

  const [codigoLote, setCodigoLote] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [cor, setCor] = useState("");
  const [coresDisponiveis, setCoresDisponiveis] = useState<string[]>([]);
  const [quantidade, setQuantidade] = useState("");
  const [quantidadesPorCor, setQuantidadesPorCor] = useState<Record<string, string>>({});
  const [selectedEntidadeId, setSelectedEntidadeId] = useState(entidadeFornecedorId || "");
  const [filtroCor, setFiltroCor] = useState("");

  const { data: materialDetalhado } = useMaterial(materialId || null);

  // Update colors when material changes
  useEffect(() => {
    if (materialDetalhado && materialDetalhado.cores) {
      setCoresDisponiveis(materialDetalhado.cores.map(c => c.codigo ? `${c.codigo} - ${c.nome}` : c.nome));
    } else {
      setCoresDisponiveis([]);
    }
    setCor("");
    setQuantidadesPorCor({});
    setFiltroCor("");
  }, [materialDetalhado]);

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

  // Atualiza o valor padrão quando a prop muda ou quando o modal abre
  useEffect(() => {
    if (entidadeFornecedorId && open) {
      setSelectedEntidadeId(entidadeFornecedorId);
    }
  }, [entidadeFornecedorId, open]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!empresaId) {
      toast.error("Erro de empresa não identificada");
      return;
    }

    if (!selectedEntidadeId) {
      toast.error("Selecione um parceiro/terceirizado primeiro.");
      return;
    }

    if (!codigoLote || !materialId) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const hasColors = coresDisponiveis.length > 0;
    const colorsToInsert = hasColors 
      ? Object.entries(quantidadesPorCor).filter(([_, qtd]) => parseFloat(qtd) > 0)
      : [];

    if (hasColors && colorsToInsert.length === 0) {
      toast.error("Informe a quantidade para pelo menos uma cor.");
      return;
    }

    if (!hasColors && !quantidade) {
      toast.error("Informe a quantidade.");
      return;
    }

    setIsLoading(true);

    try {
      const materialSelected = materiais?.find((m) => m.id === materialId);
      const unidade = materialSelected?.unidade_medida || "KG";

      // Helper for inserting
      const insertLote = async (colorName: string, qtyStr: string) => {
        const qty = parseFloat(qtyStr);
        const { data: loteData, error } = await supabase.from("lotes_terceiros").insert([
          {
            empresa_id: empresaId,
            codigo_lote: codigoLote,
            material_original_id: materialId,
            produto_atual_id: materialId,
            cor_original: colorName || "Única",
            cor_atual: colorName || "Única",
            quantidade_inicial: qty,
            unidade: unidade,
            entidade_fornecedor_id: selectedEntidadeId,
            status: "ABERTO",
            data_inicio: new Date().toISOString().split("T")[0],
          },
        ]).select().single();

        if (error) throw error;

        if (loteData) {
          await supabase.from("movimentacoes_terceiros").insert([
            {
              empresa_id: empresaId,
              lote_id: loteData.id,
              tipo_movimentacao: "ENTRADA",
              entidade_destino_id: selectedEntidadeId,
              material_origem_id: materialId,
              material_destino_id: materialId,
              cor_origem: colorName || "Única",
              cor_destino: colorName || "Única",
              quantidade: qty,
              unidade: unidade,
              observacao: `Abertura do lote ${codigoLote}`,
              usuario_id: user?.id,
            }
          ]);
        }
      };

      if (hasColors) {
        for (const [colorName, qtyStr] of colorsToInsert) {
          await insertLote(colorName, qtyStr);
        }
      } else {
        await insertLote(cor, quantidade);
      }

      toast.success("Lote criado com sucesso!");
      setOpen(false);
      
      // Reset form
      setCodigoLote("");
      setMaterialId("");
      setCor("");
      setQuantidade("");
      setQuantidadesPorCor({});
      setFiltroCor("");

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["lotes-terceiros"] });
      queryClient.invalidateQueries({ queryKey: ["historico-terceiros"] });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao criar lote");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Novo Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lote de Terceirização</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="empresa">Empresa / Parceiro</Label>
            <Select value={selectedEntidadeId} onValueChange={setSelectedEntidadeId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {entidades?.map((ent) => (
                  <SelectItem key={ent.id} value={ent.id}>
                    {ent.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="codigoLote">Código do Lote</Label>
            <Input
              id="codigoLote"
              placeholder="Ex: LOTE-123"
              value={codigoLote}
              onChange={(e) => setCodigoLote(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="material">Material</Label>
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

          {coresDisponiveis.length > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-slate-700">Quantidades por Cor</Label>
                <Input
                  placeholder="Filtrar cores..."
                  className="w-40 h-7 text-xs"
                  value={filtroCor}
                  onChange={(e) => setFiltroCor(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 max-h-[180px] overflow-y-auto gap-2 pr-2">
                {coresDisponiveis
                  .filter(c => c.toLowerCase().includes(filtroCor.toLowerCase()))
                  .map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="text-sm text-slate-600 font-medium truncate flex-1" title={c}>{c}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="w-28 text-right h-8"
                      value={quantidadesPorCor[c] || ""}
                      onChange={(e) => setQuantidadesPorCor(prev => ({ ...prev, [c]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input
                id="quantidade"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 100.5"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                required
              />
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
              {isLoading ? "Salvando..." : "Salvar Lote"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
