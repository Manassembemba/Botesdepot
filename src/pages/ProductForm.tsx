import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ProductForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      }
    };
    checkAuth();
  }, [navigate]);

  const [formData, setFormData] = useState({
    name: "",
    bottles_per_case: 12,
    cost_full_case: "",
    price_full_case: "",
    is_active: true,
  });

  // Calcul automatique des prix à partir de la caisse complète
  const calculatePrices = () => {
    // Calcul prix d'achat
    const costPerBottle = formData.cost_full_case 
      ? (parseFloat(formData.cost_full_case) / formData.bottles_per_case).toFixed(2)
      : "0.00";
    const costHalfCase = formData.cost_full_case
      ? (parseFloat(formData.cost_full_case) / 2).toFixed(2)
      : "0.00";
    
    // Calcul prix de vente - le prix par bouteille sera inséré dans la DB
    // Les colonnes price_half_case et price_full_case sont auto-générées par PostgreSQL
    const pricePerBottle = formData.price_full_case
      ? (parseFloat(formData.price_full_case) / formData.bottles_per_case).toFixed(2)
      : "0.00";
    const priceHalfCase = formData.price_full_case
      ? (parseFloat(formData.price_full_case) / 2).toFixed(2)
      : "0.00";

    return {
      costPerBottle,
      costHalfCase,
      pricePerBottle,
      priceHalfCase
    };
  };

  const calculatedPrices = calculatePrices();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Note: price_half_case et price_full_case sont des colonnes générées automatiquement
      // par PostgreSQL, donc on ne les insère pas manuellement
      const { error } = await supabase.from("products").insert({
        name: formData.name,
        bottles_per_case: formData.bottles_per_case,
        cost_per_bottle: formData.cost_full_case ? parseFloat(calculatedPrices.costPerBottle) : null,
        cost_half_case: formData.cost_full_case ? parseFloat(calculatedPrices.costHalfCase) : null,
        cost_full_case: formData.cost_full_case ? parseFloat(formData.cost_full_case) : null,
        price_per_bottle: parseFloat(calculatedPrices.pricePerBottle),
        // price_half_case et price_full_case sont auto-calculés par la DB
        is_active: formData.is_active,
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Produit ajouté avec succès",
      });
      navigate("/stock");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="px-8 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/stock")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Ajouter un produit</h1>
            <p className="text-muted-foreground mt-1">Configurez les prix et les casiers</p>
          </div>
        </div>
      </header>

      <div className="p-8">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Informations générales */}
            <Card>
              <CardHeader>
                <CardTitle>Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom du produit *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bottles_per_case">Bouteilles par caisse *</Label>
                  <Select
                    value={formData.bottles_per_case.toString()}
                    onValueChange={(value) => setFormData({ ...formData, bottles_per_case: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12 bouteilles</SelectItem>
                      <SelectItem value="20">20 bouteilles</SelectItem>
                      <SelectItem value="24">24 bouteilles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Produit actif</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Prix d'achat */}
            <Card>
              <CardHeader>
                <CardTitle>Prix d'achat (Coût)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cost_full_case">Prix d'achat caisse complète *</Label>
                  <Input
                    id="cost_full_case"
                    type="number"
                    step="0.01"
                    value={formData.cost_full_case}
                    onChange={(e) => setFormData({ ...formData, cost_full_case: e.target.value })}
                    placeholder="0.00 FC"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.bottles_per_case} bouteilles
                  </p>
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium">Calculs automatiques:</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prix par bouteille:</span>
                    <span className="font-medium">{calculatedPrices.costPerBottle} FC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prix demi-caisse ({formData.bottles_per_case / 2} btl):</span>
                    <span className="font-medium">{calculatedPrices.costHalfCase} FC</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prix de vente */}
            <Card>
              <CardHeader>
                <CardTitle>Prix de vente *</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="price_full_case">Prix de vente caisse complète *</Label>
                  <Input
                    id="price_full_case"
                    type="number"
                    step="0.01"
                    value={formData.price_full_case}
                    onChange={(e) => setFormData({ ...formData, price_full_case: e.target.value })}
                    placeholder="0.00 FC"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.bottles_per_case} bouteilles
                  </p>
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium">Calculs automatiques:</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prix par bouteille:</span>
                    <span className="font-medium">{calculatedPrices.pricePerBottle} FC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prix demi-caisse ({formData.bottles_per_case / 2} btl):</span>
                    <span className="font-medium">{calculatedPrices.priceHalfCase} FC</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex gap-4">
            <Button type="submit" disabled={isLoading} className="flex-1 max-w-xs">
              {isLoading ? "Enregistrement..." : "Enregistrer le produit"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/stock")}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ProductForm;
