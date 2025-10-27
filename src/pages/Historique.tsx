import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Search, FileDown, Clock, ShoppingCart, Package, FileText } from "lucide-react";
import { format, endOfDay, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { AuthContext } from "@/App";
import jsPDF from "jspdf";
import * as jspdfAutoTable from "jspdf-autotable";
import { Tables } from "@/integrations/supabase/types";

// Define the type for the query result
type SaleItemWithJoins = Tables<"sale_items"> & {
  sales: {
    created_at: string;
    created_by: string | null;
  };
  products: {
    name: string;
    price_per_bottle: number;
    cost_per_bottle: number;
  };
};

const Historique = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useUserRole();
  const { selectedSiteId } = useContext(AuthContext);

  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfDay(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfDay(new Date()));
  const [sales, setSales] = useState<SaleItemWithJoins[]>([]);
  const [totalSalesAmount, setTotalSalesAmount] = useState(0);
  const [totalProfitAmount, setTotalProfitAmount] = useState(0);
  const [totalCOGSAmount, setTotalCOGSAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      }
    };

    checkAuth();
  }, [navigate]);

  // Auto-search when dates are set (on page load)
  useEffect(() => {
    if (dateFrom && dateTo) {
      handleSearch();
    }
  }, [dateFrom, dateTo]);

  const handleSearch = async () => {
    if (!dateFrom || !dateTo) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez sélectionner une date de début et une date de fin.",
      });
      return;
    }

    setLoading(true);
    const from = dateFrom.toISOString();
    const to = endOfDay(dateTo).toISOString();

    let query = supabase
      .from("sale_items")
      .select(`
        *,
        sales!inner(created_at, created_by),
        products!inner(name, price_per_bottle, cost_per_bottle)
      `)
      .gte("sales.created_at", from)
      .lte("sales.created_at", to);

    // Temporairement désactivé : filtrage par site
    // if (selectedSiteId && selectedSiteId !== "all-sites") {
    //   query = query.eq("sales.site_id", selectedSiteId);
    // }

    const { data, error } = await query.order("created_at", { foreignTable: "sales", ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur de recherche",
        description: error.message,
      });
      setSales([]);
    } else {
      setSales((data as SaleItemWithJoins[]) || []);
      const total = (data || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0);
      setTotalSalesAmount(total);

      // Calculs pour admin/magasinier
      if (role === 'admin' || role === 'magasinier') {
        const profit = (data || []).reduce((sum, item) => {
          const cost = Number(item.products?.cost_per_bottle || 0);
          const qty = item.qty || 1;
          const unitPrice = item.unit_price || 0;
          return sum + (unitPrice - cost) * qty;
        }, 0);
        setTotalProfitAmount(profit);

        const cogs = (data || []).reduce((sum, item) => {
          const cost = Number(item.products?.cost_per_bottle || 0);
          const qty = item.qty || 1;
          return sum + cost * qty;
        }, 0);
        setTotalCOGSAmount(cogs);
      }
    }
    setLoading(false);
  };

  const handleExportPDF = () => {
    if (sales.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Il n'y a rien à exporter.",
      });
      return;
    }

    const doc = new jsPDF();
    const totalRevenue = sales.reduce((sum, item) => sum + Number(item.total_price || 0), 0);

    // Title
    doc.setFontSize(20);
    doc.text("Rapport de Ventes - Botes Depot", 14, 22);

    // Subtitle with date range
    doc.setFontSize(12);
    const dateRange = `Période du ${format(dateFrom!, "dd/MM/yyyy")} au ${format(dateTo!, "dd/MM/yyyy")}`;
    doc.text(dateRange, 14, 30);

    // Summary
    doc.setFontSize(12);
    doc.text(`Total des ventes: ${totalRevenue.toFixed(2)} FC`, 14, 40);

    if (role === 'admin' || role === 'magasinier') {
      doc.text(`Bénéfice total: ${totalProfitAmount.toFixed(2)} FC`, 14, 46);
      doc.text(`Coût d'achat total: ${totalCOGSAmount.toFixed(2)} FC`, 14, 52);
      doc.text(`Nombre de transactions: ${sales.length}`, 14, 58);
    } else {
      doc.text(`Nombre de transactions: ${sales.length}`, 14, 46);
    }

    // Table
    jspdfAutoTable.default(doc, {
      startY: (role === 'admin' || role === 'magasinier') ? 65 : 55,
      head: [["Date", "Produit", "Caissier", "Qté", "Prix Unit.", "Total"]],
      body: sales.map(item => [
        format(new Date(item.sales.created_at), "dd/MM/yy HH:mm"),
        item.products?.name || 'N/A',
        item.sales.created_by || 'N/A',
        item.qty || 1,
        `${Number(item.unit_price || 0).toFixed(2)} FC`,
        `${Number(item.total_price || 0).toFixed(2)} FC`,
      ]),
      foot: [['', '', '', '', 'Total Général:', `${totalRevenue.toFixed(2)} FC`]],
      footStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 197, 94] },
    });

    doc.save(`rapport_ventes_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <>
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Clock className="h-8 w-8" />
            Historique des Ventes
          </h1>
          <p className="text-muted-foreground mt-1">Consultez l'historique complet des ventes par date avec calculs détaillés</p>
        </div>
      </header>

      <div className="p-8 space-y-6">
        {/* Filtres par date */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filtres et Recherche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[280px] justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : <span>Date de début</span>}
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
                      "w-[280px] justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : <span>Date de fin</span>}
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

              <Button onClick={handleSearch} disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                {loading ? "Recherche..." : "Actualiser"}
              </Button>

              <Button onClick={handleExportPDF} disabled={sales.length === 0} variant="secondary">
                <FileDown className="mr-2 h-4 w-4" />
                Exporter en PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Résumé des calculs */}
        {sales.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card/50 shadow-card">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total des ventes</p>
                  <p className="text-2xl font-bold text-primary">{totalSalesAmount.toFixed(2)} FC</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-primary" />
              </CardContent>
            </Card>

            {(role === 'admin' || role === 'magasinier') && (
              <>
                <Card className="border-border bg-card/50 shadow-card">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Bénéfice Total</p>
                      <p className="text-2xl font-bold text-green-600">{totalProfitAmount.toFixed(2)} FC</p>
                    </div>
                    <Package className="h-8 w-8 text-green-600" />
                  </CardContent>
                </Card>

                <Card className="border-border bg-card/50 shadow-card">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Coût d'achat</p>
                      <p className="text-2xl font-bold text-orange-600">{totalCOGSAmount.toFixed(2)} FC</p>
                    </div>
                    <FileText className="h-8 w-8 text-orange-600" />
                  </CardContent>
                </Card>
              </>
            )}

            <Card className="border-border bg-card/50 shadow-card">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold text-blue-600">{sales.length}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table des résultats */}
        <Card>
          <CardHeader>
            <CardTitle>Détail des Ventes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Caissier</TableHead>
                  <TableHead>Qté</TableHead>
                  <TableHead>Prix Unitaire</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="ml-2">Recherche en cours...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {dateFrom && dateTo
                        ? "Aucune vente trouvée pour cette période"
                        : "Chargement des données..."
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{format(new Date(item.sales.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell className="font-medium">{item.products?.name || 'N/A'}</TableCell>
                      <TableCell>{item.sales.created_by || 'N/A'}</TableCell>
                      <TableCell>{item.qty || 1}</TableCell>
                      <TableCell>{Number(item.unit_price || 0).toFixed(2)} FC</TableCell>
                      <TableCell className="text-right font-medium">{Number(item.total_price || 0).toFixed(2)} FC</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Historique;
