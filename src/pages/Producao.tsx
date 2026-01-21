import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import FormularioIniciarAtividade from "@/components/producao/FormularioIniciarAtividade";
import ListaAtividadesEmAberto from "@/components/producao/ListaAtividadesEmAberto";

const Producao = () => {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
          Lançar Produção
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Sistema Start/Stop: Inicie e finalize atividades de produção
        </p>
      </div>

      {/* Seção 1: Iniciar Nova Atividade */}
      <Card>
        <CardHeader>
          <CardTitle>Iniciar Nova Atividade</CardTitle>
          <CardDescription>
            Registre o início de uma nova atividade de produção
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioIniciarAtividade />
        </CardContent>
      </Card>

      <Separator />

      {/* Seção 2: Atividades em Aberto */}
      <Card>
        <CardHeader>
          <CardTitle>Atividades em Aberto</CardTitle>
          <CardDescription>
            Atividades iniciadas que ainda não foram finalizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListaAtividadesEmAberto />
        </CardContent>
      </Card>
    </div>
  );
};

export default Producao;
