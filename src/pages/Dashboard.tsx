import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart, AlertTriangle, Package, Calendar, Wallet, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";

const Dashboard = () => {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalSales: 0,
    totalRevenue: 0,
    recentSales: [],
    dailyRevenue: 0,
    dailyNetProfit: 0,
    dailyCost: 0,
    trendPercentage: 0,
    lowStockAlerts: [],
    outOfStockProducts: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      }
    };

    checkAuth();
    if (!roleLoading) {
      fetchStats();
    }
  }, [navigate, role, roleLoading]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
      const endOfYesterday = startOfDay;

      const { count: productsCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      const { data: salesData } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      const totalRevenue = salesData?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;

      let dailyRevenue = 0;
      let dailyNetProfit = 0;
      let dailyCost = 0;
      let trendPercentage = 0;
      let lowStockAlerts: any[] = [];
      let outOfStockProducts: any[] = [];

      if (role === 'admin') {
        const { data: todaySales } = await supabase
          .from("sales")
          .select("id, total_amount")
          .gte("created_at", startOfDay)
          .lt("created_at", endOfDay);

        dailyRevenue = todaySales?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;

        const todaySaleIds = todaySales?.map(s => s.id) || [];
        
        if (todaySaleIds.length > 0) {
          const { data: saleItems } = await supabase
            .from("sale_items")
            .select(`qty_bottles, products ( cost_per_bottle )`)
            .in("sale_id", todaySaleIds);

          if (saleItems) {
            dailyCost = saleItems.reduce((sum, item) => {
              const product = Array.isArray(item.products) ? item.products[0] : item.products;
              const cost = product?.cost_per_bottle || 0;
              return sum + (item.qty_bottles * cost);
            }, 0);
          }
        }

        dailyNetProfit = dailyRevenue - dailyCost;

        const { data: yesterdaySales } = await supabase
          .from("sales")
          .select("total_amount")
          .gte("created_at", startOfYesterday)
          .lt("created_at", endOfYesterday);

        const yesterdayRevenue = yesterdaySales?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;

        if (yesterdayRevenue > 0) {
          trendPercentage = ((dailyRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
        } else if (dailyRevenue > 0) {
          trendPercentage = 100;
        }

        const { data: productsWithStock } = await supabase
          .from("products")
          .select(`id, name, locker_stock!inner(quantity_bottles)`)
          .eq("is_active", true);

        if (productsWithStock) {
          productsWithStock.forEach((product: any) => {
            const totalStock = product.locker_stock?.reduce((sum: number, stock: any) => sum + (stock.quantity_bottles || 0), 0) || 0;
            if (totalStock === 0) {
              outOfStockProducts.push({ product_name: product.name, locker_code: "Tous casiers", quantity_bottles: totalStock });
            } else if (totalStock < 50) {
              lowStockAlerts.push({ product_name: product.name, locker_code: "Tous casiers", quantity_bottles: totalStock });
            }
          });
        }
      }

      setStats({
        totalProducts: productsCount || 0,
        totalSales: salesData?.length || 0,
        totalRevenue,
        recentSales: salesData || [],
        dailyRevenue,
        dailyNetProfit,
        dailyCost,
        trendPercentage,
        lowStockAlerts,
        outOfStockProducts
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground mt-1">
            {role === 'admin'
              ? 'Vue d\'overview administrative avec métriques du jour'
              : 'Vue d\'overview de votre activité'
            }
          </p>
        </div>
      </header>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {role === 'admin' ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ventes du jour</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.dailyRevenue.toFixed(0)} FC</div>
                  <p className="text-xs text-muted-foreground">chiffre d'affaires aujourd'hui</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bénéfice du jour</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{stats.dailyNetProfit.toFixed(0)} FC</div>
                  <p className="text-xs text-muted-foreground">marge bénéficiaire aujourd'hui</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Coût des ventes</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.dailyCost.toFixed(0)} FC</div>
                  <p className="text-xs text-muted-foreground">coût des marchandises vendues</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tendance</CardTitle>
                  {stats.trendPercentage >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stats.trendPercentage >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {stats.trendPercentage >= 0 ? '+' : ''}{stats.trendPercentage.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">vs hier</p>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Produits actifs</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalProducts}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ventes récentes</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalSales}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenu total</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalRevenue.toFixed(0)} FC</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tendance</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">+12%</div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {role === 'admin' && (stats.lowStockAlerts.length > 0 || stats.outOfStockProducts.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {stats.lowStockAlerts.length > 0 && (
              <Card className="border-warning">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-5 w-5" />
                    Alertes Stock Faible
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.lowStockAlerts.map((alert: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
                        <div>
                          <p className="font-medium text-foreground">{alert.product_name}</p>
                          <p className="text-sm text-muted-foreground">Casier: {alert.locker_code}</p>
                        </div>
                        <Badge variant="secondary" className="bg-warning/20 text-warning">
                          {alert.quantity_bottles} bouteilles
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {stats.outOfStockProducts.length > 0 && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Ruptures de Stock
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.outOfStockProducts.map((product: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <div>
                          <p className="font-medium text-foreground">{product.product_name}</p>
                          <p className="text-sm text-muted-foreground">Casier: {product.locker_code}</p>
                        </div>
                        <Badge variant="destructive">
                          Rupture
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ventes récentes</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/historique')}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Voir plus
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentSales.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Aucune vente récente</p>
            ) : (
              <div className="space-y-4">
                {stats.recentSales.slice(0, 5).map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-semibold">{sale.reference}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{sale.total_amount} FC</p>
                      <p className="text-sm text-muted-foreground">Transaction</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Dashboard;
