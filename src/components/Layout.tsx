import { Link, useLocation, Outlet } from "react-router-dom";
import { ClipboardCheck, Package, Target, BarChart3, Users, Settings, FileText, Menu, Box, TrendingUp, Activity, LogOut, Shield, KeyRound, UserCog, BookOpen, Layers, LayoutDashboard, Factory, ScrollText, ClipboardList, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import logoMetaPCP from '@/assets/logo-metapcp.png';

const Layout = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false); // Restored for mobile menu
  const { user, isGestor, temPermissao, logout } = useAuth();
  const allNavItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard", permission: "dashboard" },
    { path: "/producao", icon: Factory, label: "Lançar Produção", permission: "producao" },
    { path: "/lotes", icon: Package, label: "Lotes", permission: "lotes" },
    { path: "/acompanhamento-colaboradores", icon: ClipboardList, label: "Monitoramento", permission: "pedidos" },
    { path: "/produtos", icon: Box, label: "Produtos", permission: "produtos" },
    { path: "/metas", icon: Target, label: "Metas", permission: "metas" },
    { path: "/etapas", icon: Layers, label: "Etapas", permission: "etapas" },
    { path: "/desempenho", icon: TrendingUp, label: "Desempenho", permission: "colaboradores" },
    { path: "/previsao-producao", icon: Calculator, label: "Previsão", permission: "previsao_producao" },
    { path: "/pop", icon: ScrollText, label: "P.O.P", permission: "pop" },
  ];

  // Main Nav Items
  const navItems = user?.role === 'super_admin'
    ? allNavItems
    : isGestor
      ? allNavItems
      : allNavItems.filter(item => temPermissao(item.permission));



  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile Header - Fixed at top for mobile */}
      <div className="lg:hidden print:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-40 flex items-center px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-card border-r border-border flex flex-col h-full">
            {/* Mobile Sidebar Header */}
            <div className="h-20 flex-none flex items-center justify-center px-4 border-b border-border bg-card">
              <div className="flex items-center justify-center">
                <img src={logoMetaPCP} alt="Meta PCP" className="h-16 w-auto" />
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 flex flex-col">
              {/* User Info Section */}
              <div className="p-4 border-b border-border flex-none">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-foreground uppercase text-xs tracking-wider line-clamp-1" title={`${user?.nome || ''} | ${user?.username || ''} | ${user?.email || ''}`}>
                    {user?.nome || user?.username || user?.email || 'USUÁRIO'}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold uppercase leading-tight whitespace-normal break-words">
                    {user?.empresa_nome || '001 - META INDÚSTRIA'}
                  </span>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 py-2 px-2 space-y-0.5">
                <nav className="flex-1 py-2 px-2 space-y-0.5">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded transition-colors group",
                          location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
                            ? "text-primary-foreground bg-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn("w-4 h-4 transition-opacity", location.pathname === item.path ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
                          <span className="text-xs font-medium">{item.label}</span>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("opacity-0 group-hover:opacity-50", location.pathname === item.path && "text-primary-foreground opacity-50")}><path d="m9 18 6-6-6-6" /></svg>
                      </Link>
                    );
                  })}
                </nav>
              </nav>

              {/* Bottom Actions (Collapsible Menu) */}
              <div className="border-t border-border bg-card mt-auto flex-none flex flex-col">
                {temPermissao('configuracoes') && (
                  <Link
                    to="/configuracoes"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-xs font-medium">Configurações</span>
                  </Link>
                )}

                <button onClick={() => { logout(); setOpen(false); }} className="w-full flex items-center justify-between px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left border-t border-border">
                  <div className="flex items-center gap-3">
                    <LogOut className="w-4 h-4" />
                    <span className="text-xs font-medium">Sair</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>

              {/* Extra space at bottom */}
              <div className="h-16 flex-none"></div>
            </div>
          </SheetContent>
        </Sheet>
        <h1 className="ml-3 text-lg font-bold text-primary">Meta PCP</h1>
      </div>

      {/* Desktop Sidebar - Fixed Height within Flex Container */}
      <aside className="hidden print:hidden lg:flex lg:flex-col w-64 bg-card border-r border-border font-sans text-sm h-full flex-none">
        {/* Header - Logo area acting as Title (Fixed) */}
        <div className="h-20 flex-none flex items-center justify-center px-4 border-b border-border bg-card z-10">
          <div className="flex items-center justify-center">
            <img src={logoMetaPCP} alt="Meta PCP" className="h-16 w-auto" />
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 flex flex-col">
          {/* User Info Section */}
          <div className="p-4 border-b border-border flex-none">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-foreground uppercase text-xs tracking-wider line-clamp-1" title={`${user?.nome || ''} | ${user?.username || ''} | ${user?.email || ''}`}>
                {user?.nome || user?.username || user?.email || 'USUÁRIO'}
              </span>
              <span className="text-xs text-muted-foreground font-semibold uppercase leading-tight whitespace-normal break-words">
                {user?.empresa_nome || '001 - META INDÚSTRIA'}
              </span>
            </div>
          </div>

          {/* Navigation (Takes available space, pushes bottom actions down) */}
          <nav className="flex-1 py-2 px-2 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded transition-colors group",
                    isActive
                      ? "text-primary-foreground bg-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("w-4 h-4 transition-opacity", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                  {/* Chevron Right (mock) */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("opacity-0 group-hover:opacity-50", isActive && "text-primary-foreground opacity-50")}><path d="m9 18 6-6-6-6" /></svg>
                </Link>
              );
            })}
          </nav>

          {/* Bottom Actions (Collapsible Menu) */}
          <div className="border-t border-border bg-card mt-auto flex-none flex flex-col">

            {temPermissao('configuracoes') && (
              <Link
                to="/configuracoes"
                className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
              >
                <Settings className="w-4 h-4" />
                <span className="text-xs font-medium">Configurações</span>
              </Link>
            )}

            <button onClick={logout} className="w-full flex items-center justify-between px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left border-t border-border">
              <div className="flex items-center gap-3">
                <LogOut className="w-4 h-4" />
                <span className="text-xs font-medium">Sair</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 flex flex-col h-full overflow-hidden pt-16 lg:pt-0">
        <div className="flex-1 overflow-y-auto w-full">
          <div className="p-4 sm:p-6 lg:p-8 min-h-full">
            <TrialBanner />
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
