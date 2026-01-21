import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEmpresaId } from "@/hooks/useEmpresaId";

const ListaMetas = () => {
  const empresaId = useEmpresaId();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select(`
          *,
          etapas(nome),
          subetapas(nome)
        `)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const deleteMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Meta excluída com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["metas"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir meta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMeta = useMutation({
    mutationFn: async ({ id, meta }: { id: string; meta: number }) => {
      const { error } = await supabase
        .from("metas")
        .update({ meta })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Meta atualizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      setEditingId(null);
      setEditValue("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar meta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (id: string, currentMeta: number) => {
    setEditingId(id);
    setEditValue(currentMeta.toString());
  };

  const handleSave = (id: string) => {
    if (!editValue || parseInt(editValue) <= 0) {
      toast({
        title: "Valor inválido",
        description: "A meta deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }
    updateMeta.mutate({ id, meta: parseInt(editValue) });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metas Cadastradas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : metas && metas.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa/Subetapa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="w-[180px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metas.map((meta: any) => (
                <TableRow key={meta.id}>
                  <TableCell className="font-medium">
                    {meta.subetapas?.nome || meta.etapas?.nome}
                  </TableCell>
                  <TableCell>{meta.subetapa_id ? "Subetapa" : "Etapa"}</TableCell>
                  <TableCell className="text-right">
                    {editingId === meta.id ? (
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-24 ml-auto"
                        autoFocus
                      />
                    ) : (
                      meta.meta
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {editingId === meta.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSave(meta.id)}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCancel}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(meta.id, meta.meta)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMeta.mutate(meta.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhuma meta cadastrada</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ListaMetas;
