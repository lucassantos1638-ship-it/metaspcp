
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Clock, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface DailySchedule {
  entrada: string;
  saida_almoco: string;
  volta_almoco: string;
  saida: string;
  ativo: boolean;
  ativo_manha: boolean;
  ativo_tarde: boolean;
}

interface WeeklySchedule {
  [key: string]: DailySchedule;
}

const DAYS_OF_WEEK = [
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];

const DEFAULT_DAY_SCHEDULE: DailySchedule = {
  entrada: "07:00",
  saida_almoco: "12:00",
  volta_almoco: "13:00",
  saida: "17:00",
  ativo: true,
  ativo_manha: true,
  ativo_tarde: true
};

const ConfiguracoesEmpresa = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State for General Info
  const [empresaInfo, setEmpresaInfo] = useState({
    nome_empresa: "",
    documento: "",
    endereco: ""
  });

  // State for Weekly Schedule
  const [schedule, setSchedule] = useState<WeeklySchedule>({});

  // Load Data
  const { data: config, isLoading } = useQuery({
    queryKey: ["configuracoes-empresa", user?.empresa_id],
    queryFn: async () => {
      if (!user?.empresa_id) throw new Error("Usuário sem empresa");

      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", user.empresa_id)
        .single();

      if (error) throw error;
      // Ensure we return object with expected properties, handling nulls
      return {
        ...data,
        escala_semanal: data.escala_semanal || {}
      };
    },
    enabled: !!user?.empresa_id,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  useEffect(() => {
    if (config) {
      setEmpresaInfo({
        nome_empresa: config.nome || "",
        documento: config.cnpj || "",
        endereco: config.endereco || ""
      });

      // Initialize Schedule
      const initialSchedule: WeeklySchedule = {};
      const dbSchedule = config.escala_semanal as unknown as WeeklySchedule;

      if (dbSchedule && Object.keys(dbSchedule).length > 0) {
        // Merge with defaults
        DAYS_OF_WEEK.forEach(day => {
          initialSchedule[day.key] = {
            ...DEFAULT_DAY_SCHEDULE, // defaults
            ...(dbSchedule[day.key] || {}) // override with saved
          };
        });
      } else {
        // Defaults
        DAYS_OF_WEEK.forEach(day => {
          initialSchedule[day.key] = { ...DEFAULT_DAY_SCHEDULE };
          if (day.key === 'sabado' || day.key === 'domingo') {
            initialSchedule[day.key].ativo = false;
          }
        });
      }
      setSchedule(initialSchedule);
    }
  }, [config]);

  const handleTimeChange = (dayKey: string, field: keyof DailySchedule, value: any) => {
    setSchedule(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: value
      }
    }));
  };

  const copyToAllDays = (sourceDayKey: string) => {
    const source = schedule[sourceDayKey];
    setSchedule(prev => {
      const newSchedule = { ...prev };
      DAYS_OF_WEEK.forEach(day => {
        if (day.key !== sourceDayKey) {
          newSchedule[day.key] = { ...source };
        }
      });
      return newSchedule;
    });
    toast.success("Horários copiados para todos os dias!");
  };

  const updateMutation = useMutation({
    mutationFn: async (data: { info: typeof empresaInfo, schedule: WeeklySchedule }) => {
      if (!user?.empresa_id) throw new Error("Usuário sem empresa");

      const { error } = await supabase
        .from("empresas")
        .update({
          nome: data.info.nome_empresa,
          cnpj: data.info.documento,
          endereco: data.info.endereco,
          escala_semanal: JSON.parse(JSON.stringify(data.schedule))
        })
        .eq("id", user.empresa_id)
        .select();

      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["configuracoes-empresa"] });
      toast.success("Dados salvos com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar dados: ${error.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ info: empresaInfo, schedule });
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Configurações da Empresa
        </CardTitle>
        <CardDescription>
          Dados cadastrais e horários de funcionamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Dados Gerais */}
          <div className="space-y-4 border-b pb-6">
            <h3 className="text-lg font-medium">Dados Gerais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome_empresa">Razão Social</Label>
                <Input
                  id="nome_empresa"
                  value={empresaInfo.nome_empresa}
                  onChange={(e) => setEmpresaInfo(prev => ({ ...prev, nome_empresa: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="documento">CNPJ / CPF</Label>
                <Input
                  id="documento"
                  value={empresaInfo.documento}
                  onChange={(e) => setEmpresaInfo(prev => ({ ...prev, documento: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco">Endereço Completo</Label>
                <Input
                  id="endereco"
                  value={empresaInfo.endereco}
                  onChange={(e) => setEmpresaInfo(prev => ({ ...prev, endereco: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Horários Semanal */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Horários de Funcionamento (Semanal)</h3>
              <span className="text-xs text-muted-foreground hidden md:inline-block">
                Configure os períodos de trabalho (Manhã/Tarde) para cada dia.
              </span>
            </div>

            <div className="border rounded-md divide-y">
              {/* Header Row (Desktop) */}
              <div className="hidden md:grid grid-cols-12 gap-2 p-3 bg-muted/50 text-sm font-medium text-muted-foreground text-center items-center">
                <div className="col-span-3 text-left pl-2">Dia / Turnos</div>
                <div className="col-span-2">Entrada</div>
                <div className="col-span-2">Saída (Almoço)</div>
                <div className="col-span-2">Volta (Almoço)</div>
                <div className="col-span-2">Saída</div>
                <div className="col-span-1">Ações</div>
              </div>

              {DAYS_OF_WEEK.map((day) => {
                const daySchedule = schedule[day.key] || DEFAULT_DAY_SCHEDULE;
                const isInactive = !daySchedule.ativo;
                const isMorningActive = !isInactive && daySchedule.ativo_manha;
                const isAfternoonActive = !isInactive && daySchedule.ativo_tarde;

                return (
                  <div key={day.key} className={cn(
                    "p-3 md:grid md:grid-cols-12 md:gap-2 flex flex-col gap-3 items-center hover:bg-muted/10 transition-colors",
                    isInactive && "opacity-60 bg-muted/5"
                  )}>
                    {/* Day Label & Checkbox */}
                    <div className="md:col-span-3 w-full flex flex-col justify-center gap-1">
                      <div className="flex items-center justify-start gap-3">
                        <Checkbox
                          id={`active-${day.key}`}
                          checked={daySchedule.ativo}
                          onCheckedChange={(checked) => handleTimeChange(day.key, 'ativo', checked)}
                        />
                        <div className="flex flex-col">
                          <Label
                            htmlFor={`active-${day.key}`}
                            className={cn("font-semibold text-base md:text-sm cursor-pointer", isInactive && "text-muted-foreground")}
                          >
                            {day.label}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 md:hidden ml-auto">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyToAllDays(day.key)}
                            title="Copiar para todos os dias"
                            disabled={isInactive}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Morning/Afternoon Toggles */}
                      <div className={cn("flex items-center gap-3 pl-7", isInactive && "opacity-50 pointer-events-none")}>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id={`manha-${day.key}`}
                            checked={daySchedule.ativo_manha}
                            onCheckedChange={(checked) => handleTimeChange(day.key, 'ativo_manha', checked)}
                            className="h-3.5 w-3.5"
                          />
                          <Label htmlFor={`manha-${day.key}`} className="text-xs font-normal cursor-pointer">Manhã</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id={`tarde-${day.key}`}
                            checked={daySchedule.ativo_tarde}
                            onCheckedChange={(checked) => handleTimeChange(day.key, 'ativo_tarde', checked)}
                            className="h-3.5 w-3.5"
                          />
                          <Label htmlFor={`tarde-${day.key}`} className="text-xs font-normal cursor-pointer">Tarde</Label>
                        </div>
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-2 md:grid-cols-1 md:col-span-2 w-full gap-1">
                      <span className="md:hidden text-xs text-muted-foreground">Entrada</span>
                      <Input
                        type="time"
                        className="h-8"
                        value={daySchedule.entrada}
                        onChange={(e) => handleTimeChange(day.key, 'entrada', e.target.value)}
                        disabled={!isMorningActive}
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-1 md:col-span-2 w-full gap-1">
                      <span className="md:hidden text-xs text-muted-foreground">Saída Almoço</span>
                      <Input
                        type="time"
                        className="h-8"
                        value={daySchedule.saida_almoco}
                        onChange={(e) => handleTimeChange(day.key, 'saida_almoco', e.target.value)}
                        disabled={!isMorningActive}
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-1 md:col-span-2 w-full gap-1">
                      <span className="md:hidden text-xs text-muted-foreground">Volta Almoço</span>
                      <Input
                        type="time"
                        className="h-8"
                        value={daySchedule.volta_almoco}
                        onChange={(e) => handleTimeChange(day.key, 'volta_almoco', e.target.value)}
                        disabled={!isAfternoonActive}
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-1 md:col-span-2 w-full gap-1">
                      <span className="md:hidden text-xs text-muted-foreground">Saída</span>
                      <Input
                        type="time"
                        className="h-8"
                        value={daySchedule.saida}
                        onChange={(e) => handleTimeChange(day.key, 'saida', e.target.value)}
                        disabled={!isAfternoonActive}
                      />
                    </div>

                    {/* Actions Desktop */}
                    <div className="md:col-span-1 hidden md:flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => copyToAllDays(day.key)}
                        title="Copiar para todos os dias"
                        disabled={isInactive}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}


            </div>
          </div>

          <div className="sticky bottom-0 bg-background pt-4 border-t mt-4 flex justify-end">
            <Button type="submit" size="lg" disabled={updateMutation.isPending} className="w-full md:w-auto">
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ConfiguracoesEmpresa;
