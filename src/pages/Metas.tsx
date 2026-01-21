import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CadastroMetaDialog from "@/components/metas/CadastroMetaDialog";
import ListaMetas from "@/components/metas/ListaMetas";
import ListaResumidaMetas from "@/components/metas/ListaResumidaMetas";
import ListaProgressoMetas from "@/components/metas/ListaProgressoMetas";

const Metas = () => {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">Metas</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Gerencie metas mensais e acompanhe o desempenho dos colaboradores
        </p>
      </div>

      <Tabs defaultValue="acompanhamento" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="acompanhamento" className="py-2">Acompanhamento</TabsTrigger>
          <TabsTrigger value="detalhes" className="py-2">Detalhes</TabsTrigger>
          <TabsTrigger value="configuracao" className="py-2">Gerenciar Metas</TabsTrigger>
        </TabsList>

        <TabsContent value="acompanhamento" className="space-y-4">
          <ListaResumidaMetas />
        </TabsContent>

        <TabsContent value="detalhes" className="space-y-4">
          <ListaProgressoMetas />
        </TabsContent>

        <TabsContent value="configuracao" className="space-y-6">
          <div className="flex justify-end">
            <CadastroMetaDialog />
          </div>
          <ListaMetas />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Metas;
