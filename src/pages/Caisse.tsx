import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  id: number;
  name: string;
  unit_type: string;
  unit_price: number;
  qty: number;
  bottles_per_case: number;
}

interface ProductWithStock {
  id: number;
  name: string;
  price_per_bottle: number;
  price_half_case?: number;
  price_full_case?: number;
  bottles_per_case: number;
  is_active: boolean;
  locker_stock: Array<{
    quantity_bottles: number;
    lockers: {
      id: number;
      name: string;
    };
  }>;
  total_stock?: number;
}

const Caisse = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [lockers, setLockers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      }
    };

    checkAuth();
    fetchProducts();
    fetchLockers();
  }, [navigate]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      // Récupérer les produits avec leur stock
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          *,
          locker_stock (
            quantity_bottles,
            lockers (id, name)
          )
        `)
        .eq("is_active", true);

      if (productsError) throw productsError;

      // Calculer le stock total pour chaque produit
      const productsWithStock = productsData.map(product => {
        const totalStock = product.locker_stock?.reduce(
          (sum, stock) => sum + (stock.quantity_bottles || 0), 0
        ) || 0;
        
        return {
          ...product,
          total_stock: totalStock
        };
      });

      setProducts(productsWithStock || []);
    } catch (error: any) {
      console.error('Erreur lors du chargement des produits:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLockers = async () => {
    try {
      const { data, error } = await supabase
        .from("lockers")
        .select("*");

      if (error) throw error;
      setLockers(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les casiers",
        variant: "destructive",
      });
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: any, unitType: string) => {
    const unitPrice = unitType === 'bottle' ? product.price_per_bottle :
                     unitType === 'half_case' ? product.price_half_case :
                     product.price_full_case;

    const existing = cart.find(item => item.id === product.id && item.unit_type === unitType);

    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id && item.unit_type === unitType
          ? { ...item, qty: item.qty + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        unit_type: unitType,
        unit_price: unitPrice,
        qty: 1,
        bottles_per_case: product.bottles_per_case
      }]);
    }
  };

  const updateQuantity = (id: number, unitType: string, change: number) => {
    setCart(cart.map(item => {
      if (item.id === id && item.unit_type === unitType) {
        const newQty = item.qty + change;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const removeFromCart = (id: number, unitType: string) => {
    setCart(cart.filter(item => !(item.id === id && item.unit_type === unitType)));
  };

  // Fonction pour mettre à jour le stock d'un produit spécifique
  const updateProductStock = (productId: number, quantityChange: number) => {
    setProducts(currentProducts => 
      currentProducts.map(product => {
        if (product.id === productId) {
          const newStock = (product.total_stock || 0) - quantityChange;
          return {
            ...product,
            total_stock: Math.max(0, newStock)
          };
        }
        return product;
      })
    );
  };

  const handleValidateSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Erreur",
        description: "Le panier est vide",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("Utilisateur non authentifié");

      // Vérifier les permissions de l'utilisateur
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const allowedRoles = ['admin', 'magasinier'];
      const hasPermission = userRoles?.some(role => allowedRoles.includes(role.role));

      if (!hasPermission) {
        throw new Error("Permissions insuffisantes. Vous devez avoir le rôle 'admin' ou 'magasinier' pour créer des ventes.");
      }

      // Trouver un casier qui a du stock pour au moins un produit du panier
      const { data: availableLockers } = await supabase
        .from('locker_stock')
        .select(`
          locker_id,
          quantity_bottles,
          lockers!inner(code, name),
          products!inner(name)
        `)
        .in('product_id', cart.map(item => item.id))
        .gt('quantity_bottles', 0);

      let defaultLockerId = null;

      if (availableLockers && availableLockers.length > 0) {
        // Utiliser le premier casier qui a du stock
        defaultLockerId = availableLockers[0].locker_id;
        console.log(`Casier sélectionné: ${availableLockers[0].lockers.name} (Stock disponible)`);
      } else {
        // Fallback: utiliser le premier casier de la liste
        if (lockers.length > 0) {
          defaultLockerId = lockers[0].id;
          console.log(`Casier fallback: ${lockers[0].name} (Aucun stock trouvé, création automatique)`);
        }
      }

      if (!defaultLockerId) {
        throw new Error("Aucun casier disponible pour traiter la vente");
      }

      const reference = `VTE-${Date.now()}`;
      const items = cart.map(item => ({
        product_id: item.id,
        unit_type: item.unit_type,
        qty: item.qty,
        unit_price: item.unit_price
      }));

      console.log('Envoi vers process_sale:', {
        p_reference: reference,
        p_created_by: user.id,
        p_locker_id: defaultLockerId,
        p_items: items
      });

      const { data, error } = await supabase.rpc('process_sale', {
        p_reference: reference,
        p_created_by: user.id,
        p_locker_id: defaultLockerId,
        p_items: items
      });

      if (error) {
        console.error('Supabase RPC Error:', error);
        throw new Error(`Erreur: ${error.message || 'Erreur inconnue'}`);
      }

      console.log('process_sale success:', data);

      toast({
        title: "Succès",
        description: `Vente ${reference} enregistrée avec succès`,
      });

      // Mettre à jour les quantités en temps réel sans recharger tous les produits
      cart.forEach(item => {
        let quantityChange = 0;
        
        // Calculer la quantité à soustraire en fonction du type d'unité
        switch(item.unit_type) {
          case 'bottle':
            quantityChange = item.qty;
            break;
          case 'half_case':
            quantityChange = item.qty * Math.ceil(item.bottles_per_case / 2);
            break;
          case 'full_case':
            quantityChange = item.qty * item.bottles_per_case;
            break;
        }
        
        updateProductStock(item.id, quantityChange);
      });
      
      setCart([]);
    } catch (error: any) {
      console.error('Erreur lors de la vente:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer la vente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.qty), 0);

  return (
    <>
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <ShoppingCart className="h-8 w-8" />
              Panier
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Cart Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {cart.length === 0 ? (
            <div className="text-center">
              <ShoppingCart className="h-24 w-24 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl text-muted-foreground">Panier vide</p>
            </div>
          ) : (
            <div className="w-full max-w-2xl">
              <ScrollArea className="h-[400px] mb-8">
                <div className="space-y-4">
                  {cart.map((item, index) => (
                    <div key={`${item.id}-${item.unit_type}`} className="flex items-center justify-between p-4 bg-card rounded-lg border">
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.unit_type === 'bottle' ? 'Bouteille' :
                           item.unit_type === 'half_case' ? 'Demi-casier' : 'Casier'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, item.unit_type, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-semibold">{item.qty}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, item.unit_type, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="font-bold text-primary w-24 text-right">
                          {(item.unit_price * item.qty).toFixed(0)} FC
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromCart(item.id, item.unit_type)}
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="space-y-4 p-6 bg-card rounded-lg border">
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total:</span>
                  <span className="text-primary">{subtotal.toFixed(0)} FC</span>
                </div>
                <Button
                  className="w-full h-14 text-lg bg-primary hover:bg-primary/90"
                  onClick={handleValidateSale}
                  disabled={loading}
                >
                  {loading ? "Enregistrement..." : "Valider la vente"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Products List */}
        <div className="w-96 border-l border-border bg-card">
          <div className="p-4 border-b border-border">
            <Input
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>

          <ScrollArea className="h-[calc(100vh-141px)]">
            <div className="p-4 space-y-2">
              {filteredProducts.map((product) => (
                <div key={product.id} className="p-4 rounded-lg border border-border bg-background">
                  <h3 className="font-semibold text-foreground mb-2">{product.name}</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => addToCart(product, 'bottle')}
                      disabled={!product.total_stock || product.total_stock === 0}
                      className={`w-full text-left p-2 rounded transition-colors flex justify-between items-center ${
                        product.total_stock && product.total_stock > 0 
                          ? 'hover:bg-muted' 
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Bouteille</span>
                        {product.total_stock !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            ({product.total_stock} disponible{product.total_stock !== 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-primary">{product.price_per_bottle} FC</span>
                    </button>
                    {product.price_half_case && (
                      <button
                      onClick={() => addToCart(product, 'half_case')}
                      disabled={!product.total_stock || product.total_stock < (product.bottles_per_case / 2)}
                      className={`w-full text-left p-2 rounded transition-colors flex justify-between items-center ${
                        product.total_stock && product.total_stock >= (product.bottles_per_case / 2)
                          ? 'hover:bg-muted' 
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Demi-casier</span>
                        {product.total_stock !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            ({Math.floor(product.total_stock / (product.bottles_per_case / 2))} disponible{Math.floor(product.total_stock / (product.bottles_per_case / 2)) !== 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-primary">{product.price_half_case} FC</span>
                    </button>
                    )}
                    {product.price_full_case && (
                      <button
                      onClick={() => addToCart(product, 'full_case')}
                      disabled={!product.total_stock || product.total_stock < product.bottles_per_case}
                      className={`w-full text-left p-2 rounded transition-colors flex justify-between items-center ${
                        product.total_stock && product.total_stock >= product.bottles_per_case
                          ? 'hover:bg-muted' 
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Casier complet</span>
                        {product.total_stock !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            ({Math.floor(product.total_stock / product.bottles_per_case)} disponible{Math.floor(product.total_stock / product.bottles_per_case) !== 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-primary">{product.price_full_case} FC</span>
                    </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
};

export default Caisse;
