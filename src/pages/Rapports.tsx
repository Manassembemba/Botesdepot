import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart3,
  FileText,
  TrendingUp,
  Package,
  Users,
  ShoppingCart,
  Calendar as CalendarIcon,
  Search,
  FileDown,
  DollarSign,
  AlertTriangle
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { AuthContext } from "@/App";
import jsPDF from "jspdf";
import * as jspdfAutoTable from "jspdf-autotable";

interface SaleData {
  date: string;
  total: number;
  profit: number;
  count: number;
}

const Rapports = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useUserRole();
  const { selectedSiteId } = useContext(AuthContext);

  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [reportType, setReportType] = useState("overview");
  const [loading, setLoading] = useState(false);

  // Données des rapports
  const [salesData, setSalesData] = useState<SaleData[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [stockReport, setStockReport] = useState<any[]>([]);
  const [profitReport, setProfitReport] = useState<any>({});

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      }
    };

    checkAuth();
    loadReportData();
  }, [navigate, reportType, dateFrom, dateTo, selectedSiteId]);

  const loadReportData = async () => {
    if (!dateFrom || !dateTo) return;

    setLoading(true);
    const from = dateFrom.toISOString();
    const to = dateTo.toISOString();

    try {
      await loadSalesOverview();
      await loadTopProducts();
      await loadStockReport();
      await loadProfitReport(from, to);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de chargement",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSalesOverview = async () => {
    const sevenDaysAgo = subDays(new Date(), 7);

    let query = supabase
      .from("sale_items")
      .select(`
        qty,
        unit_price,
        total_price,
        sales!inner(created_at, total_amount),
        products!inner(name, price_per_bottle, cost_per_bottle)
      `)
      .gte("sales.created_at", sevenDaysAgo.toISOString());

    if (selectedSiteId && selectedSiteId !== "all-sites") {
      query = query.eq("sales.site_id", selectedSiteId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Grouper par date
    const grouped = (data || []).reduce((acc: any, item: any) => {
      const date = format(new Date(item.sales.created_at), "yyyy-MM-dd");
      if (!acc[date]) {
        acc[date] = { date, total: 0, profit: 0, count: 0 };
      }
      acc[date].total += Number(item.total_price);
      acc[date].profit += (Number(item.unit_price) - Number(item.products?.cost_per_bottle || 0)) * item.qty;
      acc[date].count += 1;
      return acc;
    }, {});

    const sortedSales = Object.values(grouped).sort((a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    setSalesData(sortedSales as SaleData[]);
  };

  const loadTopProducts = async () => {
    const sevenDaysAgo = subDays(new Date(), 7);

    let query = supabase
      .from("sale_items")
      .select(`
        qty,
        sales!inner(created_at),
        products!inner(name)
      `)
      .gte("sales.created_at", sevenDaysAgo.toISOString());

    // Temporairement désactivé : filtrage par site
    // if (selectedSiteId && selectedSiteId !== "all-sites") {
    //   query = query.eq("sales.site_id", selectedSiteId);
    // }

    const { data, error } = await query;

    if (error) throw error;

    // Calculer les ventes par produit
    const productSales = (data || []).reduce((acc: any, item: any) => {
      const name = item.products?.name || "Inconnu";
      if (!acc[name]) {
        acc[name] = { name, value: 0 };
      }
      acc[name].value += item.qty;
      return acc;
    }, {});

    const top = Object.values(productSales)
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5);

    setTopProducts(top);
  };

  const loadStockReport = async () => {
    // Get products data
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true);

    if (productsError) throw productsError;

    // Get stock data from view
    const { data: stockData, error: stockError } = await supabase
      .from("v_total_product_stock")
      .select("product_id, total_stock_bottles");

    if (stockError) throw stockError;

    // Combine the data
    const productsWithStock = productsData.map(product => {
      const stock = stockData.find(s => s.product_id === product.id);
      return {
        ...product,
        v_total_product_stock: stock ? [stock] : []
      };
    });

    setStockReport(productsWithStock);
  };

  const loadProfitReport = async (from: string, to: string) => {
    let query = supabase
      .from("sale_items")
      .select(`
        qty,
        unit_price,
        total_price,
        sales!inner(created_at),
        products!inner(name, price_per_bottle, cost_per_bottle)
      `)
      .gte("sales.created_at", from)
      .lte("sales.created_at", to);

    // Temporairement désactivé : filtrage par site
    // if (selectedSiteId && selectedSiteId !== "all-sites") {
    //   query = query.eq("sales.site_id", selectedSiteId);
    // }

    const { data, error } = await query;

    if (error) throw error;

    // Calcul des profits
    const totalRevenue = (data || []).reduce((sum, item) => sum + Number(item.total_price), 0);
    const totalCost = (data || []).reduce((sum, item) => sum + (Number(item.products?.cost_per_bottle || 0) * item.qty), 0);
    const totalProfit = totalRevenue - totalCost;

    setProfitReport({
      totalRevenue,
      totalCost,
      totalProfit,
      totalTransactions: data?.length || 0,
      data: data || []
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    // Titre
    doc.setFontSize(20);
    doc.text("Rapport - Botes Depot", 14, 22);

    // Période
    doc.setFontSize(12);
    const periodText = `Période: ${format(dateFrom!, "dd/MM/yyyy")} - ${format(dateTo!, "dd/MM/yyyy")}`;
    doc.text(periodText, 14, 30);

    let startY = 40;

    if (reportType === "overview") {
      doc.text("Aperçu des Ventes (7 derniers jours)", 14, startY);
      startY += 10;

      if (salesData.length > 0) {
        jspdfAutoTable.default(doc, {
          startY,
          head: [["Date", "Ventes", "Bénéfice", "Transactions"]],
          body: salesData.map(item => [
            format(new Date(item.date), "dd/MM/yyyy"),
            `${item.total.toFixed(2)} FC`,
            `${item.profit.toFixed(2)} FC`,
            item.count.toString(),
          ]),
        });
      }

      if (topProducts.length > 0) {
        startY = (doc as any).lastAutoTable.finalY + 20;
        doc.text("Top 5 Produits", 14, startY);
        startY += 10;

        jspdfAutoTable.default(doc, {
          startY,
          head: [["Produit", "Quantité vendue"]],
          body: topProducts.map(item => [
            item.name,
            item.value.toString(),
          ]),
        });
      }
    }

    doc.save(`rapport_${reportType}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const setQuickDateRange = (range: string) => {
    const today = new Date();
    switch (range) {
      case "today":
        setDateFrom(today);
        setDateTo(today);
        break;
      case "week":
        setDateFrom(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
        setDateTo(today);
        break;
      case "month":
        setDateFrom(startOfMonth(today));
        setDateTo(endOfMonth(today));
        break;
      case "year":
        setDateFrom(startOfYear(today));
        setDateTo(endOfYear(today));
        break;
    }
  };

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <>
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <BarChart3 className="h-8 w-8" />
            Rapports et Analyses
          </h1>
          <p className="text-muted-foreground mt-1">
            Consultez des rapports détaillés sur les ventes, stocks, clients et performances
          </p>
        </div>
      </header>

      <div className="p-8 space-y-6">
        {/* Filtres */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filtres et Période
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Type de rapport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Aperçu (7 jours)</SelectItem>
                  <SelectItem value="detailed">Rapport Détaillé</SelectItem>
                  <SelectItem value="stock">Rapport de Stock</SelectItem>
                  <SelectItem value="profits">Rapport Profits</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setQuickDateRange("today")}>
                  Aujourd'hui
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickDateRange("week")}>
                  Cette semaine
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickDateRange("month")}>
                  Ce mois
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickDateRange("year")}>
                  Cette année
                </Button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : <span>Date début</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : <span>Date fin</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button onClick={exportToPDF} disabled={loading} variant="secondary">
                <FileDown className="mr-2 h-4 w-4" />
                Exporter PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Onglets des rapports */}
        <Tabs value={reportType} onValueChange={setReportType} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Aperçu
            </TabsTrigger>
            <TabsTrigger value="detailed" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Ventes
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Stock
            </TabsTrigger>
            <TabsTrigger value="profits" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Profits
            </TabsTrigger>
          </TabsList>

          {/* Aperçu avec graphiques */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-border bg-card/50 shadow-card backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Ventes des 7 derniers jours</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {salesData.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Aucune vente à afficher</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">
                            {salesData.reduce((sum, item) => sum + item.total, 0).toFixed(0)} FC
                          </p>
                          <p className="text-sm text-muted-foreground">Total des ventes</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">
                            {salesData.reduce((sum, item) => sum + item.profit, 0).toFixed(0)} FC
                          </p>
                          <p className="text-sm text-muted-foreground">Bénéfice total</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {salesData.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div>
                              <p className="font-medium">{format(new Date(item.date), "dd/MM/yyyy")}</p>
                              <p className="text-sm text-muted-foreground">{item.count} transaction(s)</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-blue-600">{item.total.toFixed(0)} FC</p>
                              <p className="text-sm text-green-600">+{item.profit.toFixed(0)} FC</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50 shadow-card backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Top 5 produits</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {topProducts.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Aucune donnée</p>
                  ) : (
                    <div className="space-y-4">
                      {topProducts.map((product, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium">{product.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{product.value}</p>
                            <p className="text-sm text-muted-foreground">unités</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Rapport détaillé des ventes */}
          <TabsContent value="detailed" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border bg-card/50 shadow-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total des ventes</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {salesData.reduce((sum, item) => sum + item.total, 0).toFixed(0)} FC
                    </p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-blue-600" />
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50 shadow-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Bénéfice total</p>
                    <p className="text-2xl font-bold text-green-600">
                      {salesData.reduce((sum, item) => sum + item.profit, 0).toFixed(0)} FC
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50 shadow-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {salesData.reduce((sum, item) => sum + item.count, 0)}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-purple-600" />
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50 shadow-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Panier moyen</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {salesData.reduce((sum, item) => sum + item.count, 0) > 0
                        ? (salesData.reduce((sum, item) => sum + item.total, 0) / salesData.reduce((sum, item) => sum + item.count, 0)).toFixed(0)
                        : 0} FC
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-orange-600" />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Détail des Ventes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Ventes</TableHead>
                        <TableHead>Bénéfice</TableHead>
                        <TableHead>Transactions</TableHead>
                        <TableHead>Marge (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                              <span className="ml-2">Chargement...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : salesData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            Aucune vente trouvée
                          </TableCell>
                        </TableRow>
                      ) : (
                        salesData.map((item, index) => {
                          const marginPercent = item.total > 0 ? (item.profit / item.total) * 100 : 0;
                          return (
                            <TableRow key={index}>
                              <TableCell>{format(new Date(item.date), "dd/MM/yyyy")}</TableCell>
                              <TableCell className="font-medium">{item.total.toFixed(2)} FC</TableCell>
                              <TableCell className={`font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {item.profit.toFixed(2)} FC
                              </TableCell>
                              <TableCell>{item.count}</TableCell>
                              <TableCell className={`font-medium ${marginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {marginPercent.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rapport de Stock */}
          <TabsContent value="stock" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border bg-card/50 shadow-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Produits</p>
                    <p className="text-2xl font-bold text-primary">{stockReport.length}</p>
                  </div>
                  <Package className="h-8 w-8 text-primary" />
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50 shadow-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Stock Faible</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {stockReport.filter(p => (p.v_total_product_stock?.[0]?.total_stock_bottles || 0) <= 50).length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                </CardContent>
              </Card>

              <Card className="border-border bg-card/50 shadow-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rupture Stock</p>
                    <p className="text-2xl font-bold text-red-600">
                      {stockReport.filter(p => (p.v_total_product_stock?.[0]?.total_stock_bottles || 0) <= 10).length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>État du Stock par Produit</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Stock (bouteilles)</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <span className="ml-2">Chargement...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : stockReport.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                          Aucun produit trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockReport.map((product, index) => {
                        const stock = product.v_total_product_stock?.[0]?.total_stock_bottles || 0;
                        const status = stock > 50 ? "En stock" : stock > 10 ? "Stock faible" : "Rupture";
                        const statusColor = stock > 50 ? "text-green-600" : stock > 10 ? "text-orange-600" : "text-red-600";

                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{stock}</TableCell>
                            <TableCell className={`font-medium ${statusColor}`}>{status}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rapport Profits */}
          <TabsContent value="profits" className="space-y-4">
            {profitReport.totalRevenue && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border bg-card/50 shadow-card">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Chiffre d'affaires</p>
                      <p className="text-2xl font-bold text-green-600">{profitReport.totalRevenue.toFixed(2)} FC</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </CardContent>
                </Card>

                <Card className="border-border bg-card/50 shadow-card">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Coût total</p>
                      <p className="text-2xl font-bold text-red-600">{profitReport.totalCost.toFixed(2)} FC</p>
                    </div>
                    <Package className="h-8 w-8 text-red-600" />
                  </CardContent>
                </Card>

                <Card className="border-border bg-card/50 shadow-card">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Bénéfice net</p>
                      <p className={`text-2xl font-bold ${profitReport.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profitReport.totalProfit.toFixed(2)} FC
                      </p>
                    </div>
                    <TrendingUp className={`h-8 w-8 ${profitReport.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </CardContent>
                </Card>

                <Card className="border-border bg-card/50 shadow-card">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                      <p className="text-2xl font-bold text-blue-600">{profitReport.totalTransactions}</p>
                    </div>
                    <ShoppingCart className="h-8 w-8 text-blue-600" />
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Détail des Profits par Transaction</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Prix Vente</TableHead>
                      <TableHead>Coût Achat</TableHead>
                      <TableHead className="text-right">Marge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <span className="ml-2">Chargement...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : profitReport.data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          Aucune transaction trouvée pour cette période
                        </TableCell>
                      </TableRow>
                    ) : (
                      (profitReport.data || []).map((item, index) => {
                        const cost = Number(item.products?.cost_per_bottle || 0) * item.qty;
                        const revenue = Number(item.total_price);
                        const margin = revenue - cost;

                        return (
                          <TableRow key={index}>
                            <TableCell>{format(new Date(item.sales.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                            <TableCell className="font-medium">{item.products?.name || 'N/A'}</TableCell>
                            <TableCell>{item.qty}</TableCell>
                            <TableCell>{revenue.toFixed(2)} FC</TableCell>
                            <TableCell>{cost.toFixed(2)} FC</TableCell>
                            <TableCell className={`text-right font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {margin.toFixed(2)} FC
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Rapports;
