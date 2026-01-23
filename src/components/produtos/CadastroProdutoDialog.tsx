import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Info } from "lucide-react";
import { useGerarSku } from "@/hooks/useProdutos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";

interface CadastroProdutoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CadastroProdutoDialog({
  open,
  onOpenChange,
}: CadastroProdutoDialogProps) {
  const empresaId = useEmpresaId();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [sku, setSku] = useState("");
  const [precoCpf, setPrecoCpf] = useState("");
  const [precoCnpj, setPrecoCnpj] = useState("");
  const [estoque, setEstoque] = useState("");
  const [loading, setLoading] = useState(false);

  const gerarSku = useGerarSku();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      resetForm();
      gerarSku.mutate(undefined, {
        onSuccess: (data) => setSku(data),
      });
    }
  }, [open, gerarSku.mutate]);

  const resetForm = () => {
    setNome("");
    setDescricao("");
    setSku("");
    setPrecoCpf("");
    setPrecoCnpj("");
    setEstoque("");
  };

  const handleCriar = async () => {
    if (!nome.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome do produto",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Criar produto
      const { error: produtoError } = await supabase
        .from("produtos")
        .insert({
          nome: nome.trim(),
          sku,
          descricao: descricao.trim() || null,
          preco_cpf: Number(precoCpf) || 0,
          preco_cnpj: Number(precoCnpj) || 0,
          estoque: Number(estoque) || 0,
          empresa_id: empresaId,
          ativo: true,
        })
        .select()
        .single();

      if (produtoError) throw produtoError;

      toast({
        title: "Produto criado com sucesso!",
        description: `O produto ${nome} foi cadastrado. Agora você pode adicionar as etapas e métricas na tela de detalhes.`,
      });

      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      onOpenChange(false);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro ao criar produto",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU (gerado automaticamente)</Label>
              <Input id="sku" value={sku} disabled className="font-mono bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Produto *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Lençol Casal Estampado"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhes sobre o produto..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="precoCpf">Preço Tabela CPF</Label>
                <Input
                  id="precoCpf"
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoCpf}
                  onChange={(e) => setPrecoCpf(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="precoCnpj">Preço Tabela CNPJ</Label>
                <Input
                  id="precoCnpj"
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoCnpj}
                  onChange={(e) => setPrecoCnpj(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estoque">Estoque Inicial</Label>
              <Input
                id="estoque"
                type="number"
                step="0.01"
                min="0"
                value={estoque}
                onChange={(e) => setEstoque(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Após cadastrar o nome, você poderá definir as etapas de produção e custos na tela de detalhes do produto.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleCriar} disabled={loading}>
              {loading ? (
                <>
                  <Check className="mr-2 h-4 w-4 animate-spin" /> Criando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" /> Criar Produto
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
