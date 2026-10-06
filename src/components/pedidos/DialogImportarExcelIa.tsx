import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, FileSpreadsheet, Loader2, Check } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";

export const DialogImportarExcelIa = () => {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const empresaId = useEmpresaId();
  const navigate = useNavigate();

  // Buscar produtos
  const { data: produtos } = useQuery({
    queryKey: ["produtos", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("*, produto_cores(codigo, descricao)").eq("empresa_id", empresaId);
      return data || [];
    }
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      toast.error("Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV.");
      return;
    }

    if (!produtos || produtos.length === 0) {
      toast.error("Nenhum produto cadastrado no sistema para vincular.");
      return;
    }

    setIsProcessing(true);

    try {
      const dataBuf = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuf);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet);

      if (data.length === 0) {
        toast.error("Planilha vazia.");
        setIsProcessing(false);
        return;
      }

      const itensMapeados = [];
      let produtosEncontrados = 0;

      for (const row of data as any[]) {
        let sku = '';
        let nomeProduto = '';
        let hintCor = "";
        let hintNome = "";
        let hintCodCor = "";
        let hintNomeCor = "";
        let quantidade = 0;

        for (const key of Object.keys(row)) {
            const val = String(row[key]).trim();
            if (!val) continue;

            const normalizedKey = key.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const originalKeyStr = key.trim();
            
            if (normalizedKey === 'codigo' || normalizedKey.includes('artigo') || normalizedKey.includes('sku') || normalizedKey.includes('codigo do produto')) {
              sku = val;
            }
            if (normalizedKey === 'produto' || normalizedKey.includes('desc') || normalizedKey.includes('nome do produto') || normalizedKey === 'descricao') {
              nomeProduto = val;
            }
            
            if (normalizedKey === 'nome' || normalizedKey === 'nome da cor') {
                hintNome = val;
            }
            if (originalKeyStr === 'cor' || originalKeyStr === 'Cor' || originalKeyStr === 'COR') {
                hintCor = val;
            }
            if (normalizedKey.includes('cod cor') || normalizedKey.includes('cód cor') || normalizedKey.includes('codigo da cor')) {
                hintCodCor = val;
            }
            if (normalizedKey === 'nome da cor') {
                hintNomeCor = val;
            }
            
            if (normalizedKey.includes('quantidade') || normalizedKey.includes('qtd') || normalizedKey.includes('saldo') || normalizedKey.includes('estoque')) {
              quantidade = Number(row[key]) || 0;
            }
        }

        if ((!sku && !nomeProduto) || quantidade <= 0) continue;

        // TENTA PUXAR PELO CÓDIGO (SKU). Só usa o nome se a planilha não tiver enviado código nenhum.
        const produtoDb = produtos.find((p: any) => {
            if (sku) {
                return p.sku && String(p.sku).toLowerCase() === sku.toLowerCase();
            }
            return p.nome && String(p.nome).toLowerCase() === nomeProduto.toLowerCase();
        });

        if (produtoDb) {
          // Tenta extrair da planilha
          let corFinal = hintNome || hintNomeCor || "";
          let codCorFinal = hintCodCor || "";
          
          if (!corFinal && hintCor && isNaN(Number(hintCor))) corFinal = String(hintCor);
          if (!codCorFinal && hintCor && !isNaN(Number(hintCor))) codCorFinal = String(hintCor);
          if (!codCorFinal && hintCor && !corFinal) codCorFinal = String(hintCor);

          // Limpa espaços em branco extras
          corFinal = corFinal.trim();
          codCorFinal = String(codCorFinal).trim();

          // Preenche lacunas com o cadastro de produtos APENAS se algo estiver faltando
          if (produtoDb.produto_cores && produtoDb.produto_cores.length > 0) {
              if (codCorFinal && !corFinal) {
                  // Tem código, mas não tem nome. Busca o nome pelo código.
                  const corDb = produtoDb.produto_cores.find((c: any) => String(c.codigo).trim() === codCorFinal);
                  if (corDb) corFinal = corDb.descricao;
              } else if (!codCorFinal && corFinal) {
                  // Tem nome, mas não tem código. Busca o código pelo nome.
                  const corDb = produtoDb.produto_cores.find((c: any) => String(c.descricao).trim().toLowerCase() === corFinal.toLowerCase());
                  if (corDb) codCorFinal = corDb.codigo || "";
              } else if (!codCorFinal && !corFinal && produtoDb.produto_cores.length === 1) {
                  // Não tem nenhum dos dois e o produto só tem 1 cor cadastrada.
                  corFinal = produtoDb.produto_cores[0].descricao;
                  codCorFinal = produtoDb.produto_cores[0].codigo || "";
              }
          }

          itensMapeados.push({
            produto_id: produtoDb.id,
            produto_nome: produtoDb.nome,
            produto_sku: produtoDb.sku || "",
            cor: corFinal,
            codigo_cor: codCorFinal,
            quantidade,
            preco_unitario: 0 // Valor base, deverá ser atualizado com a tabela de preços
          });
          produtosEncontrados++;
        }
      }

      if (produtosEncontrados === 0) {
        toast.error("Nenhum produto da planilha foi encontrado no sistema. Verifique a coluna de código/SKU.");
        setIsProcessing(false);
        return;
      }

      toast.success(`${produtosEncontrados} itens encontrados e mapeados!`);
      
      setOpen(false);
      
      // setTimeout to allow Radix Dialog to cleanup pointer-events before navigating
      setTimeout(() => {
          navigate("/pedidos/novo", {
            state: {
              pedidoImportado: {
                clienteId: "",
                observacoes: "Pedido importado via Excel.",
                numeroPedido: "",
                itens: itensMapeados
              }
            }
          });
      }, 100);

    } catch (err: any) {
      toast.error("Erro ao processar planilha: " + err.message);
    } finally {
      setIsProcessing(false);
      event.target.value = ''; 
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200">
          <FileSpreadsheet className="w-4 h-4" />
          Importar Excel
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar Pedido de Planilha Excel</DialogTitle>
        </DialogHeader>

        {!isProcessing && (
          <div className="space-y-4">
            <Alert className="bg-blue-50/50 text-blue-800 border-blue-200/50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 font-semibold">Estrutura da Planilha</AlertTitle>
              <AlertDescription className="text-blue-700/90 text-sm mt-2 space-y-2">
                <p>O sistema irá ler os itens da sua planilha e adicioná-los automaticamente a um novo pedido. A planilha deve conter as colunas:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li><strong>Código</strong> ou <strong>Produto</strong></li>
                  <li><strong>Quantidade</strong></li>
                  <li><strong>Código da Cor</strong> e/ou <strong>Nome da Cor</strong> (opcional)</li>
                </ul>
                <p className="text-xs italic mt-2 text-blue-600/80">O cliente e os preços serão definidos manualmente na próxima tela.</p>
              </AlertDescription>
            </Alert>

            <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed rounded-lg border-muted-foreground/25 bg-muted/10 transition-colors hover:bg-muted/20">
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">Selecione o arquivo Excel do pedido (.xlsx, .xls)</p>
              <Input type="file" accept=".xlsx, .xls, .csv" className="max-w-xs cursor-pointer" onChange={handleFileUpload} disabled={isProcessing} />
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-sm font-medium">Lendo planilha e localizando produtos no cadastro...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
