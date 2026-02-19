import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatShortDate, formatTimeInTimezone } from "@/lib/date-utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Search, ClipboardList, Eye, Target, TrendingUp, Download, X } from "lucide-react";
import { TableSkeleton, StatsCardsSkeleton } from "@/components/ui/table-skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { FinishingLogDetailModal } from "@/components/FinishingLogDetailModal";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";
import { useSortableTable } from "@/hooks/useSortableTable";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import type { Database } from "@/integrations/supabase/types";

type FinishingLogType = Database["public"]["Enums"]["finishing_log_type"];

interface DailyLogRow {
  id: string;
  production_date: string;
  line_name: string;
  line_id: string;
  po_number: string | null;
  buyer: string | null;
  style: string | null;
  log_type: FinishingLogType;
  thread_cutting: number;
  inside_check: number;
  top_side_check: number;
  buttoning: number;
  iron: number;
  get_up: number;
  poly: number;
  carton: number;
  planned_hours: number | null;
  actual_hours: number | null;
  remarks: string | null;
  submitted_at: string;
  is_locked: boolean;
}

interface FinishingDailySheetsTableProps {
  factoryId: string;
  dateRange: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  activeTab: "targets" | "outputs";
  onCountsChange?: (counts: { targets: number; outputs: number }) => void;
}

