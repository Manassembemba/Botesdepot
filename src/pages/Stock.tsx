/**
 * STOCK MANAGEMENT ARCHITECTURE
 *
 * Database Layer (PostgreSQL):
 * - Trigger `update_locker_stock_from_entry()`: Updates stock when entries are added
 * - Trigger `handle_stock_entry_deletes()`: Recalculates stock when entries are deleted
 * - Views: `v_total_product_stock` aggregates total stock per product
 *
 * Frontend Layer (React/TypeScript):
 * - Displays stock data from database
 * - Calculates case equivalents for user-friendly display
 * - All actual stock management happens in PostgreSQL triggers
 *
 * This ensures data consistency and prevents race conditions.
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Plus, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Stock = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      }
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    fetchProducts();
  }, []);

  // Debug: Log when products state changes
  useEffect(() => {
    console.log('🔍 DEBUG: Products state updated:', products.length, 'products');
    products.forEach(product => {
      console.log(`🔍 DEBUG: ${product.name} - Stock: ${product.total_stock_bottles} bottles, Cases: ${product.full_cases}, Remaining: ${product.remaining_bottles}`);
    });
  }, [products]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('🔍 DEBUG: fetchProducts started');

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true);

      if (productsError) {
        console.log('❌ DEBUG: Products error:', productsError);
        throw productsError;
      }

      console.log('🔍 DEBUG: Products loaded:', productsData?.length || 0, 'products');

      const { data: stockData, error: stockError } = await supabase
        .from("locker_stock")
        .select(`
          product_id,
          quantity_bottles
        `);

      if (stockError) {
        console.log('❌ DEBUG: Stock error:', stockError);
        throw stockError;
      }

      console.log('🔍 DEBUG: Stock data loaded:', stockData);

      // Calculate total stock per product
      const stockMap = new Map<number, number>();
      if (stockData) {
        stockData.forEach((item) => {
          console.log('🔍 DEBUG: Processing stock item:', item);
          const currentStock = stockMap.get(item.product_id) || 0;
          stockMap.set(item.product_id, currentStock + item.quantity_bottles);
        });
      }

      console.log('🔍 DEBUG: Stock map:', Object.fromEntries(stockMap));

      const productsWithStock = productsData.map(product => {
        const totalStock = stockMap.get(product.id) || 0;
        console.log(`🔍 DEBUG: Product ${product.name} (ID: ${product.id}) - Stock: ${totalStock} bottles`);

        const fullCases = totalStock > 0 ? Math.floor(totalStock / product.bottles_per_case) : 0;
        const remainingBottles = totalStock > 0 ? totalStock % product.bottles_per_case : 0;

        console.log(`🔍 DEBUG: Product ${product.name} - Cases: ${fullCases}, Remaining: ${remainingBottles}`);

        return {
          ...product,
          total_stock_bottles: totalStock,
          full_cases: fullCases,
          remaining_bottles: remainingBottles
        };
      });

      console.log('🔍 DEBUG: Final products with stock:', productsWithStock.length);
      setProducts(productsWithStock || []);
    } catch (error: any) {
      console.log('❌ DEBUG: Fetch error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits et leur stock",
        variant: "destructive",
      });
    } finally {
      console.log('🔍 DEBUG: fetchProducts finished');
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce produit?")) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Produit supprimé avec succès",
      });

      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le produit",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="flex items-center justify-between px-8 py-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Stock</h1>
            <p className="text-muted-foreground mt-1">Gérez l'état de votre stock</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={() => navigate("/stock/nouveau")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un article
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/stock/entree")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Entrée de stock
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucun produit disponible</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="relative hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-foreground mb-2">{product.name}</h3>
                    {product.sku && (
                      <Badge variant="secondary" className="text-xs">
                        SKU: {product.sku}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Prix bouteille:</span>
                      <span className="font-semibold text-primary">{product.price_per_bottle} FC</span>
                    </div>
                    {product.price_half_case && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Prix demi-casier:</span>
                        <span className="font-semibold text-primary">{product.price_half_case} FC</span>
                      </div>
                    )}
                    {product.price_full_case && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Prix casier:</span>
                        <span className="font-semibold text-primary">{product.price_full_case} FC</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bouteilles/casier:</span>
                      <span className="font-semibold text-foreground">{product.bottles_per_case}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Stock total:</span>
                      <span className="font-semibold text-foreground">{product.total_stock_bottles} bouteilles</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Équivalent casiers:</span>
                      <div className="text-right">
                        {product.total_stock_bottles > 0 ? (
                          <>
                            <div className="font-semibold text-foreground">
                              {product.full_cases} casiers complets
                            </div>
                            {product.remaining_bottles > 0 && (
                              <div className="text-xs text-muted-foreground">
                                + {product.remaining_bottles} bouteilles restantes
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="font-semibold text-muted-foreground">0 casiers</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/stock/edit/${product.id}`)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Stock;
