import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Calendar, Download, RefreshCw, FileText, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CuttingTarget {
  id: string;
  production_date: string;
  submitted_at: string;
  cutting_section_id: string;
  line_id: string;
  work_order_id: string;
  buyer: string;
  style: string;
  po_no: string;
  colour: string;
  order_qty: number;
  man_power: number;
  marker_capacity: number;
  lay_capacity: number;
  cutting_capacity: number;
  under_qty: number;
  cutting_sections?: { cutting_no: string };
  lines?: { line_id: string; name: string | null };
}

interface CuttingActual {
  id: string;
  production_date: string;
  submitted_at: string;
  cutting_section_id: string;
  line_id: string;
  work_order_id: string;
  buyer: string;
  style: string;
  po_no: string;
  colour: string;
  order_qty: number;
  day_cutting: number;
  total_cutting: number;
  day_input: number;
  total_input: number;
  balance: number;
  cutting_sections?: { cutting_no: string };
  lines?: { line_id: string; name: string | null };
}

interface CuttingSection {
  id: string;
  cutting_no: string;
}

interface Line {
  id: string;
  line_id: string;
  name: string | null;
}

export default function CuttingSummary() {
  const navigate = useNavigate();
  const { profile, isAdminOrHigher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");

  // Data
  const [targets, setTargets] = useState<CuttingTarget[]>([]);
  const [actuals, setActuals] = useState<CuttingActual[]>([]);
  const [cuttingSections, setCuttingSections] = useState<CuttingSection[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedCuttingSection, setSelectedCuttingSection] = useState("all");
  const [selectedLine, setSelectedLine] = useState("all");

  useEffect(() => {
    if (profile?.factory_id) {
      fetchData();
    }
  }, [profile?.factory_id, dateFrom, dateTo]);

  async function fetchData() {
    if (!profile?.factory_id) return;
    setLoading(true);

    try {
      const [targetsRes, actualsRes, sectionsRes, linesRes] = await Promise.all([
        supabase
          .from("cutting_targets")
          .select("*, cutting_sections(cutting_no), lines(line_id, name)")
          .eq("factory_id", profile.factory_id)
          .gte("production_date", dateFrom)
          .lte("production_date", dateTo)
          .order("production_date", { ascending: false }),
        supabase
          .from("cutting_actuals")
          .select("*, cutting_sections(cutting_no), lines(line_id, name)")
          .eq("factory_id", profile.factory_id)
          .gte("production_date", dateFrom)
          .lte("production_date", dateTo)
          .order("production_date", { ascending: false }),
        supabase
          .from("cutting_sections")
          .select("id, cutting_no")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true)
          .order("cutting_no"),
        supabase
          .from("lines")
          .select("id, line_id, name")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true),
      ]);

      setTargets(targetsRes.data || []);
      setActuals(actualsRes.data || []);
      setCuttingSections(sectionsRes.data || []);
      setLines(linesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  // Build summary view (one row per date + cutting_no + line + po)
  const summaryData = (() => {
    const map = new Map<string, {
      date: string;
      cuttingNo: string;
      lineId: string;
      lineName: string;
      poNo: string;
      buyer: string;
      style: string;
      colour: string;
      orderQty: number;
      target: CuttingTarget | null;
      actual: CuttingActual | null;
    }>();

    targets.forEach(t => {
      const key = `${t.production_date}-${t.cutting_section_id}-${t.line_id}-${t.work_order_id}`;
      if (!map.has(key)) {
        map.set(key, {
          date: t.production_date,
          cuttingNo: t.cutting_sections?.cutting_no || "",
          lineId: t.lines?.line_id || "",
          lineName: t.lines?.name || t.lines?.line_id || "",
          poNo: t.po_no,
          buyer: t.buyer,
          style: t.style,
          colour: t.colour,
          orderQty: t.order_qty,
          target: t,
          actual: null,
        });
      } else {
        map.get(key)!.target = t;
      }
    });

    actuals.forEach(a => {
      const key = `${a.production_date}-${a.cutting_section_id}-${a.line_id}-${a.work_order_id}`;
      if (!map.has(key)) {
        map.set(key, {
          date: a.production_date,
          cuttingNo: a.cutting_sections?.cutting_no || "",
          lineId: a.lines?.line_id || "",
          lineName: a.lines?.name || a.lines?.line_id || "",
          poNo: a.po_no,
          buyer: a.buyer,
          style: a.style,
          colour: a.colour,
          orderQty: a.order_qty,
          target: null,
          actual: a,
        });
      } else {
        map.get(key)!.actual = a;
      }
    });

    let data = Array.from(map.values());

    // Apply filters
    if (selectedCuttingSection !== "all") {
      data = data.filter(d => d.cuttingNo === selectedCuttingSection);
    }
    if (selectedLine !== "all") {
      data = data.filter(d => d.lineId === selectedLine);
    }

    return data.sort((a, b) => b.date.localeCompare(a.date));
  })();

  // Filtered targets for Targets tab
  const filteredTargets = targets.filter(t => {
    if (selectedCuttingSection !== "all" && t.cutting_sections?.cutting_no !== selectedCuttingSection) return false;
    if (selectedLine !== "all" && t.lines?.line_id !== selectedLine) return false;
    return true;
  });

  // Filtered actuals for Actuals tab
  const filteredActuals = actuals.filter(a => {
    if (selectedCuttingSection !== "all" && a.cutting_sections?.cutting_no !== selectedCuttingSection) return false;
    if (selectedLine !== "all" && a.lines?.line_id !== selectedLine) return false;
    return true;
  });

  function exportToCSV() {
    const headers = [
      "DATE", "CUTTING NO", "LINE NO", "BUYER", "STYLE", "PO-NO", "COLOUR", "ORDER QTY",
      "MAN POWER", "MARKER CAPACITY", "LAY CAPACITY", "CUTTING CAPACITY", "UNDER QTY",
      "DAY CUTTING", "TOTAL CUTTING", "DAY INPUT", "TOTAL INPUT", "BALANCE"
    ];

    const rows = summaryData.map(d => [
      d.date,
      d.cuttingNo,
      d.lineName,
      d.buyer,
      d.style,
      d.poNo,
      d.colour,
      d.orderQty,
      d.target?.man_power || "",
      d.target?.marker_capacity || "",
      d.target?.lay_capacity || "",
      d.target?.cutting_capacity || "",
      d.target?.under_qty || "",
      d.actual?.day_cutting || "",
      d.actual?.total_cutting || "",
      d.actual?.day_input || "",
      d.actual?.total_input || "",
      d.actual?.balance || "",
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cutting-report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!isAdminOrHigher()) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <p className="text-muted-foreground">Access denied. Admin or higher role required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-4 px-4 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Cutting Daily Summary</h1>
          <p className="text-sm text-muted-foreground">View cutting targets and actuals</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cutting No</Label>
              <Select value={selectedCuttingSection} onValueChange={setSelectedCuttingSection}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {cuttingSections.map(cs => (
                    <SelectItem key={cs.id} value={cs.cutting_no}>{cs.cutting_no}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Line</Label>
              <Select value={selectedLine} onValueChange={setSelectedLine}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {lines.map(l => (
                    <SelectItem key={l.id} value={l.line_id}>{l.name || l.line_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="summary" className="gap-2">
            <Calendar className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="targets" className="gap-2">
            <Target className="h-4 w-4" />
            All Targets ({filteredTargets.length})
          </TabsTrigger>
          <TabsTrigger value="actuals" className="gap-2">
            <FileText className="h-4 w-4" />
            All Actuals ({filteredActuals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Summary ({summaryData.length} records)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DATE</TableHead>
                      <TableHead>CUTTING NO</TableHead>
                      <TableHead>LINE NO</TableHead>
                      <TableHead>BUYER</TableHead>
                      <TableHead>STYLE</TableHead>
                      <TableHead>PO-NO</TableHead>
                      <TableHead>ORDER QTY</TableHead>
                      <TableHead>TARGET</TableHead>
                      <TableHead>ACTUAL</TableHead>
                      <TableHead>DAY CUTTING</TableHead>
                      <TableHead>DAY INPUT</TableHead>
                      <TableHead>BALANCE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                          No data found for selected filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      summaryData.map((d, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{d.date}</TableCell>
                          <TableCell>{d.cuttingNo}</TableCell>
                          <TableCell>{d.lineName}</TableCell>
                          <TableCell>{d.buyer}</TableCell>
                          <TableCell>{d.style}</TableCell>
                          <TableCell>{d.poNo}</TableCell>
                          <TableCell>{d.orderQty.toLocaleString()}</TableCell>
                          <TableCell>
                            {d.target ? (
                              <Badge variant="secondary" className="text-xs">
                                {format(new Date(d.target.submitted_at), "HH:mm")}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">—</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {d.actual ? (
                              <Badge variant="secondary" className="text-xs">
                                {format(new Date(d.actual.submitted_at), "HH:mm")}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">—</Badge>
                            )}
                          </TableCell>
                          <TableCell>{d.actual?.day_cutting?.toLocaleString() || "—"}</TableCell>
                          <TableCell>{d.actual?.day_input?.toLocaleString() || "—"}</TableCell>
                          <TableCell className={d.actual?.balance && d.actual.balance < 0 ? "text-destructive font-medium" : ""}>
                            {d.actual?.balance?.toLocaleString() || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targets">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Cutting Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DATE</TableHead>
                      <TableHead>CUTTING NO</TableHead>
                      <TableHead>LINE NO</TableHead>
                      <TableHead>BUYER</TableHead>
                      <TableHead>STYLE</TableHead>
                      <TableHead>PO-NO</TableHead>
                      <TableHead>COLOUR</TableHead>
                      <TableHead>ORDER QTY</TableHead>
                      <TableHead>MAN POWER</TableHead>
                      <TableHead>MARKER CAP.</TableHead>
                      <TableHead>LAY CAP.</TableHead>
                      <TableHead>CUTTING CAP.</TableHead>
                      <TableHead>UNDER QTY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTargets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                          No targets found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTargets.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{t.production_date}</TableCell>
                          <TableCell>{t.cutting_sections?.cutting_no}</TableCell>
                          <TableCell>{t.lines?.name || t.lines?.line_id}</TableCell>
                          <TableCell>{t.buyer}</TableCell>
                          <TableCell>{t.style}</TableCell>
                          <TableCell>{t.po_no}</TableCell>
                          <TableCell>{t.colour || "—"}</TableCell>
                          <TableCell>{t.order_qty.toLocaleString()}</TableCell>
                          <TableCell>{t.man_power}</TableCell>
                          <TableCell>{t.marker_capacity}</TableCell>
                          <TableCell>{t.lay_capacity}</TableCell>
                          <TableCell>{t.cutting_capacity}</TableCell>
                          <TableCell>{t.under_qty}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actuals">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Cutting Actuals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DATE</TableHead>
                      <TableHead>CUTTING NO</TableHead>
                      <TableHead>LINE NO</TableHead>
                      <TableHead>BUYER</TableHead>
                      <TableHead>STYLE</TableHead>
                      <TableHead>PO-NO</TableHead>
                      <TableHead>COLOUR</TableHead>
                      <TableHead>ORDER QTY</TableHead>
                      <TableHead>DAY CUTTING</TableHead>
                      <TableHead>TOTAL CUTTING</TableHead>
                      <TableHead>DAY INPUT</TableHead>
                      <TableHead>TOTAL INPUT</TableHead>
                      <TableHead>BALANCE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActuals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                          No actuals found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredActuals.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.production_date}</TableCell>
                          <TableCell>{a.cutting_sections?.cutting_no}</TableCell>
                          <TableCell>{a.lines?.name || a.lines?.line_id}</TableCell>
                          <TableCell>{a.buyer}</TableCell>
                          <TableCell>{a.style}</TableCell>
                          <TableCell>{a.po_no}</TableCell>
                          <TableCell>{a.colour || "—"}</TableCell>
                          <TableCell>{a.order_qty.toLocaleString()}</TableCell>
                          <TableCell>{a.day_cutting}</TableCell>
                          <TableCell>{a.total_cutting}</TableCell>
                          <TableCell>{a.day_input}</TableCell>
                          <TableCell>{a.total_input}</TableCell>
                          <TableCell className={a.balance < 0 ? "text-destructive font-medium" : ""}>
                            {a.balance}
                          </TableCell>
                        </TableRow>
                      ))
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
