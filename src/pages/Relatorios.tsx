import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RelatorioLotes from "@/components/relatorios/RelatorioLotes";
import RelatorioCorte from "@/components/relatorios/RelatorioCorte";
import RelatorioColaborador from "@/components/relatorios/RelatorioColaborador";

const Relatorios = () => {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">Relatórios</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Visualize relatórios de produção, finalização e desempenho
        </p>
      </div>

      <Tabs defaultValue="lotes" className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-3 text-xs sm:text-sm">
          <TabsTrigger value="lotes">Lotes</TabsTrigger>
          <TabsTrigger value="corte">Finalização de Corte</TabsTrigger>
          <TabsTrigger value="colaborador">Individual</TabsTrigger>
        </TabsList>

        <TabsContent value="lotes" className="space-y-4">
          <RelatorioLotes />
        </TabsContent>

        <TabsContent value="corte" className="space-y-4">
          <RelatorioCorte />
        </TabsContent>

        <TabsContent value="colaborador" className="space-y-4">
          <RelatorioColaborador />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
