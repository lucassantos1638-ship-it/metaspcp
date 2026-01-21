import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { useEmpresaId } from "@/hooks/useEmpresaId";

const ExclusaoPedidos = () => {
  const empresaId = useEmpresaId();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePedido, setDeletePedido] = useState<any>(null);

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["pedidos-exclusao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsoes_producao")
        .select(`
          *,
          lotes(id),
          previsao_ajustes(id),
          previsao_imprevistos(id)
        `)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (pedidoId: string) => {
      // Desvincular lotes
      const { error: loteError } = await supabase
        .from("lotes")
        .update({ previsao_id: null })
        .eq("previsao_id", pedidoId);

      if (loteError) throw loteError;

      // Excluir imprevistos
      const { error: imprevistosError } = await supabase
        .from("previsao_imprevistos")
        .delete()
        .eq("previsao_id", pedidoId);

      if (imprevistosError) throw imprevistosError;

      // Excluir ajustes
      const { error: ajustesError } = await supabase
        .from("previsao_ajustes")
        .delete()
        .eq("previsao_id", pedidoId);

      if (ajustesError) throw ajustesError;

      // Excluir previsão
      const { error: previsaoError } = await supabase
        .from("previsoes_producao")
        .delete()
        .eq("id", pedidoId);

      if (previsaoError) throw previsaoError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-exclusao"] });
      toast.success("Pedido e todos os dados vinculados excluídos com sucesso!");
      setIsDeleteDialogOpen(false);
      setDeletePedido(null);
    },
    onError: () => {
      toast.error("Erro ao excluir pedido");
      setIsDeleteDialogOpen(false);
      setDeletePedido(null);
    }
  });

  const handleDelete = (pedido: any) => {
    setDeletePedido(pedido);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletePedido) {
      deleteMutation.mutate(deletePedido.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      em_andamento: "secondary",
      concluido: "default",
      cancelado: "destructive"
    };
    const labels: Record<string, string> = {
      em_andamento: "Em Andamento",
      concluido: "Concluído",
      cancelado: "Cancelado"
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Exclusão de Pedidos
          </CardTitle>
          <CardDescription>
            Exclua pedidos e todos os dados relacionados (ajustes, imprevistos)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Pedido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Lotes</TableHead>
                  <TableHead>Ajustes</TableHead>
                  <TableHead>Imprevistos</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos?.map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell className="font-medium">{pedido.nome_pedido}</TableCell>
                    <TableCell>{getStatusBadge(pedido.status || "em_andamento")}</TableCell>
                    <TableCell>{format(new Date(pedido.data_entrega_desejada), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{pedido.lotes?.length || 0}</TableCell>
                    <TableCell>{pedido.previsao_ajustes?.length || 0}</TableCell>
                    <TableCell>{pedido.previsao_imprevistos?.length || 0}</TableCell>
                    <TableCell>{format(new Date(pedido.created_at || ""), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(pedido)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão de Pedido</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Tem certeza que deseja excluir o pedido <strong>{deletePedido?.nome_pedido}</strong>?</p>
              <div className="space-y-1 text-sm">
                {deletePedido?.lotes && deletePedido.lotes.length > 0 && (
                  <p>• <strong>{deletePedido.lotes.length}</strong> lotes serão desvinculados</p>
                )}
                {deletePedido?.previsao_ajustes && deletePedido.previsao_ajustes.length > 0 && (
                  <p>• <strong>{deletePedido.previsao_ajustes.length}</strong> ajustes serão excluídos</p>
                )}
                {deletePedido?.previsao_imprevistos && deletePedido.previsao_imprevistos.length > 0 && (
                  <p>• <strong>{deletePedido.previsao_imprevistos.length}</strong> imprevistos serão excluídos</p>
                )}
              </div>
              <p className="font-semibold">Esta ação não pode ser desfeita.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Excluir Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ExclusaoPedidos;
