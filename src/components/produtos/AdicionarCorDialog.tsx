import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check } from "lucide-react";

interface AdicionarCorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoId: string;
  onCorAdicionada: () => void;
}

export default function AdicionarCorDialog({ open, onOpenChange, produtoId, onCorAdicionada }: AdicionarCorDialogProps) {
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    if (open) {
      setCodigo("");
      setDescricao("");
    }
  }, [open]);

  const handleSalvar = () => {
    if (!codigo.trim() || !descricao.trim()) {
      toast.error("Preencha o código e a descrição da cor.");
      return;
    }

    try {
      const storageKey = `produto_cores_${produtoId}`;
      const saved = localStorage.getItem(storageKey);
      const cores = saved ? JSON.parse(saved) : [];
      
      cores.push({ 
        id: crypto.randomUUID(), 
        codigo: codigo.trim(), 
        descricao: descricao.trim() 
      });
      
      localStorage.setItem(storageKey, JSON.stringify(cores));
      toast.success("Cor adicionada com sucesso!");
      onCorAdicionada();
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar a cor.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar Cor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Código da Cor</Label>
            <Input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ex: 140021" />
          </div>
          <div className="space-y-2">
            <Label>Descrição da Cor</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: VERDE CLARO" />
          </div>
          <div className="pt-2 flex justify-end">
            <Button onClick={handleSalvar}>
              <Check className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
