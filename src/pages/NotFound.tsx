import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg text-center">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
              <Package className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary">Botes Depot</CardTitle>
          </div>
          <div className="space-y-2">
            <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
            <CardTitle className="text-xl">Page introuvable</CardTitle>
            <p className="text-muted-foreground">
              La page que vous cherchez n'existe pas ou a été déplacée.
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-md">
            {location.pathname}
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                Retour au tableau de bord
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/stock">
                Consulter le stock
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
