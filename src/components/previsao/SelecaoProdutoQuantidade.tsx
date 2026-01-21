import { X } from "lucide-react";
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
import { useProdutos } from "@/hooks/useProdutos";

interface ProdutoItem {
  produto_id: string;
  quantidade: number;
}

interface SelecaoProdutoQuantidadeProps {
  item: ProdutoItem;
  index: number;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: keyof ProdutoItem, value: any) => void;
}

export default function SelecaoProdutoQuantidade({
  item,
  index,
  onRemove,
  onUpdate,
}: SelecaoProdutoQuantidadeProps) {
  const { data: produtos } = useProdutos(true);

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Produto {index + 1}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`produto-${index}`}>Produto</Label>
        <Select
          value={item.produto_id}
          onValueChange={(value) => onUpdate(index, "produto_id", value)}
        >
          <SelectTrigger id={`produto-${index}`}>
            <SelectValue placeholder="Selecione o produto" />
          </SelectTrigger>
          <SelectContent>
            {produtos?.map((produto) => (
              <SelectItem key={produto.id} value={produto.id}>
                {produto.nome} ({produto.sku})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`quantidade-${index}`}>Quantidade</Label>
        <Input
          id={`quantidade-${index}`}
          type="number"
          min="1"
          value={item.quantidade || ""}
          onChange={(e) =>
            onUpdate(index, "quantidade", parseInt(e.target.value) || 0)
          }
          placeholder="Ex: 500"
        />
      </div>
    </div>
  );
}
