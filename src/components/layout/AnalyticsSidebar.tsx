import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Gauge,
  ShieldCheck,
  Package,
  ArrowRightLeft,
  DollarSign,
  AlertTriangle,
  LogOut,
  HelpCircle,
  LayoutGrid,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { openExternalUrl } from "@/lib/capacitor";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Gauge,
  ShieldCheck,
  Package,
  ArrowRightLeft,
  DollarSign,
  AlertTriangle,
};

const ANALYTICS_NAV = [
  { path: "/analytics", label: "Overview", icon: "LayoutDashboard" },
  { path: "/analytics/efficiency", label: "Efficiency", icon: "Gauge" },
  { path: "/analytics/quality", label: "Quality", icon: "ShieldCheck" },
  { path: "/analytics/orders", label: "Orders", icon: "Package" },
  { path: "/analytics/pipeline", label: "Pipeline", icon: "ArrowRightLeft" },
  { path: "/analytics/cost", label: "Cost", icon: "DollarSign" },
  { path: "/analytics/blockers", label: "Blockers", icon: "AlertTriangle" },
];

export function AnalyticsSidebar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const isActive = (path: string) => location.pathname === path;

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar
      className={cn(
        "border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
      style={{
        "--sidebar-gradient": "linear-gradient(180deg,#0a0f1a 0%,#0d1526 35%,#111d3a 65%,#14234a 100%)",
      } as React.CSSProperties}
      collapsible="icon"
    >
      <SidebarHeader className="border-b border-white/[0.08] p-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sidebar-foreground tracking-tight">
                Analytics
              </span>
              <span className="text-[11px] text-sidebar-foreground/40 truncate max-w-[140px]">
                Powered by WovenTex
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="custom-scrollbar">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/35 px-3">
              Analytics
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {ANALYTICS_NAV.map((item) => {
                const Icon = iconMap[item.icon];
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.path)}
                      tooltip={collapsed ? item.label : undefined}
                    >
                      <Link
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200",
                          isActive(item.path)
                            ? "bg-sidebar-primary/10 text-sidebar-foreground font-medium border-l-2 border-sidebar-primary shadow-[inset_0_0_12px_rgba(139,92,246,0.08)]"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                        )}
                      >
                        {Icon && <Icon className="h-5 w-5 shrink-0" />}
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("border-t border-white/[0.08]", collapsed ? "p-2" : "p-4")}>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "gap-3")}>
          <Avatar className={cn("shrink-0 ring-2 ring-sidebar-primary/20", collapsed ? "h-7 w-7" : "h-9 w-9")}>
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className={cn("bg-sidebar-primary/20 text-sidebar-primary font-semibold", collapsed ? "text-xs" : "text-sm")}>
              {profile ? getInitials(profile.full_name) : "?"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                {profile?.full_name}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/40">
                Admin
              </span>
            </div>
          )}
          {!collapsed && (
            <>
              <button
                onClick={() => navigate("/hub")}
                className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-all duration-200"
                title="Back to portals"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => openExternalUrl("https://productionportal.co")}
                className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-all duration-200"
                title="Help"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="shrink-0 h-7 w-7 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
