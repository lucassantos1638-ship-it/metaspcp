import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePrevisoesSalvas } from "@/hooks/useAcompanhamentoPedidos";
import CardPedido from "@/components/acompanhamento/CardPedido";
import DetalhesPedido from "@/components/acompanhamento/DetalhesPedido";
import { Search, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AcompanhamentoPedidos() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("em_andamento");
  const [pedidoSelecionado, setPedidoSelecionado] = useState<string | null>(null);

  const { data: previsoes, isLoading } = usePrevisoesSalvas(filtroStatus);
  const navigate = useNavigate();

  const previsoesFiltradas = previsoes?.filter((p) =>
    p.nome_pedido.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
            Acompanhamento de Pedidos
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gerencie e acompanhe suas previsões de produção em tempo real
          </p>
        </div>
        <Button onClick={() => navigate("/previsao-producao")}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Previsão
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="concluida">Concluídas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[300px] bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : previsoesFiltradas && previsoesFiltradas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {previsoesFiltradas.map((previsao) => (
            <CardPedido
              key={previsao.id}
              previsao={previsao}
              onVerDetalhes={() => setPedidoSelecionado(previsao.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {busca
              ? "Nenhum pedido encontrado com este nome"
              : filtroStatus === "todos"
              ? "Nenhuma previsão salva ainda"
              : `Nenhum pedido ${filtroStatus === "em_andamento" ? "em andamento" : filtroStatus}`}
          </p>
          {!busca && (
            <Button onClick={() => navigate("/previsao-producao")}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Previsão
            </Button>
          )}
        </div>
      )}

      {pedidoSelecionado && (
        <DetalhesPedido
          open={!!pedidoSelecionado}
          onOpenChange={(open) => !open && setPedidoSelecionado(null)}
          previsaoId={pedidoSelecionado}
        />
      )}
    </div>
  );
}
