import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import { useAppVersion } from "@/hooks/useAppVersion";

// Lazy load todos os componentes pesados para reduzir bundle inicial
const Calculator = lazy(() => import("./pages/Calculator"));
const Settings = lazy(() => import("./pages/Settings"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"}>
        <Suspense fallback={<PageFallback />}>
          <Calculator />
        </Suspense>
      </Route>
      <Route path={"/settings"}>
        <Suspense fallback={<PageFallback />}>
          <Settings />
        </Suspense>
      </Route>
      <Route path={"/dashboard"}>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Verificar automaticamente se há atualizações do aplicativo
  useAppVersion();

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
