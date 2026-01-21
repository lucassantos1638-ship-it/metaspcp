import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ConfiguracoesEmpresa from "@/components/configuracoes/ConfiguracoesEmpresa";
import ControlePlano from "@/components/configuracoes/ControlePlano";
import GerenciarColaboradores from "@/components/configuracoes/GerenciarColaboradores";
import ExclusaoLotes from "@/components/configuracoes/ExclusaoLotes";
import ExclusaoPedidos from "@/components/configuracoes/ExclusaoPedidos";
import { ConfiguracoesDashboard } from "@/components/configuracoes/ConfiguracoesDashboard";
import GerenciarPOP from "@/components/configuracoes/GerenciarPOP";
import GerenciarUsuarios from "@/components/configuracoes/GerenciarUsuarios";

const Configuracoes = () => {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur pb-4 pt-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-border/40">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">Configurações</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Gerencie todas as configurações do sistema
        </p>
      </div>

      <Tabs defaultValue="empresa" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="plano">Plano</TabsTrigger>
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="pop">P.O.P</TabsTrigger>
          <TabsTrigger value="exclusoes">Exclusões</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
          <ConfiguracoesEmpresa />
        </TabsContent>

        <TabsContent value="dashboard">
          <ConfiguracoesDashboard />
        </TabsContent>

        <TabsContent value="usuarios">
          <GerenciarUsuarios />
        </TabsContent>

        <TabsContent value="plano">
          <ControlePlano />
        </TabsContent>

        <TabsContent value="colaboradores">
          <GerenciarColaboradores />
        </TabsContent>

        <TabsContent value="pop">
          <GerenciarPOP />
        </TabsContent>

        <TabsContent value="exclusoes">
          <Card>
            <CardHeader>
              <CardTitle>Exclusões e Limpeza</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ExclusaoLotes />
              <Separator />
              <ExclusaoPedidos />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};



export default Configuracoes;
