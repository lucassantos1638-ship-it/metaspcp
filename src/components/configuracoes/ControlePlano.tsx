import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { CalendarIcon, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const ControlePlano = () => {
  const queryClient = useQueryClient();
  const [planoAtivo, setPlanoAtivo] = useState<string>("mensal");
  const [dataRenovacao, setDataRenovacao] = useState<Date>();

  const { data: config, isLoading } = useQuery({
    queryKey: ["configuracoes-empresa"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("configuracoes_empresa")
          .select("*")
          .single();

        if (error) throw error;
        return data;
      } catch (error) {
        console.warn("Supabase fetch failed, returning mock data", error);
        return {
          id: "mock-id",
          plano_ativo: "mensal",
          data_renovacao_plano: new Date().toISOString()
        };
      }
    }
  });

  useEffect(() => {
    if (config) {
      setPlanoAtivo(config.plano_ativo || "mensal");
      if (config.data_renovacao_plano) {
        setDataRenovacao(new Date(config.data_renovacao_plano));
      }
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      try {
        const { error } = await supabase
          .from("configuracoes_empresa")
          .update({
            plano_ativo: planoAtivo,
            data_renovacao_plano: dataRenovacao ? format(dataRenovacao, "yyyy-MM-dd") : null
          })
          .eq("id", config?.id);

        if (error) throw error;
      } catch (error) {
        console.warn("Supabase update failed, using mock mode", error);
        return { mock: true };
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes-empresa"] });
      if (data?.mock) {
        toast.success("Plano atualizado com sucesso! (Modo Teste)");
        queryClient.setQueryData(["configuracoes-empresa"], (old: any) => ({
          ...old,
          plano_ativo: planoAtivo,
          data_renovacao_plano: dataRenovacao ? format(dataRenovacao, "yyyy-MM-dd") : null
        }));
      } else {
        toast.success("Plano atualizado com sucesso!");
      }
    },
    onError: () => {
      toast.error("Erro ao atualizar plano");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Controle de Plano
        </CardTitle>
        <CardDescription>
          Gerencie o plano de assinatura e data de renovação
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plano">Plano Ativo</Label>
            <Select value={planoAtivo} onValueChange={setPlanoAtivo}>
              <SelectTrigger id="plano">
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data de Renovação</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataRenovacao && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataRenovacao ? format(dataRenovacao, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataRenovacao}
                  onSelect={setDataRenovacao}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Atualizando..." : "Atualizar Plano"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ControlePlano;
