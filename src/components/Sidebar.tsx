import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Clock,
  BarChart3,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/use-user-role";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { role } = useUserRole();

  // Définir tous les éléments de navigation
  const allNavItems = [
    { path: "/dashboard", label: "Tableau de bord", icon: <LayoutDashboard className="h-5 w-5" />, allowedRoles: ["admin", "magasinier", "client"], shortcut: "Alt+D" },
    { path: "/stock", label: "Stock", icon: <Package className="h-5 w-5" />, allowedRoles: ["admin"], shortcut: "Alt+S" },
    { path: "/caisse", label: "Caisse", icon: <ShoppingCart className="h-5 w-5" />, allowedRoles: ["admin", "magasinier", "client"], shortcut: "Alt+C" },
    { path: "/historique", label: "Historique", icon: <Clock className="h-5 w-5" />, allowedRoles: ["admin", "magasinier", "client"], shortcut: "Alt+H" },
    { path: "/rapports", label: "Rapports", icon: <BarChart3 className="h-5 w-5" />, allowedRoles: ["admin"], shortcut: "Alt+R" },
    { path: "/utilisateurs", label: "Utilisateurs", icon: <Users className="h-5 w-5" />, allowedRoles: ["admin"], shortcut: "Alt+U" },
  ];

  // Filtrer les éléments de navigation en fonction du rôle
  const navItems = allNavItems.filter(item => {
    if (!role) return false;
    return item.allowedRoles.includes(role);
  });

  // Raccourcis clavier pour navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle sidebar avec Ctrl+B (seulement sur desktop)
      if (event.ctrlKey && event.key === 'b' && !isMobile) {
        event.preventDefault();
        setIsCollapsed(!isCollapsed);
        return;
      }

      // Navigation avec Alt + touche
      if (event.altKey) {
        const item = navItems.find(item =>
          item.shortcut === `Alt+${event.key.toUpperCase()}`
        );
        if (item) {
          event.preventDefault();
          navigate(item.path);
          if (isMobile) setIsCollapsed(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCollapsed, isMobile, navItems, navigate, setIsCollapsed]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt!",
      });
      navigate("/login");
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la déconnexion",
        variant: "destructive",
      });
    }
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <aside className={cn(
      "h-screen bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out",
      isMobile
        ? (isCollapsed ? "w-0 overflow-hidden" : "w-80 z-40")
        : (isCollapsed ? "w-16" : "w-60")
    )}>
      {/* Logo et Toggle */}
      <div className={cn(
        "p-6 border-b border-border flex items-center transition-all duration-300",
        isCollapsed && !isMobile ? "justify-center px-2" : "justify-between"
      )}>
        {(!isCollapsed || isMobile) && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary">Botes Depot</span>
          </div>
        )}

        {isCollapsed && !isMobile && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
        )}

        {/* Bouton toggle - seulement sur desktop */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn(
              "text-muted-foreground hover:text-foreground transition-all duration-200",
              isCollapsed ? "rotate-180" : ""
            )}
            title={`Toggle sidebar (${isCollapsed ? 'Expand' : 'Collapse'}) - Ctrl+B`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Bouton close - seulement sur mobile quand ouvert */}
        {isMobile && !isCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 p-4 space-y-1 overflow-y-auto transition-all duration-300",
        (isCollapsed && !isMobile) ? "px-2" : ""
      )}>
        {navItems.map((item, index) => (
          <Button
            key={item.path}
            variant="ghost"
            className={cn(
              "w-full h-11 transition-all duration-200",
              (isCollapsed && !isMobile) ? "justify-center px-2" : "justify-start",
              location.pathname === item.path
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            onClick={() => {
              navigate(item.path);
              if (isMobile) setIsCollapsed(true);
            }}
            title={isCollapsed && !isMobile ? `${item.label} (${item.shortcut})` : `${item.label} (${item.shortcut})`}
          >
            <span className={cn(
              "transition-all duration-200",
              (isCollapsed && !isMobile) ? "" : "mr-3"
            )}>
              {item.icon}
            </span>
            {(!isCollapsed || isMobile) && (
              <span className="transition-all duration-200">
                {item.label}
              </span>
            )}
            {(!isCollapsed || isMobile) && (
              <span className="ml-auto text-xs text-muted-foreground opacity-60">
                {item.shortcut}
              </span>
            )}
          </Button>
        ))}
      </nav>

      {/* Logout */}
      <div className={cn(
        "p-4 border-t border-border transition-all duration-300",
        (isCollapsed && !isMobile) ? "px-2" : ""
      )}>
        <Button
          variant="ghost"
          className={cn(
            "w-full h-11 transition-all duration-200",
            (isCollapsed && !isMobile) ? "justify-center px-2" : "justify-start",
            "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          onClick={handleLogout}
          title={(isCollapsed && !isMobile) ? "Déconnexion (Alt+L)" : "Déconnexion (Alt+L)"}
        >
          <span className={cn(
            "transition-all duration-200",
            (isCollapsed && !isMobile) ? "" : "mr-3"
          )}>
            <LogOut className="h-5 w-5" />
          </span>
          {(!isCollapsed || isMobile) && (
            <span className="transition-all duration-200">
              Déconnexion
            </span>
          )}
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
