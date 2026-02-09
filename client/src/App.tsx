import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "@/pages/dashboard";
import EcuPage from "@/pages/ecu";
import VehiclePage from "@/pages/vehicle";
import ExportPage from "@/pages/export";

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
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}

export default App;
