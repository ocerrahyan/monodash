import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { AuthProvider } from "@/lib/auth";
import Dashboard from "@/pages/dashboard";
import EcuPage from "@/pages/ecu";
import VehiclePage from "@/pages/vehicle";
import ExportPage from "@/pages/export";
import AuthPage from "@/pages/auth";
import FriendsPage from "@/pages/friends";
import RacePage from "@/pages/race";
import AdminPage from "@/pages/admin";
import SetupPage from "@/pages/setup";
import AnalyzePage from "@/pages/analyze";
import DynoPage from "@/pages/dyno";
import SocialPage from "@/pages/social";
import EngineBuilderPage from "@/pages/engine-builder";
import { FloatingCommandPanel } from "@/components/FloatingCommandPanel";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { sharedSim } from "@/lib/sharedSim";
import { type EcuConfig } from "@/lib/engineSim";
import { log } from "@shared/logger";
import { ThemeProvider } from "@/lib/theme";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/setup" component={SetupPage} />
      <Route path="/analyze" component={AnalyzePage} />
      <Route path="/dyno" component={DynoPage} />
      <Route path="/social" component={SocialPage} />
      <Route path="/ecu" component={EcuPage} />
      <Route path="/vehicle" component={VehiclePage} />
      <Route path="/export" component={ExportPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/friends" component={FriendsPage} />
      <Route path="/race/:id" component={RacePage} />
      <Route path="/builder" component={EngineBuilderPage} />
      <Route path="/admin" component={AdminPage} />
    </Switch>
  );
}

function App() {
  const [ecuConfig, setEcuConfigState] = useState<EcuConfig>(() => sharedSim.getEcuConfig());

  const handleConfigChange = useCallback((newConfig: EcuConfig) => {
    log.info('app', 'ECU config updated via command panel');
    sharedSim.setEcuConfig(newConfig);
    setEcuConfigState(newConfig);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
          <ThemeProvider>
            <Router />
            <FloatingCommandPanel
              ecuConfig={ecuConfig}
              onConfigChange={handleConfigChange}
            />
            <ConnectionStatus pollInterval={15000} failureThreshold={2} />
          </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
