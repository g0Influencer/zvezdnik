import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef, useState, type ComponentType } from "react";
import { tg } from "@/lib/telegram";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { trackPageview, reachGoal } from "@/lib/metrika";
import { PENDING_PAYMENT_KEY } from "@/lib/checkout";
import Welcome from "./pages/Welcome";

// Wraps lazy() so a failed chunk load (stale cached index after a redeploy)
// reloads the page once to fetch the fresh bundle instead of rendering blank.
function lazyWithReload(importer: () => Promise<{ default: ComponentType }>) {
  return lazy(() =>
    importer().catch((err) => {
      try {
        if (!sessionStorage.getItem("chunk-reload")) {
          sessionStorage.setItem("chunk-reload", "1");
          window.location.reload();
          return new Promise<{ default: ComponentType }>(() => {});
        }
      } catch { /* noop */ }
      throw err;
    })
  );
}

const Onboarding = lazyWithReload(() => import("./pages/Onboarding"));
const Today = lazyWithReload(() => import("./pages/Today"));
const Profile = lazyWithReload(() => import("./pages/Profile"));
const Chart = lazyWithReload(() => import("./pages/Chart"));
const Void = lazyWithReload(() => import("./pages/Void"));
const Compatibility = lazyWithReload(() => import("./pages/Compatibility"));
const Longreads = lazyWithReload(() => import("./pages/Longreads"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Sends an SPA "hit" to Metrika on every route change. The initial pageview is
// already counted by the counter init, so the first render is skipped.
function MetrikaTracker() {
  const location = useLocation();
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

function AppRoutes() {
  const { isOnboarded, setOnboarded } = useAppStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    api.getProfile()
      .then((profile) => {
        useAppStore.getState().setUser(profile);
        setOnboarded(true);
        // Pending-payment flag + PRO now active = the checkout the user left
        // for has completed; count the subscription exactly once.
        try {
          if (profile.pro_status === 'active' && localStorage.getItem(PENDING_PAYMENT_KEY)) {
            localStorage.removeItem(PENDING_PAYMENT_KEY);
            reachGoal('subscription_activated');
          }
        } catch { /* noop */ }
      })
      .catch((err: Error & { code?: string }) => {
        if (err.code === 'NOT_FOUND' || err.code === 'UNAUTHORIZED' || err.code === 'ONBOARDING_REQUIRED') {
          setOnboarded(false);
        }
      })
      .finally(() => setAuthChecked(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authChecked) return null;

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={isOnboarded ? <Navigate to="/today" replace /> : <Welcome />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/today" element={isOnboarded ? <Today /> : <Navigate to="/" replace />} />
        <Route path="/profile" element={isOnboarded ? <Profile /> : <Navigate to="/" replace />} />
        <Route path="/chart" element={isOnboarded ? <Chart /> : <Navigate to="/" replace />} />
        <Route path="/void" element={isOnboarded ? <Void /> : <Navigate to="/" replace />} />
        <Route path="/compatibility" element={isOnboarded ? <Compatibility /> : <Navigate to="/" replace />} />
        <Route path="/longreads" element={isOnboarded ? <Longreads /> : <Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => {
  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <MetrikaTracker />
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
