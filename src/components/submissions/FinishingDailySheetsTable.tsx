import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Package, Search, Clock, ClipboardList, ExternalLink, Target, TrendingUp } from "lucide-react";

interface DailySheetRow {
  id: string;
  production_date: string;
  line_name: string;
  po_number: string | null;
  style: string | null;
  buyer: string | null;
  finishing_no: string | null;
  hours_logged: number;
  total_poly_target: number;
  total_carton_target: number;
  total_poly_actual: number;
  total_carton_actual: number;
  created_at: string;
}

interface FinishingDailySheetsTableProps {
  factoryId: string;
  dateRange: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

const MIN_REQUIRED_HOURS = 10;

export function FinishingDailySheetsTable({
  factoryId,
  dateRange,
  searchTerm,
  onSearchChange,
}: FinishingDailySheetsTableProps) {
  const [sheets, setSheets] = useState<DailySheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"targets" | "outputs">("targets");

  useEffect(() => {
    fetchSheets();
  }, [factoryId, dateRange]);

  async function fetchSheets() {
    setLoading(true);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(dateRange));

    try {
      const { data, error } = await supabase
        .from("finishing_daily_sheets")
        .select(`
          *,
          lines(id, line_id, name),
          work_orders(po_number, buyer, style),
          finishing_hourly_logs(id, poly_target, carton_target, poly_actual, carton_actual)
        `)
        .eq("factory_id", factoryId)
        .gte("production_date", startDate.toISOString().split("T")[0])
        .lte("production_date", endDate.toISOString().split("T")[0])
        .order("production_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted: DailySheetRow[] = (data || []).map((sheet: any) => {
        const logs = sheet.finishing_hourly_logs || [];
        return {
          id: sheet.id,
          production_date: sheet.production_date,
          line_name: sheet.lines?.name || sheet.lines?.line_id || "Unknown",
          po_number: sheet.work_orders?.po_number || sheet.po_no || null,
          style: sheet.work_orders?.style || sheet.style || null,
          buyer: sheet.work_orders?.buyer || sheet.buyer || null,
          finishing_no: sheet.finishing_no,
          hours_logged: logs.length,
          total_poly_target: logs.reduce((sum: number, l: any) => sum + (l.poly_target || 0), 0),
          total_carton_target: logs.reduce((sum: number, l: any) => sum + (l.carton_target || 0), 0),
          total_poly_actual: logs.reduce((sum: number, l: any) => sum + (l.poly_actual || 0), 0),
          total_carton_actual: logs.reduce((sum: number, l: any) => sum + (l.carton_actual || 0), 0),
          created_at: sheet.created_at,
        };
      });

      setSheets(formatted);
    } catch (error) {
      console.error("Error fetching sheets:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredSheets = sheets.filter((sheet) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      sheet.line_name.toLowerCase().includes(search) ||
      (sheet.po_number?.toLowerCase() || "").includes(search) ||
      (sheet.style?.toLowerCase() || "").includes(search)
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isToday = (dateString: string) => {
    const today = new Date().toISOString().split("T")[0];
    return dateString === today;
  };

  const getSheetStatus = (sheet: DailySheetRow): "complete" | "pending" | "incomplete" => {
    if (sheet.hours_logged >= MIN_REQUIRED_HOURS) {
      return "complete";
    }
    // If it's today's sheet and not complete, show pending
    if (isToday(sheet.production_date)) {
      return "pending";
    }
    // Past day and not complete = incomplete
    return "incomplete";
  };

  // Stats based on active tab
  const totalSheets = filteredSheets.length;
  const completeSheets = filteredSheets.filter((s) => s.hours_logged >= MIN_REQUIRED_HOURS).length;
  const totalPoly = activeTab === "targets" 
    ? filteredSheets.reduce((sum, s) => sum + s.total_poly_target, 0)
    : filteredSheets.reduce((sum, s) => sum + s.total_poly_actual, 0);
  const totalCarton = activeTab === "targets"
    ? filteredSheets.reduce((sum, s) => sum + s.total_carton_target, 0)
    : filteredSheets.reduce((sum, s) => sum + s.total_carton_actual, 0);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs for Targets vs Outputs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "targets" | "outputs")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="targets" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Daily Targets
          </TabsTrigger>
          <TabsTrigger value="outputs" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Daily Outputs
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalSheets}</p>
                    <p className="text-xs text-muted-foreground">Total Sheets</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{completeSheets}</p>
                    <p className="text-xs text-muted-foreground">Complete</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{totalPoly.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeTab === "targets" ? "Poly Target" : "Total Poly"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{totalCarton.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeTab === "targets" ? "Carton Target" : "Total Cartons"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by line, PO, or style..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {activeTab === "targets" ? (
                  <Target className="h-4 w-4 text-primary" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-primary" />
                )}
                {activeTab === "targets" ? "Daily Target Sheets" : "Daily Output Sheets"}
                <Badge variant="secondary" className="ml-2">
                  {filteredSheets.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>PO / Style</TableHead>
                      <TableHead className="text-center">Hours</TableHead>
                      <TableHead className="text-right">Poly</TableHead>
                      <TableHead className="text-right">Carton</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSheets.map((sheet) => {
                      const polyValue = activeTab === "targets" ? sheet.total_poly_target : sheet.total_poly_actual;
                      const cartonValue = activeTab === "targets" ? sheet.total_carton_target : sheet.total_carton_actual;
                      
                      return (
                        <TableRow key={sheet.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div>
                              <p className="font-mono text-sm">{formatDate(sheet.production_date)}</p>
                              <p className="text-xs text-muted-foreground">{formatTime(sheet.created_at)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{sheet.line_name}</span>
                              {sheet.finishing_no && (
                                <Badge variant="outline" className="text-xs">
                                  {sheet.finishing_no}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sheet.po_number || "-"}</p>
                              <p className="text-xs text-muted-foreground">{sheet.style || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-medium">
                                {sheet.hours_logged}/{MIN_REQUIRED_HOURS}
                              </span>
                              <Progress
                                value={(sheet.hours_logged / MIN_REQUIRED_HOURS) * 100}
                                className="h-1.5 w-16"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono font-bold text-success">
                              {polyValue.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono font-bold text-warning">
                              {cartonValue.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const status = getSheetStatus(sheet);
                              if (status === "complete") {
                                return (
                                  <Badge variant="default" className="bg-success hover:bg-success/90">
                                    Complete
                                  </Badge>
                                );
                              }
                              if (status === "pending") {
                                return (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
                                    Pending
                                  </Badge>
                                );
                              }
                              return <Badge variant="destructive">Incomplete</Badge>;
                            })()}
                          </TableCell>
                          <TableCell>
                            <Link to={activeTab === "targets" 
                              ? `/finishing/daily-target?sheet=${sheet.id}`
                              : `/finishing/daily-output?sheet=${sheet.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredSheets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                          <p>No {activeTab === "targets" ? "target" : "output"} sheets found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
