import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { useEmpresaId } from "@/hooks/useEmpresaId";

const getVelocidadeLabel = (segundos: number): string => {
  if (segundos <= 80) return "Rápido ⚡";
  if (segundos <= 140) return "Moderado 🚶";
  if (segundos <= 220) return "Lento 🐢";
  if (segundos <= 300) return "Muito Lento 🐌";
  return "Super Lento 🦥";
};

export function ConfiguracoesDashboard() {
  const empresaId = useEmpresaId();
  const [velocidade, setVelocidade] = useState<number>(120);
  const [estilo, setEstilo] = useState<'lista_rolante' | 'grid_cards'>('lista_rolante');
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["configuracoes-empresa", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_empresa")
        .select("id, velocidade_scroll_dashboard, estilo_lista_dashboard")
        .eq("empresa_id", empresaId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config?.velocidade_scroll_dashboard) {
      setVelocidade(config.velocidade_scroll_dashboard);
    }
    if (config?.estilo_lista_dashboard) {
      setEstilo(config.estilo_lista_dashboard as 'lista_rolante' | 'grid_cards');
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (dados: { velocidade: number; estilo: string }) => {
      const { error } = await supabase
        .from("configuracoes_empresa")
        .upsert({
          empresa_id: empresaId,
          velocidade_scroll_dashboard: dados.velocidade,
          estilo_lista_dashboard: dados.estilo,
          updated_at: new Date().toISOString()
        }, { onConflict: 'empresa_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes-empresa"] });
      toast.success("Configurações do dashboard atualizadas com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar configurações:", error);
      toast.error("Erro ao atualizar configurações do dashboard");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ velocidade, estilo });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Carregando configurações...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações do Dashboard</CardTitle>
        <CardDescription>
          Ajuste a velocidade em que a lista de colaboradores se move automaticamente no ranking
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <Label>Estilo de Exibição dos Colaboradores</Label>
            <RadioGroup value={estilo} onValueChange={(value) => setEstilo(value as 'lista_rolante' | 'grid_cards')}>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="lista_rolante" id="lista_rolante" className="mt-1" />
                <Label htmlFor="lista_rolante" className="cursor-pointer font-normal">
                  <span className="font-semibold">📜 Lista Vertical Rolante</span>
                  <span className="block text-xs text-muted-foreground">
                    Lista vertical com scroll automático de cima para baixo
                  </span>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="grid_cards" id="grid_cards" className="mt-1" />
                <Label htmlFor="grid_cards" className="cursor-pointer font-normal">
                  <span className="font-semibold">🎴 Grid Horizontal Rolante</span>
                  <span className="block text-xs text-muted-foreground">
                    Cards deslizando horizontalmente (carrossel infinito)
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label htmlFor="velocidade-slider">Velocidade do Scroll Automático</Label>
              <span className="text-sm font-mono font-semibold">
                {velocidade}s - {getVelocidadeLabel(velocidade)}
              </span>
            </div>

            <Slider
              id="velocidade-slider"
              value={[velocidade]}
              onValueChange={(value) => setVelocidade(value[0])}
              min={60}
              max={400}
              step={20}
              className="w-full"
            />

            <div className="flex justify-between text-xs text-muted-foreground pt-2">
              <span>Rápido (60s)</span>
              <span>Moderado (140s)</span>
              <span>Lento (240s)</span>
              <span>Super Lento (400s) 🦥</span>
            </div>

            <p className="text-xs text-muted-foreground">
              Ajuste o tempo de animação do scroll. Aplica-se a ambos os estilos de exibição.
            </p>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
