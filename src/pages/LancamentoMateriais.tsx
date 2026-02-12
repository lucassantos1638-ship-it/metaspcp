import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";
import AbaMateriaisLote from "@/components/producao/AbaMateriaisLote";
import { useDetalhesLote } from "@/hooks/useDetalhesLote";

export default function LancamentoMateriais() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, isLoading } = useDetalhesLote(id || null);

    if (isLoading) {
        return <div className="p-8 text-center">Carregando...</div>;
    }

    if (!data?.lote) {
        return (
            <div className="container mx-auto py-6">
                <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>
                <div>Lote não encontrado</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <Button variant="ghost" onClick={() => navigate("/lancamento-mp")} className="self-start md:self-center pl-0 md:pl-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>
                <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                    <Package className="h-5 w-5 md:h-6 md:w-6" />
                    Lançamento de Materiais - Lote #{data.lote.numero_lote}
                </h1>
            </div>

            <div className="bg-background border rounded-lg p-6">
                <AbaMateriaisLote loteId={data.lote.id} produtoId={data.lote.produto_id} />
            </div>
        </div>
    );
}
