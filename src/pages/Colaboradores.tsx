import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Plus } from "lucide-react";
import { useState } from "react";
import ImportarColaboradoresDialog from "@/components/configuracoes/ImportarColaboradoresDialog";

const Colaboradores = () => {
  const empresaId = useEmpresaId();
  const [dialogImportarOpen, setDialogImportarOpen] = useState(false);

  const { data: colaboradores } = useQuery({
    queryKey: ["colaboradores", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">Colaboradores</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Lista de colaboradores cadastrados</p>
        </div>
        <Button variant="outline" onClick={() => setDialogImportarOpen(true)}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Importar Excel
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {colaboradores && colaboradores.length > 0 ? (
          colaboradores.map((colaborador: any) => (
            <Card key={colaborador.id} className={colaborador.ativo === false ? "opacity-70" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-bold">{colaborador.nome}</CardTitle>
                <div className={`px-2 py-1 rounded-full text-xs font-semibold ${colaborador.ativo !== false ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {colaborador.ativo !== false ? "Ativo" : "Inativo"}
                </div>
              </CardHeader>
              <CardContent>
                {colaborador.funcao && (
                  <p className="text-muted-foreground font-medium mb-2">{colaborador.funcao}</p>
                )}
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    Custo/Hora: R$ {colaborador.custo_por_hora?.toFixed(2) || "0.00"}
                  </p>
                  <p>
                    Cadastrado em{" "}
                    {new Date(colaborador.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                Nenhum colaborador cadastrado ainda.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      <ImportarColaboradoresDialog
        open={dialogImportarOpen}
        onOpenChange={setDialogImportarOpen}
      />
    </div>
  );
};

export default Colaboradores;
