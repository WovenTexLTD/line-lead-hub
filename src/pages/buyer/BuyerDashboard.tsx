import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useBuyerPOAccess } from "@/hooks/useBuyerPOAccess";
import { KPICard } from "@/components/ui/kpi-card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { CompactPOCard } from "@/components/buyer/CompactPOCard";
import { Card, CardContent } from "@/components/ui/card";
import { Package, TrendingUp, Archive, PackageCheck } from "lucide-react";
import { StatsCardsSkeleton } from "@/components/ui/table-skeleton";
import { POAggregates, computeHealth, EMPTY_AGGREGATES } from "@/lib/buyer-health";
import { motion } from "framer-motion";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

interface DashboardMeta {
  lastSubmittedMap: Map<string, string>;
  dailySewingMap: Map<string, number[]>;
  dailyFinishingMap: Map<string, number[]>;
  todayAgg: Map<string, { sewing: number; finishing: number }>;
  yesterdayAgg: Map<string, { sewing: number; finishing: number }>;
}

const EMPTY_META: DashboardMeta = {
  lastSubmittedMap: new Map(),
  dailySewingMap: new Map(),
  dailyFinishingMap: new Map(),
  todayAgg: new Map(),
  yesterdayAgg: new Map(),
};

export default function BuyerDashboard() {
  const navigate = useNavigate();
  const { factory } = useAuth();
  const { workOrderIds, workOrders, loading: accessLoading } = useBuyerPOAccess();
  const [aggregates, setAggregates] = useState<Map<string, POAggregates>>(new Map());
  const [meta, setMeta] = useState<DashboardMeta>(EMPTY_META);
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
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

      const [sewingRes, finishingRes, cuttingRes] = await Promise.all([
        supabase
          .from("sewing_actuals")
          .select("work_order_id, good_today, reject_today, rework_today, cumulative_good_total, production_date, submitted_at")
          .in("work_order_id", workOrderIds),
        supabase
          .from("finishing_actuals")
          .select("work_order_id, day_carton, day_poly, day_qc_pass, total_carton, total_poly, total_qc_pass, production_date, submitted_at")
          .in("work_order_id", workOrderIds),
        supabase
          .from("cutting_actuals")
          .select("work_order_id, day_cutting, day_input, production_date, submitted_at")
          .in("work_order_id", workOrderIds),
      ]);

      if (cancelled) return;

      const aggMap = new Map<string, POAggregates>();
      const submitMap = new Map<string, string>();
      const sewDailyRaw = new Map<string, Map<string, number>>();
      const finDailyRaw = new Map<string, Map<string, number>>();
      const todayAgg = new Map<string, { sewing: number; finishing: number }>();
      const yesterdayAgg = new Map<string, { sewing: number; finishing: number }>();

      // Initialize
      for (const woId of workOrderIds) {
        aggMap.set(woId, { ...EMPTY_AGGREGATES });
        todayAgg.set(woId, { sewing: 0, finishing: 0 });
        yesterdayAgg.set(woId, { sewing: 0, finishing: 0 });
      }

      // Aggregate sewing
      for (const row of sewingRes.data || []) {
        const agg = aggMap.get(row.work_order_id);
        if (!agg) continue;
        agg.sewingOutput += row.good_today || 0;
        agg.rejectTotal += row.reject_today || 0;
        agg.reworkTotal += row.rework_today || 0;
        if ((row.cumulative_good_total || 0) > agg.cumulativeGood) {
          agg.cumulativeGood = row.cumulative_good_total || 0;
        }
        if (row.production_date === today) {
          agg.hasEodToday = true;
          const t = todayAgg.get(row.work_order_id);
          if (t) t.sewing += row.good_today || 0;
        }
        if (row.production_date === yesterday) {
          const y = yesterdayAgg.get(row.work_order_id);
          if (y) y.sewing += row.good_today || 0;
        }
        // Track last submitted
        if (row.submitted_at) {
          const prev = submitMap.get(row.work_order_id);
          if (!prev || row.submitted_at > prev) {
            submitMap.set(row.work_order_id, row.submitted_at);
          }
        }
        // Daily sewing for sparkline
        if (!sewDailyRaw.has(row.work_order_id)) {
          sewDailyRaw.set(row.work_order_id, new Map());
        }
        const dayMap = sewDailyRaw.get(row.work_order_id)!;
        dayMap.set(
          row.production_date,
          (dayMap.get(row.production_date) || 0) + (row.good_today || 0)
        );
      }

      // Aggregate finishing
      for (const row of finishingRes.data || []) {
        const agg = aggMap.get(row.work_order_id);
        if (!agg) continue;
        agg.finishingCarton += row.day_carton || 0;
        agg.finishingPoly += row.day_poly || 0;
        agg.finishingQcPass += row.day_qc_pass || 0;
        if (row.production_date === today) {
          const t = todayAgg.get(row.work_order_id);
          if (t) t.finishing += row.day_carton || 0;
        }
        if (row.production_date === yesterday) {
          const y = yesterdayAgg.get(row.work_order_id);
          if (y) y.finishing += row.day_carton || 0;
        }
        if (row.submitted_at) {
          const prev = submitMap.get(row.work_order_id);
          if (!prev || row.submitted_at > prev) {
            submitMap.set(row.work_order_id, row.submitted_at);
          }
        }
        if (!finDailyRaw.has(row.work_order_id)) {
          finDailyRaw.set(row.work_order_id, new Map());
        }
        const dayMap = finDailyRaw.get(row.work_order_id)!;
        dayMap.set(
          row.production_date,
          (dayMap.get(row.production_date) || 0) + (row.day_carton || 0)
        );
      }

      // Aggregate cutting
      for (const row of cuttingRes.data || []) {
        const agg = aggMap.get(row.work_order_id);
        if (!agg) continue;
        agg.cuttingTotal += row.day_cutting || 0;
        agg.cuttingInput += row.day_input || 0;
        if (row.submitted_at) {
          const prev = submitMap.get(row.work_order_id);
          if (!prev || row.submitted_at > prev) {
            submitMap.set(row.work_order_id, row.submitted_at);
          }
        }
      }

      // Convert daily maps to sorted arrays (last 7 days)
      const dailySewing = new Map<string, number[]>();
      for (const [woId, dayMap] of sewDailyRaw) {
        dailySewing.set(
          woId,
          [...dayMap.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-7)
            .map(([, v]) => v)
        );
      }
      const dailyFinishing = new Map<string, number[]>();
      for (const [woId, dayMap] of finDailyRaw) {
        dailyFinishing.set(
          woId,
          [...dayMap.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-7)
            .map(([, v]) => v)
        );
      }

      setAggregates(aggMap);
      setMeta({
        lastSubmittedMap: submitMap,
        dailySewingMap: dailySewing,
        dailyFinishingMap: dailyFinishing,
        todayAgg,
        yesterdayAgg,
      });
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
    let totalSewed = 0;
    let totalPacked = 0;

    for (const wo of workOrders) {
      totalQty += wo.order_qty || 0;
      const agg = aggregates.get(wo.id);
      if (agg) {
        totalSewed += agg.cumulativeGood;
        totalPacked += agg.finishingCarton;
      }
    }

    return {
      totalPOs: workOrders.length,
      totalQty,
      totalSewed,
      totalPacked,
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
          ))}
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
      <motion.div
        className="grid gap-4 grid-cols-2 lg:grid-cols-4"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUp}>
          <KPICard
            title="Active POs"
            value={<AnimatedNumber value={kpis.totalPOs} />}
            icon={Package}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <KPICard
            title="Total Order Qty"
            value={<AnimatedNumber value={kpis.totalQty} />}
            icon={Archive}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <KPICard
            title="Total Sewn"
            value={<AnimatedNumber value={kpis.totalSewed} />}
            icon={TrendingUp}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <KPICard
            title="Total Packed"
            value={<AnimatedNumber value={kpis.totalPacked} />}
            icon={PackageCheck}
          />
        </motion.div>
      </motion.div>

      {/* PO Cards — Uniform Grid */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {workOrders.map((wo) => {
          const agg = aggregates.get(wo.id) || EMPTY_AGGREGATES;
          const health = computeHealth(wo, agg);
          const tAgg = meta.todayAgg.get(wo.id);
          const yAgg = meta.yesterdayAgg.get(wo.id);
          return (
            <motion.div key={wo.id} variants={fadeUp}>
              <CompactPOCard
                wo={wo}
                agg={agg}
                health={health}
                todaySewing={tAgg?.sewing ?? 0}
                todayFinishing={tAgg?.finishing ?? 0}
                yesterdaySewing={yAgg?.sewing}
                yesterdayFinishing={yAgg?.finishing}
                onClick={() => navigate(`/buyer/po/${wo.id}`)}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
