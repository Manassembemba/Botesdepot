import React, { createContext, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Stock from "./pages/Stock";
import ProductForm from "./pages/ProductForm";
import StockEntryForm from "./pages/StockEntryForm";
import Caisse from "./pages/Caisse";
import Historique from "./pages/Historique";
import Rapports from "./pages/Rapports";
import Users from "./pages/Users";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";

const queryClient = new QueryClient();

// AuthContext pour gérer l'état global
export const AuthContext = createContext({
  selectedSiteId: "all-sites",
  setSelectedSiteId: (siteId: string) => {}
});

const App = () => {
  const [selectedSiteId, setSelectedSiteId] = useState("all-sites");

  return (
    <AuthContext.Provider value={{ selectedSiteId, setSelectedSiteId }}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/stock" element={<Stock />} />
                <Route path="/stock/nouveau" element={<ProductForm />} />
                <Route path="/stock/entree" element={<StockEntryForm />} />
                <Route path="/caisse" element={<Caisse />} />
                <Route path="/historique" element={<Historique />} />
                <Route path="/rapports" element={<Rapports />} />
                <Route path="/utilisateurs" element={<Users />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </AuthContext.Provider>
  );
};

export default App;