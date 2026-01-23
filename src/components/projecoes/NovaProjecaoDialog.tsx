import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCriarProjecao } from "@/hooks/useProjecoes";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface NovaProjecaoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onProjecaoCriada?: (projecao: any) => void;
}

export default function NovaProjecaoDialog({
    open,
    onOpenChange,
    onProjecaoCriada
}: NovaProjecaoDialogProps) {
    const [cliente, setCliente] = useState("");
    const [dataProjecao, setDataProjecao] = useState(format(new Date(), "yyyy-MM-dd"));
    const [tabelaPreco, setTabelaPreco] = useState("cpf");
    const { user } = useAuth();
    const criarProjecao = useCriarProjecao();

    const handleSalvar = () => {
        if (!cliente || !dataProjecao || !user) return;

        // Use selected date directly strings - treat as local date, but save as ISO
        // Creating date object from yyyy-MM-dd string treats it as UTC if only string? 
        // Actually new Date("2026-02-15") assumes UTC usuarlly, but inputs use local.
        // Let's create date properly to avoid timezone shifts showing "previous day"
        const [ano, mes, dia] = dataProjecao.split("-").map(Number);
        const dataRef = new Date(ano, mes - 1, dia);

        criarProjecao.mutate(
            {
                cliente_nome: cliente,
                data_referencia: dataRef,
                usuario_id: user.id,
                usuario_nome: user.nome || user.username || user.email || "Usuário",
                tabela_preco: tabelaPreco,
            },
            {
                onSuccess: (data) => {
                    // Do NOT close dialog here if we want to transition? 
                    // Actually parent closes it or keeps it? 
                    // Implementation plan says "close it and immediately open Detalhes".
                    // So onOpenChange(false) and callback.
                    onOpenChange(false);
                    setCliente("");
                    setTabelaPreco("cpf");
                    setDataProjecao(format(new Date(), "yyyy-MM-dd"));

                    if (onProjecaoCriada) {
                        onProjecaoCriada(data);
                    }
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nova Projeção de Vendas</DialogTitle>
                    <DialogDescription>
                        Defina o cliente e a data para iniciar.
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
                            <Label>Data da Projeção</Label>
                            <Input
                                type="date"
                                value={dataProjecao}
                                onChange={(e) => setDataProjecao(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Tabela de Preço</Label>
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
                    <Button onClick={handleSalvar} disabled={!cliente || !dataProjecao || criarProjecao.isPending}>
                        {criarProjecao.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Próximo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
