import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Package, Search, Pencil, FileSpreadsheet } from "lucide-react";
import { useProdutos, useToggleAtivoProduto } from "@/hooks/useProdutos";
import CadastroProdutoDialog from "@/components/produtos/CadastroProdutoDialog";
import ImportarProdutosDialog from "@/components/produtos/ImportarProdutosDialog";
import DetalhesProduto from "@/components/produtos/DetalhesProduto";

export default function Produtos() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [dialogCadastroOpen, setDialogCadastroOpen] = useState(false);
  const [dialogImportarOpen, setDialogImportarOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null);

  const { data: produtos, isLoading } = useProdutos();
  const toggleAtivo = useToggleAtivoProduto();

  const produtosFiltrados = produtos?.filter((p) => {
    const matchBusca =
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.sku.toLowerCase().includes(busca.toLowerCase());

    const matchStatus =
      filtroStatus === "todos" ||
      (filtroStatus === "ativos" && p.ativo) ||
      (filtroStatus === "inativos" && !p.ativo);

    return matchBusca && matchStatus;
  });

  if (produtoSelecionado) {
    return (
      <DetalhesProduto
        produtoId={produtoSelecionado}
        onVoltar={() => setProdutoSelecionado(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie itens e configurações de produção
          </p>
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setDialogImportarOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => setDialogCadastroOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {
        isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : produtosFiltrados && produtosFiltrados.length > 0 ? (
          <>
            {/* Desktop View (Table) */}
            <div className="hidden md:block border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Preço CPF</TableHead>
                    <TableHead>Preço CNPJ</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosFiltrados.map((produto) => (
                    <TableRow
                      key={produto.id}
                      className="h-8 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setProdutoSelecionado(produto.id)}
                    >
                      <TableCell className="py-1 font-mono text-xs text-muted-foreground">{produto.sku}</TableCell>
                      <TableCell className="py-1 font-medium text-sm">
                        {produto.nome}
                      </TableCell>
                      <TableCell className="py-1 text-sm">
                        {produto.preco_cpf ? `R$ ${Number(produto.preco_cpf).toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="py-1 text-sm">
                        {produto.preco_cnpj ? `R$ ${Number(produto.preco_cnpj).toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="py-1">
                        <Badge
                          variant={produto.ativo ? "default" : "secondary"}
                          className={`h-5 text-[10px] px-1.5 ${produto.ativo
                            ? "bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-100/80 border-gray-200"
                            }`}
                        >
                          {produto.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1 text-right gap-1 flex justify-end items-center h-full">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:text-primary/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProdutoSelecionado(produto.id);
                          }}
                          title="Editar Produto"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-3">
              {produtosFiltrados.map((produto) => (
                <div
                  key={produto.id}
                  className="bg-card rounded-lg border p-4 cursor-pointer hover:border-primary/50 transition-colors active:bg-muted/5"
                  onClick={() => setProdutoSelecionado(produto.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold text-base">{produto.nome}</div>
                      <div className="font-mono text-xs text-muted-foreground mt-0.5">SKU: {produto.sku}</div>
                    </div>
                    <Badge
                      variant={produto.ativo ? "default" : "secondary"}
                      className={`h-5 text-[10px] px-1.5 whitespace-nowrap ${produto.ativo
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-gray-100 text-gray-700 border-gray-200"
                        }`}
                    >
                      {produto.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

                  <div className="flex justify-end pt-2 border-t mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-primary hover:text-primary/80 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProdutoSelecionado(produto.id);
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1.5" />
                      Editar Detalhes
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 border rounded-md bg-muted/10">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum produto encontrado</p>
            <p className="text-sm text-muted-foreground">
              {busca || filtroStatus !== "todos"
                ? "Tente ajustar os filtros"
                : "Crie seu primeiro produto para começar"}
            </p>
          </div>
        )
      }

      <CadastroProdutoDialog
        open={dialogCadastroOpen}
        onOpenChange={setDialogCadastroOpen}
      />
      <ImportarProdutosDialog
        open={dialogImportarOpen}
        onOpenChange={setDialogImportarOpen}
      />
    </div >
  );
}
