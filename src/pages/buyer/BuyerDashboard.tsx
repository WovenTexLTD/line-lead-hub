import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useBuyerPOAccess, BuyerWorkOrder } from "@/hooks/useBuyerPOAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Package, Scissors, TrendingUp, Archive, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { StatsCardsSkeleton } from "@/components/ui/table-skeleton";
import { formatShortDate } from "@/lib/date-utils";

interface POAggregates {
  sewingOutput: number;
  cumulativeGood: number;
  rejectTotal: number;
  reworkTotal: number;
  finishingCarton: number;
  finishingPoly: number;
  finishingQcPass: number;
  cuttingTotal: number;
  cuttingInput: number;
  hasEodToday: boolean;
}

type HealthStatus = "healthy" | "watch" | "at_risk" | "no_deadline" | "completed";

function computeHealth(
  wo: BuyerWorkOrder,
  agg: POAggregates
): { status: HealthStatus; label: string } {
  const progressPct = wo.order_qty > 0 ? (agg.cumulativeGood / wo.order_qty) * 100 : 0;

  if (progressPct >= 100) return { status: "completed", label: "Completed" };

  if (!wo.planned_ex_factory) return { status: "no_deadline", label: "No deadline" };

  const deadline = new Date(wo.planned_ex_factory);
  const now = new Date();
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { status: "at_risk", label: "Deadline passed" };
  if (daysLeft <= 7 && progressPct < 80) return { status: "at_risk", label: "At risk" };
  if (daysLeft <= 14 && progressPct < 60) return { status: "watch", label: "Watch" };
  if (!agg.hasEodToday) return { status: "watch", label: "No update today" };

  return { status: "healthy", label: "On track" };
}

