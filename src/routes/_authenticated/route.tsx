import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Building2,
  Landmark,
  LayoutDashboard,
  LogOut,
  Settings,
  Target,
  Wallet,
  Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: owner, error } = await supabase.rpc("claim_ownership");
    return { user: data.user, isOwner: !error && owner === true };
  },
  component: Layout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { to: "/contas", label: "Contas", icon: Wallet },
  { to: "/patrimonio", label: "Patrimônio", icon: Building2 },
  { to: "/consorcios", label: "Consórcios", icon: Layers },
  { to: "/planejamento", label: "Planejamento", icon: Target },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function Layout() {
  const { isOwner, user } = Route.useRouteContext();
  const signOut = useSignOut();
  const { pathname } = useLocation();

  if (!isOwner) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="card-surface max-w-md p-8 text-center" role="alert">
          <h1 className="text-2xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este sistema é de uso exclusivo do proprietário. A conta {user.email} não tem acesso.
          </p>
          <Button className="mt-6" variant="outline" onClick={signOut}>
            Sair
          </Button>
        </div>
      </main>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-4 py-5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Landmark className="size-5 shrink-0 text-gold" aria-hidden />
            <span className="font-display text-xl font-semibold tracking-wide group-data-[collapsible=icon]:hidden">
              Rhema Capital
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu aria-label="Navegação principal">
                {NAV.map((item) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className="data-[active=true]:text-gold data-[active=true]:shadow-[inset_2px_0_0_var(--gold)]"
                      >
                        <Link to={item.to} aria-current={active ? "page" : undefined}>
                          <item.icon aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut} tooltip="Sair">
                <LogOut aria-hidden />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger aria-label="Abrir ou recolher menu" />
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
