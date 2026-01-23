import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCriarVendaPerdida } from "@/hooks/useVendasPerdidas";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface NovaVendaPerdidaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onVendaCriada?: (venda: any) => void;
}

export default function NovaVendaPerdidaDialog({
    open,
    onOpenChange,
    onVendaCriada
}: NovaVendaPerdidaDialogProps) {
    const [cliente, setCliente] = useState("");
    const [dataReferencia, setDataReferencia] = useState(format(new Date(), "yyyy-MM-dd"));
    const [tabelaPreco, setTabelaPreco] = useState("cpf");
    const { user } = useAuth();
    const empresaId = user?.empresa_id;
    const criarVenda = useCriarVendaPerdida();

    const handleSalvar = () => {
        if (!cliente || !dataReferencia || !user || !empresaId) return;

        const [ano, mes, dia] = dataReferencia.split("-").map(Number);
        const dataRef = new Date(ano, mes - 1, dia);

        criarVenda.mutate(
            {
                cliente_nome: cliente,
                data_referencia: dataRef,
                usuario_id: user.id,
                usuario_nome: user.nome || user.username || user.email || "Usuário",
                empresa_id: empresaId,
                tabela_preco: tabelaPreco,
            },
            {
                onSuccess: (data) => {
                    onOpenChange(false);
                    setCliente("");
                    setTabelaPreco("cpf");
                    setDataReferencia(format(new Date(), "yyyy-MM-dd"));

                    if (onVendaCriada) {
                        onVendaCriada(data);
                    }
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nova Venda Perdida</DialogTitle>
                    <DialogDescription>
                        Defina o cliente e a data para registrar a venda perdida.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nome do Cliente / Representante / Loja</Label>
                        <Input
                            placeholder="Ex: Loja Centro, João Silva (Rep)..."
                            value={cliente}
                            onChange={(e) => setCliente(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Data da Venda Perdida</Label>
                            <Input
                                type="date"
                                value={dataReferencia}
                                onChange={(e) => setDataReferencia(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Tabela de Preço da Venda</Label>
                            <Select value={tabelaPreco} onValueChange={setTabelaPreco}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cpf">CPF (Varejo)</SelectItem>
                                    <SelectItem value="cnpj">CNPJ (Atacado)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSalvar} disabled={!cliente || !dataReferencia || !empresaId || criarVenda.isPending}>
                        {criarVenda.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Próximo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
