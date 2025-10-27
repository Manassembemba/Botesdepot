import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const StockEntryForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedLocker, setSelectedLocker] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState({
    product_id: "",
    locker_id: "",
    qty_bottles: "",
    unit_type: "bottle", // 'bottle' or 'case'
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      }
    };
    checkAuth();
    fetchProducts();
  }, [navigate]);

  useEffect(() => {
    const findProductLocker = () => {
      if (formData.product_id) {
        const product = products.find(p => p.id.toString() === formData.product_id);
        if (product && product.locker_stock && product.locker_stock.length > 0) {
          const locker = product.locker_stock[0].lockers;
          if (locker) {
            setFormData(prev => ({ ...prev, locker_id: locker.id.toString() }));
            setSelectedLocker(locker);
          } else {
            setFormData(prev => ({ ...prev, locker_id: "" }));
            setSelectedLocker(null);
          }
        } else {
            setFormData(prev => ({ ...prev, locker_id: "" }));
            setSelectedLocker(null);
        }
      }
    };

    findProductLocker();
  }, [formData.product_id, products]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          bottles_per_case,
          locker_stock ( lockers ( id, name ) )
        `)
        .eq("is_active", true);
      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Find the locker ID directly from the selected product to ensure data is fresh
      const selectedProduct = products.find(p => p.id.toString() === formData.product_id);
      const locker = selectedProduct?.locker_stock?.[0]?.lockers;
      const currentLockerId = locker?.id?.toString();

      if (!formData.product_id || !currentLockerId || !formData.qty_bottles || parseInt(formData.qty_bottles) <= 0) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez vous assurer que tous les champs sont remplis et valides.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erreur",
          description: "Impossible de trouver l'utilisateur. Veuillez vous reconnecter.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!selectedProduct) {
        toast({ title: "Erreur", description: "Produit non trouvé.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      let qtyInBottles = parseInt(formData.qty_bottles);
      if (formData.unit_type === 'case') {
        qtyInBottles = parseInt(formData.qty_bottles) * selectedProduct.bottles_per_case;
      }

      const insertData = {
        product_id: parseInt(formData.product_id),
        locker_id: parseInt(currentLockerId),
        qty_bottles: qtyInBottles,
        received_by: user.id,
      };

      const { error } = await supabase.from("stock_entries").insert(insertData);

      if (error) throw error;

      const qtyText = formData.unit_type === 'case' ? `${formData.qty_bottles} casiers (${qtyInBottles} bouteilles)` : `${formData.qty_bottles} bouteilles`;

      toast({
        title: "Succès",
        description: `Entrée de stock enregistrée: ${qtyText}`,
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
      <header className="border-b border-border bg-card">
        <div className="px-8 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/stock")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Nouvelle entrée de stock</h1>
            <p className="text-muted-foreground mt-1">Enregistrez l'arrivée de nouveaux produits</p>
          </div>
        </div>
      </header>

      <div className="p-8">
        <form onSubmit={handleSubmit}>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Détails de l'entrée de stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product_id">Produit *</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(value) => setFormData({ ...formData, product_id: value, locker_id: '' })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un produit" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_type">Unité d'entrée *</Label>
                <Select
                  value={formData.unit_type}
                  onValueChange={(value) => setFormData({ ...formData, unit_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner l'unité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottle">Bouteilles</SelectItem>
                    <SelectItem value="case">Casiers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="locker_id">Casier/Emplacement (Automatique)</Label>
                <Select
                  value={formData.locker_id}
                  onValueChange={(value) => setFormData({ ...formData, locker_id: value })}
                  disabled={true}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedLocker ? selectedLocker.name : "Sélectionnez un produit"} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedLocker && (
                      <SelectItem value={selectedLocker.id.toString()}>
                        {selectedLocker.name}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Le casier principal du produit est utilisé automatiquement.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qty_bottles">
                  Quantité en {formData.unit_type === 'case' ? 'casiers' : 'bouteilles'} *
                </Label>
                <Input
                  id="qty_bottles"
                  type="number"
                  value={formData.qty_bottles}
                  onChange={(e) => setFormData({ ...formData, qty_bottles: e.target.value })}
                  required
                  min="1"
                  placeholder={formData.unit_type === 'case' ? 'Nombre de casiers' : 'Nombre de bouteilles'}
                />
                {formData.unit_type === 'case' && formData.product_id && (
                  <p className="text-sm text-muted-foreground">
                    1 casier = {products.find(p => p.id.toString() === formData.product_id)?.bottles_per_case || 0} bouteilles
                  </p>
                )}
                {formData.qty_bottles && formData.product_id && formData.unit_type === 'case' && (
                  <p className="text-sm text-green-600">
                    → {parseInt(formData.qty_bottles) * (products.find(p => p.id.toString() === formData.product_id)?.bottles_per_case || 0)} bouteilles seront ajoutées
                  </p>
                )}
                {formData.qty_bottles && formData.product_id && formData.unit_type === 'bottle' && (
                  <p className="text-sm text-blue-600">
                    → {formData.qty_bottles} bouteilles seront ajoutées
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="outline" onClick={() => navigate("/stock")}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Enregistrement..." : "Enregistrer l'entrée"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </>
  );
};

export default StockEntryForm;
