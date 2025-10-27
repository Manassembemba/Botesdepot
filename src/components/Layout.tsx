import React from "react";
import Sidebar from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(true); // Masqué par défaut

  // Synchroniser l'état collapsed avec les changements d'écran
  useEffect(() => {
    setIsCollapsed(isMobile);
  }, [isMobile]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar unique qui gère desktop/mobile */}
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      {/* Main Content */}
      <main className="flex-1 relative">
        {/* Mobile Menu Button - seulement sur mobile quand sidebar fermée */}
        {isMobile && isCollapsed && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsCollapsed(false)}
            className="fixed top-4 left-4 z-50 shadow-lg"
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Ouvrir le menu</span>
          </Button>
        )}

        {/* Mobile Overlay - seulement sur mobile quand sidebar ouverte */}
        {isMobile && !isCollapsed && (
          <div
            className="fixed inset-0 bg-black/50 z-30"
            onClick={() => setIsCollapsed(true)}
          />
        )}

        {children || <Outlet />}
      </main>
    </div>
  );
};

export default Layout;