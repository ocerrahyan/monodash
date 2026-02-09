import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import Dashboard from "@/pages/dashboard";
import EcuPage from "@/pages/ecu";
import VehiclePage from "@/pages/vehicle";
import ExportPage from "@/pages/export";
import { FloatingCommandPanel } from "@/components/FloatingCommandPanel";
import { sharedSim } from "@/lib/sharedSim";
import { type EcuConfig } from "@/lib/engineSim";
import { log } from "@shared/logger";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/ecu" component={EcuPage} />
      <Route path="/vehicle" component={VehiclePage} />
      <Route path="/export" component={ExportPage} />
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
      <Router />
      <FloatingCommandPanel
        ecuConfig={ecuConfig}
        onConfigChange={handleConfigChange}
      />
    </QueryClientProvider>
  );
}

export default App;