const healthColors: Record<HealthStatus, string> = {
  healthy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  watch: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  at_risk: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  no_deadline: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function BuyerDashboard() {
  const { factory } = useAuth();
  const { workOrderIds, workOrders, loading: accessLoading } = useBuyerPOAccess();
  const [aggregates, setAggregates] = useState<Map<string, POAggregates>>(new Map());
  const [dataLoading, setDataLoading] = useState(true);

  const timezone = factory?.timezone || "Asia/Dhaka";

  useEffect(() => {
    if (accessLoading || workOrderIds.length === 0) {
      setDataLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAggregates() {
      setDataLoading(true);

      const today = new Date().toISOString().split("T")[0];

      const [sewingRes, finishingRes, cuttingRes] = await Promise.all([
        supabase
          .from("sewing_actuals")
          .select("work_order_id, good_today, reject_today, rework_today, cumulative_good_total, production_date")
          .in("work_order_id", workOrderIds),
        supabase
          .from("finishing_actuals")
          .select("work_order_id, day_carton, day_poly, day_qc_pass, total_carton, total_poly, total_qc_pass, production_date")
          .in("work_order_id", workOrderIds),
        supabase
          .from("cutting_actuals")
          .select("work_order_id, day_cutting, day_input, production_date")
          .in("work_order_id", workOrderIds),
      ]);

      if (cancelled) return;

      const aggMap = new Map<string, POAggregates>();

      // Initialize with zeros for all POs
      for (const woId of workOrderIds) {
        aggMap.set(woId, {
          sewingOutput: 0,
          cumulativeGood: 0,
          rejectTotal: 0,
          reworkTotal: 0,
          finishingCarton: 0,
          finishingPoly: 0,
          finishingQcPass: 0,
          cuttingTotal: 0,
          cuttingInput: 0,
          hasEodToday: false,
        });
      }

      // Aggregate sewing
      for (const row of sewingRes.data || []) {
        const agg = aggMap.get(row.work_order_id);
        if (!agg) continue;
        agg.sewingOutput += row.good_today || 0;
        agg.rejectTotal += row.reject_today || 0;
        agg.reworkTotal += row.rework_today || 0;
        // Use the max cumulative value
        if ((row.cumulative_good_total || 0) > agg.cumulativeGood) {
          agg.cumulativeGood = row.cumulative_good_total || 0;
        }
        if (row.production_date === today) {
          agg.hasEodToday = true;
        }
      }

      // Aggregate finishing — use totals from latest record
      for (const row of finishingRes.data || []) {
        const agg = aggMap.get(row.work_order_id);
        if (!agg) continue;
        agg.finishingCarton += row.day_carton || 0;
        agg.finishingPoly += row.day_poly || 0;
        agg.finishingQcPass += row.day_qc_pass || 0;
      }

      // Aggregate cutting
      for (const row of cuttingRes.data || []) {
        const agg = aggMap.get(row.work_order_id);
        if (!agg) continue;
        agg.cuttingTotal += row.day_cutting || 0;
        agg.cuttingInput += row.day_input || 0;
      }

      setAggregates(aggMap);
      setDataLoading(false);
    }

    fetchAggregates();
    return () => {
      cancelled = true;
    };
  }, [accessLoading, workOrderIds]);

  // Compute KPIs
  const kpis = useMemo(() => {
    let totalQty = 0;
    let totalSewingOutput = 0;
    let totalFinishingOutput = 0;
    let totalCutting = 0;

    for (const wo of workOrders) {
      totalQty += wo.order_qty || 0;
      const agg = aggregates.get(wo.id);
      if (agg) {
        totalSewingOutput += agg.cumulativeGood;
        totalFinishingOutput += agg.finishingCarton + agg.finishingPoly;
        totalCutting += agg.cuttingTotal;
      }
    }

    return {
      totalPOs: workOrders.length,
      totalQty,
      totalSewingOutput,
      totalFinishingOutput,
      totalCutting,
    };
  }, [workOrders, aggregates]);

  const loading = accessLoading || dataLoading;

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">PO Overview</h1>
          <p className="text-sm text-muted-foreground">
            Track the production status of your purchase orders
          </p>
        </div>
        <StatsCardsSkeleton count={4} />
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (workOrders.length === 0) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">PO Overview</h1>
          <p className="text-sm text-muted-foreground">
            Track the production status of your purchase orders
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No POs Assigned</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              You don't have any purchase orders assigned to your account yet.
              Please contact your factory administrator to get access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">PO Overview</h1>
        <p className="text-sm text-muted-foreground">
          Track the production status of your purchase orders
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active POs
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalPOs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Order Qty
            </CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.totalQty.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sewing Output
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.totalSewingOutput.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cutting Output
            </CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.totalCutting.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PO Cards */}
      <div className="space-y-4">
        {workOrders.map((wo) => {
          const agg = aggregates.get(wo.id) || {
            sewingOutput: 0,
            cumulativeGood: 0,
            rejectTotal: 0,
            reworkTotal: 0,
            finishingCarton: 0,
            finishingPoly: 0,
            finishingQcPass: 0,
            cuttingTotal: 0,
            cuttingInput: 0,
            hasEodToday: false,
          };
          const progressPct =
            wo.order_qty > 0
              ? Math.min(100, Math.round((agg.cumulativeGood / wo.order_qty) * 100))
              : 0;
          const health = computeHealth(wo, agg);
          const balance = Math.max(0, wo.order_qty - agg.cumulativeGood);

          return (
            <Card key={wo.id}>
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col gap-4">
                  {/* Header row */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold">{wo.po_number}</h3>
                        <Badge
                          variant="outline"
                          className={healthColors[health.status]}
                        >
                          {health.label}
                        </Badge>
                        {wo.status && (
                          <Badge variant="secondary" className="text-xs">
                            {wo.status.replace("_", " ")}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {wo.style}
                        {wo.color && ` — ${wo.color}`}
                        {wo.item && ` — ${wo.item}`}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">
                        Order: {wo.order_qty.toLocaleString()} pcs
                      </div>
                      {wo.planned_ex_factory && (
                        <div className="text-muted-foreground flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3" />
                          Ex-factory: {formatShortDate(wo.planned_ex_factory)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">
                        Sewing Progress
                      </span>
                      <span className="font-medium">
                        {agg.cumulativeGood.toLocaleString()} /{" "}
                        {wo.order_qty.toLocaleString()} ({progressPct}%)
                      </span>
                    </div>
                    <Progress value={progressPct} className="h-2" />
                    <div className="text-xs text-muted-foreground mt-1">
                      Balance: {balance.toLocaleString()} pcs remaining
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        Cutting
                      </div>
                      <div className="text-lg font-semibold">
                        {agg.cuttingTotal.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Input: {agg.cuttingInput.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        Sewing Today
                      </div>
                      <div className="text-lg font-semibold">
                        {agg.sewingOutput.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Cumulative: {agg.cumulativeGood.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        Finishing
                      </div>
                      <div className="text-lg font-semibold">
                        {(agg.finishingCarton + agg.finishingPoly).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        QC Pass: {agg.finishingQcPass.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        Quality
                      </div>
                      <div className="text-lg font-semibold flex items-center gap-1">
                        {agg.rejectTotal > 0 ? (
                          <>
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            {agg.rejectTotal.toLocaleString()}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            OK
                          </>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Reject: {agg.rejectTotal} | Rework: {agg.reworkTotal}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
