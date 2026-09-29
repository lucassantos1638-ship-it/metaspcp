import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileUp, Loader2, Check } from "lucide-react";
import { extractTextFromPDF } from "@/lib/pdfUtils";
import { analisarTextoPedidoComIA, PedidoExtraidoIA } from "@/lib/iaPedidoUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export const DialogImportarPdfIa = () => {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pedidoIa, setPedidoIa] = useState<PedidoExtraidoIA | null>(null);
  
  // Mapeamentos
  const [clienteId, setClienteId] = useState<string>("");
  const [itensMapeados, setItensMapeados] = useState<{ original: any; produtoId: string }[]>([]);
  
  const empresaId = useEmpresaId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Buscar clientes
  const { data: clientes } = useQuery({
    queryKey: ["clientes", empresaId],
    enabled: !!empresaId && !!pedidoIa,
    queryFn: async () => {
      const { data } = await supabase.from("entidade").select("*").eq("empresa_id", empresaId);
      return data || [];
    }
  });

  // Buscar produtos
  const { data: produtos } = useQuery({
    queryKey: ["produtos", empresaId],
    enabled: !!empresaId && !!pedidoIa,
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("*").eq("empresa_id", empresaId);
      return data || [];
    }
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF.");
      return;
    }

    setIsProcessing(true);
    setPedidoIa(null);

    try {
      // 1. Extrai texto
      const texto = await extractTextFromPDF(file);
      // 2. Manda pra IA
      const dados = await analisarTextoPedidoComIA(texto);
      
      setPedidoIa(dados);
      
      // Inicializar mapeamentos de itens com vazio
      setItensMapeados(dados.itens.map(i => ({ original: i, produtoId: "" })));
      
    } catch (error: any) {
      console.error(error);
      toast.error(`Erro: ${error.message || "Falha ao processar PDF"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Tenta auto-selecionar cliente e produtos quando os dados carregam
  React.useEffect(() => {
    if (pedidoIa && clientes && produtos) {
      // Auto-match cliente (Regra estrita: mesmo nome E mesmo documento)
      if (!clienteId) {
        const clienteEncontrado = clientes.find(c => {
          const nomeIgual = c.nome.toLowerCase().trim() === pedidoIa.clienteNome.toLowerCase().trim();
          const docDB = c.cpf_cnpj?.replace(/\D/g, '') || "";
          const docPDF = pedidoIa.clienteCnpj?.replace(/\D/g, '') || "";
          
          if (docPDF) {
            return nomeIgual && docDB === docPDF;
          }
          return nomeIgual;
        });
        
        if (clienteEncontrado) setClienteId(clienteEncontrado.id);
      }

      // Auto-match produtos
      setItensMapeados(prev => {
        let changed = false;
        const novos = prev.map(item => {
          if (!item.produtoId) {
            const desc = item.original.descricao.toLowerCase().trim();
            const prod = produtos.find(p => p.nome.toLowerCase().trim() === desc);
            if (prod) {
              changed = true;
              return { ...item, produtoId: prod.id };
            }
          }
          return item;
        });
        return changed ? novos : prev;
      });
    }
  }, [pedidoIa, clientes, produtos]);

  const handleItemProdutoChange = (index: number, val: string) => {
    const novos = [...itensMapeados];
    novos[index].produtoId = val;
    setItensMapeados(novos);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleProsseguir = async () => {
    let finalClienteId = clienteId;

    if (!finalClienteId && pedidoIa?.clienteNome) {
      setIsSaving(true);
      try {
        const { data: novoCliente, error } = await supabase.from("entidade").insert({
          empresa_id: empresaId,
          tipo: "cliente",
          nome: pedidoIa.clienteNome.toUpperCase(),
          cpf_cnpj: pedidoIa.clienteCnpj || null
        }).select("id").single();
        
        if (error) throw error;
        finalClienteId = novoCliente.id;
        queryClient.invalidateQueries({ queryKey: ["clientes"] });
      } catch (err: any) {
        toast.error("Erro ao cadastrar novo cliente: " + err.message);
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    } else if (!finalClienteId) {
      toast.error("O PDF não tem nome de cliente e nenhum foi selecionado.");
      return;
    }

    // Passar os dados para a tela de Novo Pedido
    navigate("/pedidos/novo", {
      state: {
        pedidoImportado: {
          clienteId: finalClienteId,
          observacoes: pedidoIa?.observacoes || "",
          numeroPedido: pedidoIa?.numeroPedido || "",
          itens: itensMapeados.filter(i => i.produtoId).map(i => ({
            produto_id: i.produtoId,
            quantidade: i.original.quantidade,
            preco_unitario: i.original.precoUnitario,
          }))
        }
      }
    });
    
    setOpen(false);
    setPedidoIa(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200">
          <FileUp className="w-4 h-4" />
          Importar PDF (IA)
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Pedido com Inteligência Artificial</DialogTitle>
        </DialogHeader>

        {!pedidoIa && !isProcessing && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg border-muted-foreground/25 bg-muted/10">
            <FileUp className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">Selecione o arquivo PDF do pedido</p>
            <Input type="file" accept="application/pdf" className="max-w-xs" onChange={handleFileUpload} />
          </div>
        )}

        {isProcessing && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-sm font-medium">Lendo PDF e processando com IA...</p>
          </div>
        )}

        {pedidoIa && (
          <div className="space-y-6">
            <div className="p-4 bg-muted/30 rounded-md border space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" /> Leitura Concluída
              </h3>
              
              <div className="space-y-2">
                <Label>Cliente Identificado: <span className="font-normal text-muted-foreground">{pedidoIa.clienteNome}</span></Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente correspondente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome} {c.cpf_cnpj ? `(${c.cpf_cnpj})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {pedidoIa.observacoes && (
                <div className="text-xs text-muted-foreground bg-white p-2 rounded border">
                  <strong>Obs do PDF:</strong> {pedidoIa.observacoes}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Mapeamento de Produtos</h4>
              <p className="text-xs text-muted-foreground">Associe os itens lidos do PDF com os produtos cadastrados no sistema.</p>
              
              <div className="space-y-4 border rounded-md p-4 bg-muted/10">
                {itensMapeados.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium truncate">{item.original.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        Qtd: {item.original.quantidade} | R$ {item.original.precoUnitario}
                        {item.original.cor ? ` | Cor: ${item.original.cor}` : ''}
                      </p>
                    </div>
                    <div>
                      <Select value={item.produtoId} onValueChange={(val) => handleItemProdutoChange(idx, val)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Buscar produto no sistema..." />
                        </SelectTrigger>
                        <SelectContent>
                          {produtos?.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => { setPedidoIa(null); setClienteId(""); }} disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleProsseguir} disabled={isSaving}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Prosseguir e Revisar Valores"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
