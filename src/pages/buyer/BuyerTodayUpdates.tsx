import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useBuyerPOAccess } from "@/hooks/useBuyerPOAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarDays, Package, Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { format, subDays } from "date-fns";
import { getTodayInTimezone, formatTimeInTimezone } from "@/lib/date-utils";

interface SewingRow {
  id: string;
  work_order_id: string;
  production_date: string;
  good_today: number;
  reject_today: number;
  rework_today: number;
  cumulative_good_total: number;
  submitted_at: string | null;
  work_orders: { po_number: string; style: string } | null;
}

interface CuttingRow {
  id: string;
  work_order_id: string;
  production_date: string;
  day_cutting: number;
  day_input: number;
  balance: number | null;
  submitted_at: string | null;
  work_orders: { po_number: string; style: string } | null;
}

interface FinishingRow {
  id: string;
  work_order_id: string;
  production_date: string;
  day_carton: number | null;
  day_poly: number | null;
  day_qc_pass: number | null;
  total_carton: number | null;
  total_poly: number | null;
  total_qc_pass: number | null;
  submitted_at: string | null;
  work_orders: { po_number: string; style: string } | null;
}

export default function BuyerTodayUpdates() {
  const { factory } = useAuth();
  const { workOrderIds, workOrders, loading: accessLoading } = useBuyerPOAccess();

  const timezone = factory?.timezone || "Asia/Dhaka";
  const todayStr = getTodayInTimezone(timezone);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date(todayStr + "T00:00:00"));
  const [poFilter, setPoFilter] = useState<string>("all");
  const [tab, setTab] = useState("sewing");

  const [sewingData, setSewingData] = useState<SewingRow[]>([]);
  const [cuttingData, setCuttingData] = useState<CuttingRow[]>([]);
  const [finishingData, setFinishingData] = useState<FinishingRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  useEffect(() => {
    if (accessLoading || workOrderIds.length === 0) {
      setDataLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setDataLoading(true);

      const filterIds = poFilter === "all" ? workOrderIds : [poFilter];

      const [sewingRes, cuttingRes, finishingRes] = await Promise.all([
        supabase
          .from("sewing_actuals")
          .select("id, work_order_id, production_date, good_today, reject_today, rework_today, cumulative_good_total, submitted_at, work_orders(po_number, style)")
          .in("work_order_id", filterIds)
          .eq("production_date", dateStr)
          .order("submitted_at", { ascending: false }),
        supabase
          .from("cutting_actuals")
          .select("id, work_order_id, production_date, day_cutting, day_input, balance, submitted_at, work_orders(po_number, style)")
          .in("work_order_id", filterIds)
          .eq("production_date", dateStr)
          .order("submitted_at", { ascending: false }),
        supabase
          .from("finishing_actuals")
          .select("id, work_order_id, production_date, day_carton, day_poly, day_qc_pass, total_carton, total_poly, total_qc_pass, submitted_at, work_orders(po_number, style)")
          .in("work_order_id", filterIds)
          .eq("production_date", dateStr)
          .order("submitted_at", { ascending: false }),
      ]);

      if (cancelled) return;

      setSewingData((sewingRes.data as unknown as SewingRow[]) || []);
      setCuttingData((cuttingRes.data as unknown as CuttingRow[]) || []);
      setFinishingData((finishingRes.data as unknown as FinishingRow[]) || []);
      setDataLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [accessLoading, workOrderIds, dateStr, poFilter]);

  const loading = accessLoading || dataLoading;
  const isToday = dateStr === todayStr;

  // Find POs with no submissions today
  const posWithNoUpdate = useMemo(() => {
    if (!isToday) return [];
    const updatedPOIds = new Set([
      ...sewingData.map((r) => r.work_order_id),
      ...cuttingData.map((r) => r.work_order_id),
      ...finishingData.map((r) => r.work_order_id),
    ]);
    return workOrders.filter(
      (wo) =>
        (poFilter === "all" || wo.id === poFilter) &&
        !updatedPOIds.has(wo.id) &&
        wo.status !== "completed"
    );
  }, [isToday, sewingData, cuttingData, finishingData, workOrders, poFilter]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Today Updates</h1>
          <p className="text-sm text-muted-foreground">
            Daily production submissions for your POs
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* PO filter */}
          <Select value={poFilter} onValueChange={setPoFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by PO" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All POs</SelectItem>
              {workOrders.map((wo) => (
                <SelectItem key={wo.id} value={wo.id}>
                  {wo.po_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, "MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* No update alerts */}
      {posWithNoUpdate.length > 0 && (
        <div className="space-y-2">
          {posWithNoUpdate.map((wo) => (
            <Card key={wo.id} className="border-amber-200 dark:border-amber-800">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <span className="font-medium">{wo.po_number}</span>
                  <span className="text-muted-foreground"> — {wo.style}</span>
                  <span className="text-sm text-amber-600 dark:text-amber-400 ml-2">
                    No update submitted today
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sewing" className="gap-1">
            Sewing
            {sewingData.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {sewingData.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cutting" className="gap-1">
            Cutting
            {cuttingData.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {cuttingData.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="finishing" className="gap-1">
            Finishing
            {finishingData.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {finishingData.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Sewing tab */}
            <TabsContent value="sewing">
              {sewingData.length === 0 ? (
                <EmptyTab label="sewing" date={dateStr} />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead className="text-right">Good Today</TableHead>
                        <TableHead className="text-right">Reject</TableHead>
                        <TableHead className="text-right">Rework</TableHead>
                        <TableHead className="text-right">Cumulative</TableHead>
                        <TableHead className="text-right">Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sewingData.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.work_orders?.po_number || "—"}
                          </TableCell>
                          <TableCell>{row.work_orders?.style || "—"}</TableCell>
                          <TableCell className="text-right font-medium">
                            {row.good_today.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {row.reject_today || 0}
                          </TableCell>
                          <TableCell className="text-right text-amber-600">
                            {row.rework_today || 0}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.cumulative_good_total.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {row.submitted_at
                              ? formatTimeInTimezone(row.submitted_at, timezone)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Cutting tab */}
            <TabsContent value="cutting">
              {cuttingData.length === 0 ? (
                <EmptyTab label="cutting" date={dateStr} />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead className="text-right">Day Cutting</TableHead>
                        <TableHead className="text-right">Day Input</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cuttingData.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.work_orders?.po_number || "—"}
                          </TableCell>
                          <TableCell>{row.work_orders?.style || "—"}</TableCell>
                          <TableCell className="text-right font-medium">
                            {row.day_cutting.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.day_input.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.balance != null ? row.balance.toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {row.submitted_at
                              ? formatTimeInTimezone(row.submitted_at, timezone)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Finishing tab */}
            <TabsContent value="finishing">
              {finishingData.length === 0 ? (
                <EmptyTab label="finishing" date={dateStr} />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead className="text-right">Carton</TableHead>
                        <TableHead className="text-right">Poly</TableHead>
                        <TableHead className="text-right">QC Pass</TableHead>
                        <TableHead className="text-right">Total Carton</TableHead>
                        <TableHead className="text-right">Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finishingData.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.work_orders?.po_number || "—"}
                          </TableCell>
                          <TableCell>{row.work_orders?.style || "—"}</TableCell>
                          <TableCell className="text-right font-medium">
                            {(row.day_carton || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {(row.day_poly || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {(row.day_qc_pass || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {(row.total_carton || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {row.submitted_at
                              ? formatTimeInTimezone(row.submitted_at, timezone)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function EmptyTab({ label, date }: { label: string; date: string }) {
  return (
    <Card className="mt-4">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <CalendarDays className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          No {label} submissions for {format(new Date(date + "T00:00:00"), "MMM d, yyyy")}
        </p>
      </CardContent>
    </Card>
  );
}
