import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import Checkout from "./pages/Checkout";
import SemAcesso from "./pages/SemAcesso";
import Dashboard from "./pages/Dashboard";
import Produtos from "./pages/Produtos";
import Materiais from "./pages/Materiais";
import Producao from "./pages/Producao";
import Lotes from "./pages/Lotes";
import Colaboradores from "./pages/Colaboradores";
import Metas from "./pages/Metas";
import Configuracoes from "./pages/Configuracoes";
import Relatorios from "./pages/Relatorios";
import PrevisaoProducao from "./pages/PrevisaoProducao";
import AcompanhamentoPedidos from "./pages/AcompanhamentoPedidos";
import AcompanhamentoLanding from "./pages/AcompanhamentoLanding";
import AcompanhamentoColaboradores from "./pages/AcompanhamentoColaboradores";
import DesempenhoColaboradores from "./pages/DesempenhoColaboradores";
import Pop from "./pages/Pop";
import Etapa from "./pages/Etapa";
import VendasPerdidas from "./pages/VendasPerdidas";
import VendasPerdidasUsuario from "./pages/VendasPerdidasUsuario";
import VendasPerdidasMensal from "./pages/VendasPerdidasMensal";
import ProjecaoVendas from "./pages/ProjecaoVendas";
import ProjecaoUsuario from "./pages/ProjecaoUsuario";
import ProjecaoMensal from "./pages/ProjecaoMensal";
import Programacao from "./pages/Programacao";
import DetalhesLote from "./pages/DetalhesLote";
import LancamentoMateriais from "./pages/LancamentoMateriais";
import ListaLancamentoMateriais from "./pages/ListaLancamentoMateriais";

import GestaoUsuarios from "./pages/gestor/GestaoUsuarios";
import DashboardEmpresas from "./pages/super-admin/DashboardEmpresas";
import PerfilSuperAdmin from "./pages/super-admin/PerfilSuperAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/sem-acesso" element={<SemAcesso />} />

            <Route element={<Layout />}>
              <Route
                path="/"
                element={
                  <ProtectedRoute requiredPermission="dashboard">
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/produtos"
                element={
                  <ProtectedRoute requiredPermission="produtos">
                    <Produtos />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/materiais"
                element={
                  <ProtectedRoute requiredPermission="produtos">
                    <Materiais />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/vendas-perdidas"
                element={
                  <ProtectedRoute requiredPermission="pedidos">
                    <VendasPerdidas />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/vendas-perdidas/:usuarioId"
                element={
                  <ProtectedRoute requiredPermission="pedidos">
                    <VendasPerdidasUsuario />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/vendas-perdidas/:usuarioId/:mes"
                element={
                  <ProtectedRoute requiredPermission="pedidos">
                    <VendasPerdidasMensal />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/programacao"
                element={
                  <ProtectedRoute requiredPermission="producao">
                    <Programacao />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/producao"
                element={
                  <ProtectedRoute requiredPermission="producao">
                    <Producao />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/lotes"
                element={
                  <ProtectedRoute requiredPermission="lotes">
                    <Lotes />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/lotes/:id"
                element={
                  <ProtectedRoute requiredPermission="lotes">
                    <DetalhesLote />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/lancamento-mp"
                element={
                  <ProtectedRoute requiredPermission="lotes">
                    <ListaLancamentoMateriais />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/lotes/:id/materiais"
                element={
                  <ProtectedRoute requiredPermission="lotes">
                    <LancamentoMateriais />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/colaboradores"
                element={
                  <ProtectedRoute requiredPermission="colaboradores">
                    <Colaboradores />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/metas"
                element={
                  <ProtectedRoute requiredPermission="metas">
                    <Metas />
                  </ProtectedRoute>
                }
              />




              <Route
                path="/acompanhamento-colaboradores"
                element={
                  <ProtectedRoute requiredPermission="pedidos">
                    <AcompanhamentoColaboradores />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/desempenho"
                element={
                  <ProtectedRoute requiredPermission="colaboradores">
                    <DesempenhoColaboradores />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/previsao-producao"
                element={
                  <ProtectedRoute requiredPermission="previsao_producao">
                    <PrevisaoProducao />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/projecao-vendas"
                element={
                  <ProtectedRoute requiredPermission="pedidos">
                    <ProjecaoVendas />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/projecao-vendas/:usuarioId"
                element={
                  <ProtectedRoute requiredPermission="pedidos">
                    <ProjecaoUsuario />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/projecao-vendas/:usuarioId/:mes"
                element={
                  <ProtectedRoute requiredPermission="pedidos">
                    <ProjecaoMensal />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/pop"
                element={
                  <ProtectedRoute requiredPermission="pop">
                    <Pop />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/etapas"
                element={
                  <ProtectedRoute requiredPermission="etapas">
                    <Etapa />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute gestorOnly>
                    <Configuracoes />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/gestao-usuarios"
                element={
                  <ProtectedRoute gestorOnly>
                    <GestaoUsuarios />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/super-admin"
                element={
                  <ProtectedRoute superAdminOnly>
                    <DashboardEmpresas />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/super-admin/perfil"
                element={
                  <ProtectedRoute superAdminOnly>
                    <PerfilSuperAdmin />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
