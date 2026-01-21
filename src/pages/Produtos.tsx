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
import { Plus, Package, Search, Eye, Trash2, FileSpreadsheet } from "lucide-react";
import { useProdutos, useToggleAtivoProduto, useExcluirProduto } from "@/hooks/useProdutos";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const excluirProduto = useExcluirProduto();

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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
            {produtos && (
              <Badge variant="secondary" className="mt-1">
                {produtos.length} {produtos.length === 1 ? 'produto' : 'produtos'}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Gerencie produtos e suas etapas de produção
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialogImportarOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar Excel
          </Button>
          <Button onClick={() => setDialogCadastroOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
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
          <SelectTrigger className="w-[180px]">
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
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtosFiltrados.map((produto) => (
                  <TableRow key={produto.id} className="h-8">
                    <TableCell className="py-1 font-mono text-xs">{produto.sku}</TableCell>
                    <TableCell
                      className="py-1 font-medium text-sm cursor-pointer hover:underline text-primary"
                      onClick={() => setProdutoSelecionado(produto.id)}
                    >
                      {produto.nome}
                    </TableCell>
                    <TableCell className="py-1">
                      <Badge variant={produto.ativo ? "default" : "secondary"} className="h-5 text-[10px] px-1.5">
                        {produto.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1 text-right gap-1 flex justify-end items-center h-full">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setProdutoSelecionado(produto.id)}
                        title="Ver Detalhes"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          toggleAtivo.mutate({ id: produto.id, ativo: !produto.ativo })
                        }
                        title={produto.ativo ? "Desativar" : "Ativar"}
                      >
                        {produto.ativo ? (
                          <span className="text-xs text-green-600 font-bold">ON</span>
                        ) : (
                          <span className="text-xs text-red-500 font-bold">OFF</span>
                        )}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive/80">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir <strong>{produto.nome}</strong>?
                              <br />
                              Essa ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => excluirProduto.mutate(produto.id)}
                            >
                              Sim, excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