export function FinishingDailySheetsTable({
  factoryId,
  dateRange,
  searchTerm,
  onSearchChange,
  activeTab,
  onCountsChange,
}: FinishingDailySheetsTableProps) {
  const { factory } = useAuth();
  const [logs, setLogs] = useState<DailyLogRow[]>([]);

  // Helper to format time in factory timezone
  const formatTime = (dateString: string) => {
    const timezone = factory?.timezone || "Asia/Dhaka";
    return formatTimeInTimezone(dateString, timezone);
  };
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<DailyLogRow | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    fetchLogs();
  }, [factoryId, dateRange]);

  async function fetchLogs() {
    setLoading(true);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(dateRange));

    try {
      const { data, error } = await supabase
        .from("finishing_daily_logs")
        .select(`
          *,
          lines(id, line_id, name),
          work_orders(po_number, buyer, style)
        `)
        .eq("factory_id", factoryId)
        .gte("production_date", startDate.toISOString().split("T")[0])
        .lte("production_date", endDate.toISOString().split("T")[0])
        .order("production_date", { ascending: false })
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      const formatted: DailyLogRow[] = (data || []).map((log: any) => ({
        id: log.id,
        production_date: log.production_date,
        line_name: "",
        line_id: "",
        po_number: log.work_orders?.po_number || null,
        buyer: log.work_orders?.buyer || null,
        style: log.work_orders?.style || null,
        log_type: log.log_type,
        thread_cutting: log.thread_cutting || 0,
        inside_check: log.inside_check || 0,
        top_side_check: log.top_side_check || 0,
        buttoning: log.buttoning || 0,
        iron: log.iron || 0,
        get_up: log.get_up || 0,
        poly: log.poly || 0,
        carton: log.carton || 0,
        planned_hours: log.planned_hours ?? null,
        actual_hours: log.actual_hours ?? null,
        remarks: log.remarks || null,
        submitted_at: log.submitted_at,
        is_locked: log.is_locked,
      }));

      setLogs(formatted);

      if (onCountsChange) {
        const targets = formatted.filter(l => l.log_type === "TARGET").length;
        const outputs = formatted.filter(l => l.log_type === "OUTPUT").length;
        onCountsChange({ targets, outputs });
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesTab = activeTab === "targets" ? log.log_type === "TARGET" : log.log_type === "OUTPUT";
      if (!matchesTab) return false;
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        (log.po_number?.toLowerCase() || "").includes(search) ||
        (log.style?.toLowerCase() || "").includes(search) ||
        (log.buyer?.toLowerCase() || "").includes(search)
      );
    });
  }, [logs, activeTab, searchTerm]);

  const { sortedData, sortConfig, requestSort } = useSortableTable(filteredLogs, { column: "production_date", direction: "desc" });

  const {
    currentPage,
    totalPages,
    paginatedData,
    setCurrentPage,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
    canGoNext,
    canGoPrevious,
    startIndex,
    endIndex,
  } = usePagination(sortedData, { pageSize });

  // Stats based on active tab
  const tabLogs = logs.filter(l => activeTab === "targets" ? l.log_type === "TARGET" : l.log_type === "OUTPUT");
  const totalLogs = tabLogs.length;
  const totalPoly = tabLogs.reduce((sum, l) => sum + l.poly, 0);
  const totalCarton = tabLogs.reduce((sum, l) => sum + l.carton, 0);

  // Daily output trend chart data
  const finishingDailyTrend = useMemo(() => {
    const outputLogs = logs.filter(l => l.log_type === "OUTPUT");
    if (outputLogs.length === 0) return [];
    const byDate: Record<string, { carton: number; poly: number }> = {};
    for (const l of outputLogs) {
      const d = l.production_date;
      if (!byDate[d]) byDate[d] = { carton: 0, poly: 0 };
      byDate[d].carton += l.carton || 0;
      byDate[d].poly += l.poly || 0;
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date,
        displayDate: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        carton: vals.carton,
        poly: vals.poly,
      }));
  }, [logs]);

  const allPageSelected = paginatedData.length > 0 && paginatedData.every(l => selectedIds.has(l.id));
  const somePageSelected = paginatedData.some(l => selectedIds.has(l.id));

  function toggleSelectAll() {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginatedData.forEach(l => next.delete(l.id));
      } else {
        paginatedData.forEach(l => next.add(l.id));
      }
      return next;
    });
  }

  function toggleSelectRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportSelectedCsv() {
    const rows = sortedData.filter(l => selectedIds.has(l.id));
    const headers = ["Date", "PO", "Buyer", "Style", "Type", "Thread Cutting", "Inside Check", "Top Side Check", "Buttoning", "Iron", "Get Up", "Poly", "Carton", "Planned Hours", "Actual Hours"];
    const csvRows = [headers.join(",")];
    rows.forEach(l => {
      csvRows.push([
        l.production_date,
        `"${l.po_number || ""}"`,
        `"${l.buyer || ""}"`,
        `"${l.style || ""}"`,
        l.log_type,
        l.thread_cutting,
        l.inside_check,
        l.top_side_check,
        l.buttoning,
        l.iron,
        l.get_up,
        l.poly,
        l.carton,
        l.planned_hours ?? "",
        l.actual_hours ?? "",
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finishing-${activeTab}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <StatsCardsSkeleton count={3} />
        <TableSkeleton columns={7} rows={6} headers={["Date", "PO / Style", "Buyer", "Poly", "Carton", "Status", ""]} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalLogs}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeTab === "targets" ? "Targets" : "Outputs"}
                    </p>
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
                    <p className="text-xs text-muted-foreground">Total Poly</p>
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
                    <p className="text-xs text-muted-foreground">Total Cartons</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Output Trend Chart */}
          {finishingDailyTrend.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Daily Output Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={finishingDailyTrend}>
                    <defs>
                      <linearGradient id="colorFinishingCarton" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="displayDate" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={40} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="carton"
                      name="Carton"
                      stroke="hsl(var(--primary))"
                      fill="url(#colorFinishingCarton)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="poly"
                      name="Poly"
                      stroke="hsl(var(--destructive))"
                      fill="hsl(var(--destructive))"
                      fillOpacity={0.1}
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by PO, buyer, or style..."
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
                {activeTab === "targets" ? "Daily Targets" : "Daily Outputs"}
                <Badge variant="secondary" className="ml-2">
                  {filteredLogs.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-b">
                  <span className="text-sm font-medium">{selectedIds.size} selected</span>
                  <Button variant="outline" size="sm" onClick={exportSelectedCsv}>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Export CSV
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Clear
                  </Button>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={allPageSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                          {...(somePageSelected && !allPageSelected ? { "data-state": "indeterminate" } : {})}
                        />
                      </TableHead>
                      <SortableTableHead column="production_date" sortConfig={sortConfig} onSort={requestSort}>Date</SortableTableHead>
                      <TableHead>PO / Style</TableHead>
                      <SortableTableHead column="buyer" sortConfig={sortConfig} onSort={requestSort}>Buyer</SortableTableHead>
                      <SortableTableHead column="poly" sortConfig={sortConfig} onSort={requestSort} className="text-right">Poly</SortableTableHead>
                      <SortableTableHead column="carton" sortConfig={sortConfig} onSort={requestSort} className="text-right">Carton</SortableTableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {paginatedData.map((log) => (
                        <TableRow
                          key={log.id}
                          className={`hover:bg-muted/50 cursor-pointer ${selectedIds.has(log.id) ? "bg-primary/5" : ""}`}
                          onClick={() => {
                            setSelectedLog(log);
                            setDetailModalOpen(true);
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(log.id)}
                              onCheckedChange={() => toggleSelectRow(log.id)}
                              aria-label={`Select row`}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-mono text-sm">{formatShortDate(log.production_date)}</p>
                              <p className="text-xs text-muted-foreground">{formatTime(log.submitted_at)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{log.po_number || "-"}</p>
                              <p className="text-xs text-muted-foreground">{log.style || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell>{log.buyer || "-"}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono font-bold text-success">
                              {log.poly.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono font-bold text-warning">
                              {log.carton.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm">
                              {activeTab === "targets"
                                ? (log.planned_hours != null ? `${log.planned_hours}h` : "—")
                                : (log.actual_hours != null ? `${log.actual_hours}h` : "—")}
                            </span>
                          </TableCell>
                          <TableCell>
                            {log.is_locked ? (
                              <Badge variant="secondary">Locked</Badge>
                            ) : (
                              <Badge variant="default" className="bg-success hover:bg-success/90">
                                Submitted
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No {activeTab === "targets" ? "targets" : "outputs"} found</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={filteredLogs.length}
                onPageChange={setCurrentPage}
                onFirstPage={goToFirstPage}
                onLastPage={goToLastPage}
                onNextPage={goToNextPage}
                onPreviousPage={goToPreviousPage}
                canGoNext={canGoNext}
                canGoPrevious={canGoPrevious}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            </CardContent>
          </Card>
      {/* Finishing Log Detail Modal */}
      <FinishingLogDetailModal
        log={selectedLog ? {
          id: selectedLog.id,
          production_date: selectedLog.production_date,
          line_id: selectedLog.line_id,
          work_order_id: null,
          log_type: selectedLog.log_type,
          shift: null,
          thread_cutting: selectedLog.thread_cutting,
          inside_check: selectedLog.inside_check,
          top_side_check: selectedLog.top_side_check,
          buttoning: selectedLog.buttoning,
          iron: selectedLog.iron,
          get_up: selectedLog.get_up,
          poly: selectedLog.poly,
          carton: selectedLog.carton,
          planned_hours: selectedLog.planned_hours,
          actual_hours: selectedLog.actual_hours,
          remarks: selectedLog.remarks,
          ot_hours_actual: (selectedLog as any).ot_hours_actual ?? null,
          ot_manpower_actual: (selectedLog as any).ot_manpower_actual ?? null,
          ot_hours_planned: (selectedLog as any).ot_hours_planned ?? null,
          ot_manpower_planned: (selectedLog as any).ot_manpower_planned ?? null,
          submitted_at: selectedLog.submitted_at,
          is_locked: selectedLog.is_locked,
          line: null,
          work_order: selectedLog.po_number ? {
            po_number: selectedLog.po_number,
            style: selectedLog.style || "",
            buyer: selectedLog.buyer || ""
          } : null
        } : null}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </div>
  );
}
