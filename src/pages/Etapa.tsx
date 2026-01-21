import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GerenciarEtapas from "@/components/configuracoes/GerenciarEtapas";
import GerenciarSubetapas from "@/components/configuracoes/GerenciarSubetapas";

const Etapa = () => {
    return (
        <div className="space-y-6 sm:space-y-8">
            <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">Etapas e Sub-etapas</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Gerencie as etapas e sub-etapas de produção
                </p>
            </div>

            <Tabs defaultValue="etapa" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="etapa">Etapa</TabsTrigger>
                    <TabsTrigger value="subetapa">Sub-etapa</TabsTrigger>
                </TabsList>

                <TabsContent value="etapa">
                    <GerenciarEtapas />
                </TabsContent>

                <TabsContent value="subetapa">
                    <GerenciarSubetapas />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Etapa;
