import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Trash2, Package, Search } from "lucide-react";
import { format } from "date-fns";
import { useEmpresaId } from "@/hooks/useEmpresaId";

const ExclusaoLotes = () => {
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteLote, setDeleteLote] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: lotes, isLoading } = useQuery({
    queryKey: ["lotes-exclusao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotes")
        .select(`
          *,
          produtos(nome, sku),
          producoes(id)
        `)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (loteId: string) => {
      // Excluir produções primeiro
      const { error: producaoError } = await supabase
        .from("producoes")
        .delete()
        .eq("lote_id", loteId);

      if (producaoError) throw producaoError;

      // Excluir lote
      const { error: loteError } = await supabase
        .from("lotes")
        .delete()
        .eq("id", loteId);

      if (loteError) throw loteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lotes-exclusao"] });
      toast.success("Lote e todas as produções excluídos com sucesso!");
      setIsDeleteDialogOpen(false);
      setDeleteLote(null);
    },
    onError: () => {
      toast.error("Erro ao excluir lote");
      setIsDeleteDialogOpen(false);
      setDeleteLote(null);
    }
  });

  const handleDelete = (lote: any) => {
    setDeleteLote(lote);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deleteLote) {
      deleteMutation.mutate(deleteLote.id);
    }
  };

  const filteredLotes = lotes?.filter((lote) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const numeroStr = lote.numero_lote?.toString() || "";
    const nomeStr = lote.nome_lote?.toLowerCase() || "";
    return numeroStr.includes(searchLower) || nomeStr.includes(searchLower);
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Exclusão de Lotes
              </CardTitle>
              <CardDescription>
                Exclua lotes e todas as produções vinculadas
              </CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por número ou nome..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Produções</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLotes?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                      Nenhum lote encontrado com os termos da pesquisa.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLotes?.map((lote) => (
                    <TableRow key={lote.id}>
                    <TableCell className="font-medium">{lote.numero_lote}</TableCell>
                    <TableCell>{lote.nome_lote}</TableCell>
                    <TableCell>{lote.produtos?.nome || "-"}</TableCell>
                    <TableCell>{lote.quantidade_total}</TableCell>
                    <TableCell>
                      <Badge variant={lote.finalizado ? "default" : "secondary"}>
                        {lote.finalizado ? "Finalizado" : "Em Andamento"}
                      </Badge>
                    </TableCell>
                    <TableCell>{lote.producoes?.length || 0}</TableCell>
                    <TableCell>{format(new Date(lote.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(lote)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão de Lote</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Tem certeza que deseja excluir o lote <strong>{deleteLote?.numero_lote}</strong>?</p>
              {deleteLote?.producoes && deleteLote.producoes.length > 0 && (
                <p className="text-destructive">
                  Este lote possui <strong>{deleteLote.producoes.length} produções</strong> registradas. 
                  Todas serão excluídas permanentemente.
                </p>
              )}
              <p className="font-semibold">Esta ação não pode ser desfeita.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Excluir Lote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ExclusaoLotes;
