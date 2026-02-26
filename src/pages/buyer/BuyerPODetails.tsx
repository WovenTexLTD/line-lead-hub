import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBuyerPODetails } from "@/hooks/useBuyerPODetails";
import { computeHealth, healthColors } from "@/lib/buyer-health";
import { computeBuyerAlerts, sortAlerts } from "@/lib/buyer-alerts";
import { formatTimeInTimezone, formatShortDate } from "@/lib/date-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  Loader2,
  ArrowLeft,
  Clock,
  Download,
  AlertTriangle,
  Package,
  Scissors,
  TrendingUp,
  PackageCheck,
  Warehouse,
} from "lucide-react";
import { motion } from "framer-motion";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { format } from "date-fns";

const DEPT_COLORS: Record<string, string> = {
  sewing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  cutting: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  finishing: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  storage: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
  info: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
};

export default function BuyerPODetails() {
  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"7" | "14" | "30">("14");

  const {
    workOrder,
    aggregates,
    trendData,
    todayTimeline,
    stageData,
    sewingHistory,
    loading,
    error,
    isAuthorized,
    timezone,
    todayStr,
  } = useBuyerPODetails(poId);

  // Filter trend data by period
  const filteredTrend = useMemo(() => {
    const days = parseInt(period);
    return trendData.slice(-days);
  }, [trendData, period]);

  // Compute alerts
  const alerts = useMemo(() => {
    if (!workOrder) return [];
    return sortAlerts(computeBuyerAlerts(workOrder, aggregates, sewingHistory));
  }, [workOrder, aggregates, sewingHistory]);

  // CSV export
  const handleExport = () => {
    if (!workOrder) return;
    let csv = `PO Report: ${workOrder.po_number}\n`;
    csv += `Style,${workOrder.style}\n`;
    csv += `Color,${workOrder.color || ""}\n`;
    csv += `Order Qty,${workOrder.order_qty}\n`;
    csv += `Ex-Factory,${workOrder.planned_ex_factory || ""}\n`;
    csv += `Cumulative Sewed,${aggregates.cumulativeGood}\n`;
    csv += `Total Packed,${aggregates.finishingCarton}\n\n`;

    csv += `Date,Sewing Output,Finishing Output\n`;
    for (const d of trendData) {
      csv += `${d.date},${d.sewingOutput},${d.finishingOutput}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `po-report-${workOrder.po_number}-${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (loading) {
    return (
      <div className="py-4 lg:py-6 flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !isAuthorized || !workOrder) {
    return (
      <div className="py-4 lg:py-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/buyer/dashboard")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Overview
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">PO Not Found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {error || "This purchase order doesn't exist or you don't have access to it."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const health = computeHealth(workOrder, aggregates);
  const producedPct = workOrder.order_qty > 0 ? Math.min(100, Math.round((aggregates.cumulativeGood / workOrder.order_qty) * 100)) : 0;
  const packedPct = workOrder.order_qty > 0 ? Math.min(100, Math.round((aggregates.finishingPoly / workOrder.order_qty) * 100)) : 0;

  return (
    <motion.div
      className="py-4 lg:py-6 space-y-6"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Back + Header */}
      <motion.div className="flex flex-col gap-4" variants={fadeUp}>
        <Button variant="ghost" size="sm" onClick={() => navigate("/buyer/dashboard")} className="gap-2 self-start -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to Overview
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{workOrder.po_number}</h1>
              <Badge variant="outline" className={healthColors[health.status]}>{health.label}</Badge>
              {workOrder.status && <Badge variant="secondary" className="text-xs">{workOrder.status.replace("_", " ")}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {workOrder.style}
              {workOrder.color && ` — ${workOrder.color}`}
              {workOrder.item && ` — ${workOrder.item}`}
            </p>
          </div>
          <div className="text-right text-sm flex flex-col gap-1">
            <div className="font-medium">Order: {workOrder.order_qty.toLocaleString()} pcs</div>
            {workOrder.planned_ex_factory && (
              <div className="text-muted-foreground flex items-center gap-1 justify-end">
                <Clock className="h-3 w-3" />
                Ex-factory: {formatShortDate(workOrder.planned_ex_factory)}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 mt-1">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Progress Bars */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={fadeUp}>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-blue-500" /> Sewn
              </span>
              <span className="text-muted-foreground">
                {aggregates.cumulativeGood.toLocaleString()} / {workOrder.order_qty.toLocaleString()} ({producedPct}%)
              </span>
            </div>
            <Progress value={producedPct} className="h-3" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium flex items-center gap-1.5">
                <PackageCheck className="h-4 w-4 text-emerald-500" /> Packed
              </span>
              <span className="text-muted-foreground">
                {aggregates.finishingCarton.toLocaleString()} / {workOrder.order_qty.toLocaleString()} ({packedPct}%)
              </span>
            </div>
            <Progress value={packedPct} className="h-3" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Stage Cards */}
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3" variants={fadeUp}>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Warehouse className="h-3.5 w-3.5" /> Storage
            </div>
            <div className="text-lg font-bold">{stageData.storage.todayReceived > 0 ? <span>+<AnimatedNumber value={stageData.storage.todayReceived} /></span> : "—"}</div>
            <div className="text-xs text-muted-foreground">Balance: {stageData.storage.balance.toLocaleString()}</div>
            {stageData.storage.lastUpdate && (
              <div className="text-[10px] text-muted-foreground/70 mt-1">{formatTimeInTimezone(stageData.storage.lastUpdate, timezone)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Scissors className="h-3.5 w-3.5" /> Cutting
            </div>
            <div className="text-lg font-bold">{stageData.cutting.todayCut > 0 ? <AnimatedNumber value={stageData.cutting.todayCut} /> : "—"}</div>
            <div className="text-xs text-muted-foreground">Total: {stageData.cutting.totalCut.toLocaleString()}</div>
            {stageData.cutting.lastUpdate && (
              <div className="text-[10px] text-muted-foreground/70 mt-1">{formatTimeInTimezone(stageData.cutting.lastUpdate, timezone)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <TrendingUp className="h-3.5 w-3.5" /> Sewing
            </div>
            <div className="text-lg font-bold">{stageData.sewing.todayOutput > 0 ? <AnimatedNumber value={stageData.sewing.todayOutput} /> : "—"}</div>
            <div className="text-xs text-muted-foreground">Cumulative: {stageData.sewing.cumulative.toLocaleString()}</div>
            {stageData.sewing.lastUpdate && (
              <div className="text-[10px] text-muted-foreground/70 mt-1">{formatTimeInTimezone(stageData.sewing.lastUpdate, timezone)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <PackageCheck className="h-3.5 w-3.5" /> Finishing
            </div>
            <div className="text-lg font-bold">{stageData.finishing.todayPoly > 0 ? <AnimatedNumber value={stageData.finishing.todayPoly} /> : "—"}</div>
            <div className="text-xs text-muted-foreground">Total: {stageData.finishing.totalPoly.toLocaleString()}</div>
            {stageData.finishing.lastUpdate && (
              <div className="text-[10px] text-muted-foreground/70 mt-1">{formatTimeInTimezone(stageData.finishing.lastUpdate, timezone)}</div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Risks & Flags */}
      {alerts.length > 0 && (
        <motion.div className="space-y-2" variants={fadeUp}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Risks & Flags</h2>
          {alerts.map((alert, i) => (
            <Card key={i} className={SEVERITY_COLORS[alert.severity]}>
              <CardContent className="flex items-start gap-3 p-3">
                <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${alert.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
                <div>
                  <div className="text-sm font-medium">{alert.title}</div>
                  <div className="text-xs text-muted-foreground">{alert.message}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Trend Chart */}
      <motion.div variants={fadeUp}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Production Trend</CardTitle>
            <div className="flex gap-1">
              {(["7", "14", "30"] as const).map((p) => (
                <Button key={p} variant={period === p ? "default" : "outline"} size="sm" className="h-7 text-xs px-2.5" onClick={() => setPeriod(p)}>
                  {p}d
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          {filteredTrend.length > 0 ? (
            <div className="w-full overflow-hidden">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={filteredTrend}>
                  <defs>
                    <linearGradient id="colorSewing" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFinishing" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="displayDate" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={40} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Legend wrapperStyle={{ paddingTop: "8px" }} />
                  <Area type="monotone" dataKey="sewingOutput" name="Sewing" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorSewing)" strokeWidth={2} />
                  <Area type="monotone" dataKey="finishingOutput" name="Finishing" stroke="#10b981" fillOpacity={1} fill="url(#colorFinishing)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">No data available for this period</div>
          )}
        </CardContent>
      </Card>
      </motion.div>

      {/* Today Timeline */}
      <motion.div variants={fadeUp}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today's Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {todayTimeline.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No submissions today</div>
          ) : (
            <div className="space-y-3">
              {todayTimeline.map((entry, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 ${DEPT_COLORS[entry.department]}`}>
                    {entry.department}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{entry.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.time ? formatTimeInTimezone(entry.time, timezone) : "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </motion.div>
    </motion.div>
  );
}
