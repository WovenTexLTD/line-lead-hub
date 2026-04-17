import { useEffect } from "react";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AnalyticsSidebar } from "./AnalyticsSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, RefreshCw, AlertTriangle, LayoutGrid, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function PageErrorFallback() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        This page crashed unexpectedly. You can reload or go back to the overview.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate("/analytics")}>
          <Home className="h-4 w-4 mr-2" />
          Overview
        </Button>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload Page
        </Button>
      </div>
    </div>
  );
}

export function AnalyticsLayout() {
  const { user, loading, factory, isAdminOrHigher } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", "#f1f3f5");
    return () => {
      meta?.setAttribute("content", "#0f172a");
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider defaultOpen={true} className="w-full min-h-[100dvh] overflow-x-hidden bg-background">
      <div className="flex w-full flex-col overflow-x-hidden bg-background" style={{ minHeight: "100dvh" }}>
        {/* Safe-area top */}
        <div className="w-full bg-background" style={{ height: "env(safe-area-inset-top, 0px)" }} aria-hidden="true" />

        <div className="flex flex-1 min-w-0 overflow-x-hidden">
          <AnalyticsSidebar />
          <div className="flex flex-1 min-w-0 flex-col overflow-x-hidden">
            {/* Header */}
            <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
              <SidebarTrigger className="lg:hidden" />
              <div className="flex-1" />
              <NetworkStatusIndicator />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/hub")}
                title="Back to portals"
              >
                <LayoutGrid className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.reload()}
                title="Refresh page"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              {factory && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
                  <span className="text-muted-foreground">Factory:</span>
                  <span className="font-medium">{factory.name}</span>
                </div>
              )}
            </header>

            {/* Main content */}
            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-background">
              <div className="w-full px-4 md:px-6 pb-6">
                <ErrorBoundary key={location.pathname} fallback={<PageErrorFallback />}>
                  <Outlet />
                </ErrorBoundary>
              </div>
            </main>
          </div>
        </div>

        {/* Safe-area bottom */}
        <div className="w-full bg-background" style={{ height: "env(safe-area-inset-bottom, 0px)" }} aria-hidden="true" />
      </div>
    </SidebarProvider>
  );
}
