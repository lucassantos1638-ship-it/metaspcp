import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileUp, Loader2, ArrowRightLeft } from "lucide-react";
import { extractTextFromPDF } from "@/lib/pdfUtils";
import { analisarTextoNfeComIA, NFeExtraidaIA } from "@/lib/iaNfeUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DialogTransferenciaTerceirizacao } from "./DialogTransferenciaTerceirizacao";

export const DialogImportarNFe = () => {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nfeIa, setNfeIa] = useState<NFeExtraidaIA | null>(null);
  
  // Auto-matched states
  const [origemId, setOrigemId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");
  const [tipoMov, setTipoMov] = useState<"TRANSFERENCIA" | "REMESSA" | "RETORNO">("TRANSFERENCIA");
  
  const empresaId = useEmpresaId();

  // Fetch entidades
  const { data: entidades } = useQuery({
    queryKey: ["entidades", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("entidade").select("*").eq("empresa_id", empresaId);
      return data || [];
    }
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF da NFe.");
      return;
    }

    setIsProcessing(true);
    setNfeIa(null);
    setOrigemId("");
    setDestinoId("");

    try {
      const texto = await extractTextFromPDF(file);
      const dados = await analisarTextoNfeComIA(texto);
      setNfeIa(dados);
    } catch (error: any) {
      console.error(error);
      toast.error(`Erro: ${error.message || "Falha ao processar a nota fiscal"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  React.useEffect(() => {
    if (nfeIa && entidades) {
      // Find matching origin
      const matchedOrigem = entidades.find(c => {
        const docDB = c.cpf_cnpj?.replace(/\D/g, '') || "";
        const docPDF = nfeIa.remetenteCnpj?.replace(/\D/g, '') || "";
        if (docPDF && docDB === docPDF) return true;
        return c.nome.toLowerCase().includes(nfeIa.remetenteNome.toLowerCase().split(' ')[0]) || 
               nfeIa.remetenteNome.toLowerCase().includes(c.nome.toLowerCase().split(' ')[0]);
      });

      // Find matching destination
      const matchedDestino = entidades.find(c => {
        const docDB = c.cpf_cnpj?.replace(/\D/g, '') || "";
        const docPDF = nfeIa.destinatarioCnpj?.replace(/\D/g, '') || "";
        if (docPDF && docDB === docPDF) return true;
        return c.nome.toLowerCase().includes(nfeIa.destinatarioNome.toLowerCase().split(' ')[0]) || 
               nfeIa.destinatarioNome.toLowerCase().includes(c.nome.toLowerCase().split(' ')[0]);
      });

      // Determine the Tipo de Movimentação and Entity IDs
      // Se a origem NAO foi encontrada nos parceiros terceirizados, assumimos que é a "Minha Empresa"
      const originIsMe = !matchedOrigem; 
      const destIsMe = !matchedDestino;

      if (originIsMe && !destIsMe) {
        setTipoMov("REMESSA");
        setOrigemId("MINHA_EMPRESA");
        setDestinoId(matchedDestino.id);
      } else if (!originIsMe && destIsMe) {
        setTipoMov("RETORNO");
        setOrigemId(matchedOrigem.id);
        setDestinoId("MINHA_EMPRESA");
      } else if (!originIsMe && !destIsMe) {
        setTipoMov("TRANSFERENCIA");
        setOrigemId(matchedOrigem.id);
        setDestinoId(matchedDestino.id);
      } else {
        // Fallback
        setTipoMov("TRANSFERENCIA");
        if (matchedOrigem) setOrigemId(matchedOrigem.id);
        if (matchedDestino) setDestinoId(matchedDestino.id);
      }
    }
  }, [nfeIa, entidades]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 h-9">
          <FileUp className="w-4 h-4 mr-2" />
          Importar NFe de Movimentação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-blue-600" />
            Importar Movimentação via NFe (IA)
          </DialogTitle>
        </DialogHeader>

        {!nfeIa ? (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
            {isProcessing ? (
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Lendo Nota Fiscal...</p>
                  <p className="text-xs text-slate-500 mt-1">A IA está extraindo as quantidades e empresas.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4 w-full">
                <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
                  <FileUp className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-700 mb-1">Selecione o PDF da Nota Fiscal</p>
                  <p className="text-xs text-slate-500 mb-4">
                    O sistema irá identificar o remetente, destinatário e itens automaticamente.
                  </p>
                </div>
                <Label 
                  htmlFor="pdf-upload" 
                  className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Procurar Arquivo PDF
                </Label>
                <input 
                  id="pdf-upload" 
                  type="file" 
                  accept="application/pdf"
                  className="hidden" 
                  onChange={handleFileUpload}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-emerald-800 flex items-center gap-2">
                  Nota Fiscal Extraída com Sucesso!
                </p>
                <p className="text-xs text-emerald-600 mt-1">Verifique os dados e clique em registrar em cada item lido.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setNfeIa(null)} className="text-xs bg-white">
                Ler outro PDF
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">REMETENTE LIDO DA NOTA</p>
                <p className="font-medium text-slate-800 text-sm">{nfeIa.remetenteNome}</p>
                <p className="text-xs text-slate-500">{nfeIa.remetenteCnpj || "CNPJ não identificado"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">DESTINATÁRIO LIDO DA NOTA</p>
                <p className="font-medium text-slate-800 text-sm">{nfeIa.destinatarioNome}</p>
                <p className="text-xs text-slate-500">{nfeIa.destinatarioCnpj || "CNPJ não identificado"}</p>
              </div>
              <div className="col-span-2 pt-2 mt-2 border-t border-slate-200 flex justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">NÚMERO DA NFE</p>
                  <p className="font-medium text-slate-800 text-sm">{nfeIa.numeroNota || "Não identificado"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 text-right">TIPO DA MOVIMENTAÇÃO</p>
                  <p className="font-bold text-blue-700 text-sm text-right">{tipoMov}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                Produtos Identificados
              </h4>
              
              {nfeIa.itens.map((item, idx) => (
                <div key={idx} className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                  <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{item.descricao}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Lido do PDF
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-700 text-lg">{item.quantidade} <span className="text-sm font-medium">{item.unidade}</span></p>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <DialogTransferenciaTerceirizacao 
                      activeCompanyId={origemId && origemId !== "MINHA_EMPRESA" ? origemId : (destinoId && destinoId !== "MINHA_EMPRESA" ? destinoId : "")}
                      trigger={<Button className="w-full">Registrar {tipoMov} deste Item</Button>}
                      initialData={{
                        tipoMov: tipoMov,
                        quantidadePreenchida: item.quantidade.toString(),
                        documentoPreenchido: nfeIa.numeroNota || "",
                        origemIdPreenchida: origemId,
                        destinoIdPreenchida: destinoId
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
