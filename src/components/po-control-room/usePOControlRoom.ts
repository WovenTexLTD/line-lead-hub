import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { differenceInDays } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getTodayInTimezone } from "@/lib/date-utils";
import type {
  POViewTab,
  POControlRoomData,
  POKPIs,
  NeedsActionCard,
  HealthReason,
  HealthStatus,
  PODetailData,
  POSubmissionRow,
  POPipelineStage,
  POQualityData,
} from "./types";
import {
  ClipboardX,
  CalendarClock,
  Unlink,
  AlertTriangle,
} from "lucide-react";

// ── Health computation ────────────────────────────────
function computeHealth(
  po: {
    status: string | null;
    planned_ex_factory: string | null;
    line_names: string[];
    line_id: string | null;
    finishedOutput: number;
    order_qty: number;
    sewingOutput: number;
    totalRejects: number;
    totalRework: number;
    hasEodToday: boolean;
  },
  today: string
): HealthReason {
  const progressPct =
    po.order_qty > 0
      ? Math.min((po.finishedOutput / po.order_qty) * 100, 100)
      : 0;

  const daysToExFactory = po.planned_ex_factory
    ? differenceInDays(new Date(po.planned_ex_factory), new Date(today))
    : null;

  // Completed: progress >= 100%
  if (progressPct >= 100) {
    return { status: "completed", reasons: ["Order fulfilled"] };
  }

  // Deadline passed: ex-factory date is in the past and not complete
  if (daysToExFactory !== null && daysToExFactory < 0) {
    return {
      status: "deadline_passed",
      reasons: [`Deadline passed ${Math.abs(daysToExFactory)} day${Math.abs(daysToExFactory) !== 1 ? "s" : ""} ago, ${Math.round(progressPct)}% done`],
    };
  }

  const reasons: string[] = [];
  let status: HealthStatus = "healthy";

  const rejectRate =
    po.sewingOutput > 0 ? (po.totalRejects / po.sewingOutput) * 100 : 0;

  const isActive =
    po.status === "in_progress" || po.status === "not_started";
  const hasLine = po.line_names.length > 0 || po.line_id != null;

  // At Risk conditions (deadline checks don't require isActive)
  if (daysToExFactory !== null && daysToExFactory <= 7 && progressPct < 80) {
    reasons.push(
      `Ex-factory in ${daysToExFactory} day${daysToExFactory !== 1 ? "s" : ""}, only ${Math.round(progressPct)}% done`
    );
    status = "at_risk";
  }
  if (isActive && !hasLine) {
    reasons.push("No line assigned");
    status = "at_risk";
  }
  if (rejectRate > 5) {
    reasons.push(`Reject rate ${rejectRate.toFixed(1)}%`);
    status = "at_risk";
  }

  // Watch conditions (only upgrade, never downgrade from at_risk)
  if (status !== "at_risk") {
    if (
      daysToExFactory !== null &&
      daysToExFactory <= 14 &&
      progressPct < 60
    ) {
      reasons.push(
        `Ex-factory in ${daysToExFactory} days, only ${Math.round(progressPct)}% done`
      );
      status = "watch";
    }
    // Behind schedule: deadline within 30 days but barely started
    if (
      daysToExFactory !== null &&
      daysToExFactory <= 30 &&
      progressPct < 10
    ) {
      reasons.push(
        `Ex-factory in ${daysToExFactory} days, only ${Math.round(progressPct)}% done`
      );
      status = "watch";
    }
    if (rejectRate > 3) {
      reasons.push(`Reject rate ${rejectRate.toFixed(1)}%`);
      status = "watch";
    }
    // "No EOD today" only matters if PO has a deadline and isn't nearly done
    if (isActive && !po.hasEodToday && daysToExFactory !== null && progressPct < 80) {
      reasons.push("No EOD submitted today");
      status = "watch";
    }
  }

  // No deadline set — show neutral if nothing else triggered
  if (reasons.length === 0 && daysToExFactory === null) {
    return { status: "no_deadline", reasons: ["No deadline set"] };
  }

  if (reasons.length === 0) reasons.push("On track");

  return { status, reasons };
}

// ── Hook ──────────────────────────────────────────────
export function usePOControlRoom() {
  const { profile, factory } = useAuth();
  const timezone = factory?.timezone || "Asia/Dhaka";
  const today = getTodayInTimezone(timezone);

  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<POControlRoomData[]>([]);
  const [activeTab, setActiveTab] = useState<POViewTab>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<PODetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailCache = useRef(new Map<string, PODetailData>());

  // ── List-level fetch ────────────────────────────────
  const fetchWorkOrders = useCallback(async () => {
    if (!profile?.factory_id) return;
    setLoading(true);

    try {
      const factoryId = profile.factory_id;

      const { data: woData } = await supabase
        .from("work_orders")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .eq("is_active", true)
        .order("po_number");

      const ids = woData?.map((w) => w.id) || [];
      if (ids.length === 0) {
        setWorkOrders([]);
        setLoading(false);
        return;
      }

      const [sewingRes, finishingRes, ledgerRes, eodTodayRes, assignRes] =
        await Promise.all([
          // Sewing output + quality
          supabase
            .from("sewing_actuals")
            .select("work_order_id, good_today, reject_today, rework_today")
            .eq("factory_id", factoryId)
            .in("work_order_id", ids),
          // Finishing output
          supabase
            .from("finishing_daily_logs")
            .select("work_order_id, poly, carton")
            .eq("factory_id", factoryId)
            .eq("log_type", "OUTPUT")
            .in("work_order_id", ids),
          // Extras ledger
          supabase
            .from("extras_ledger")
            .select("work_order_id, quantity")
            .eq("factory_id", factoryId)
            .in("work_order_id", ids),
          // EOD submitted today
          supabase
            .from("sewing_actuals")
            .select("work_order_id")
            .eq("factory_id", factoryId)
            .eq("production_date", today)
            .in("work_order_id", ids),
          // Line assignments
          supabase
            .from("work_order_line_assignments")
            .select("work_order_id, line_id, lines(name, line_id)")
            .eq("factory_id", factoryId)
            .in("work_order_id", ids),
        ]);

      // Aggregate sewing
      const sewingMap = new Map<
        string,
        { good: number; reject: number; rework: number }
      >();
      sewingRes.data?.forEach((r) => {
        const id = r.work_order_id || "";
        const cur = sewingMap.get(id) || { good: 0, reject: 0, rework: 0 };
        cur.good += r.good_today || 0;
        cur.reject += r.reject_today || 0;
        cur.rework += r.rework_today || 0;
        sewingMap.set(id, cur);
      });

      // Aggregate finishing
      const finMap = new Map<string, number>();
      finishingRes.data?.forEach((r: any) => {
        const id = r.work_order_id || "";
        finMap.set(id, (finMap.get(id) || 0) + (r.poly || 0) + (r.carton || 0));
      });

      // Aggregate ledger
      const ledgerMap = new Map<string, number>();
      ledgerRes.data?.forEach((r: any) => {
        const id = r.work_order_id || "";
        ledgerMap.set(id, (ledgerMap.get(id) || 0) + (r.quantity || 0));
      });

      // EOD today set
      const eodTodaySet = new Set<string>();
      eodTodayRes.data?.forEach((r) => {
        if (r.work_order_id) eodTodaySet.add(r.work_order_id);
      });

      // Line assignments map
      const assignMap = new Map<string, string[]>();
      assignRes.data?.forEach((r: any) => {
        const id = r.work_order_id || "";
        const name = r.lines?.name || r.lines?.line_id || "Unknown";
        const cur = assignMap.get(id) || [];
        cur.push(name);
        assignMap.set(id, cur);
      });

      const result: POControlRoomData[] = (woData || []).map((wo) => {
        const sewing = sewingMap.get(wo.id) || {
          good: 0,
          reject: 0,
          rework: 0,
        };
        const finishedOutput = finMap.get(wo.id) || 0;
        const lineNames = assignMap.get(wo.id) || [];
        const hasEodToday = eodTodaySet.has(wo.id);
        const progressPct =
          wo.order_qty > 0
            ? Math.min((finishedOutput / wo.order_qty) * 100, 100)
            : 0;

        const poData = {
          id: wo.id,
          po_number: wo.po_number,
          buyer: wo.buyer,
          style: wo.style,
          item: wo.item,
          color: wo.color,
          order_qty: wo.order_qty,
          status: wo.status,
          planned_ex_factory: wo.planned_ex_factory,
          line_names: lineNames.length > 0
            ? lineNames
            : wo.lines?.name
              ? [wo.lines.name]
              : wo.lines?.line_id
                ? [wo.lines.line_id]
                : [],
          line_id: wo.line_id ?? null,
          sewingOutput: sewing.good,
          finishedOutput,
          extrasConsumed: ledgerMap.get(wo.id) || 0,
          totalRejects: sewing.reject,
          totalRework: sewing.rework,
          hasEodToday,
          progressPct,
          health: { status: "healthy", reasons: ["On track"] } as HealthReason,
        };

        poData.health = computeHealth(poData, today);
        return poData;
      });

      setWorkOrders(result);
    } catch (err) {
      console.error("Error fetching work orders:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.factory_id, today]);

  useEffect(() => {
    if (profile?.factory_id) fetchWorkOrders();
  }, [fetchWorkOrders, profile?.factory_id]);

  // ── Tab filtering + search ──────────────────────────
  const filteredOrders = useMemo(() => {
    let list = workOrders;

    // Tab filter
    switch (activeTab) {
      case "at_risk":
        list = list.filter((po) => po.health.status === "at_risk");
        break;
      case "ex_factory_soon":
        list = list.filter((po) => {
          if (!po.planned_ex_factory) return false;
          const days = differenceInDays(
            new Date(po.planned_ex_factory),
            new Date(today)
          );
          return days <= 14;
        });
        break;
      case "no_line":
        list = list.filter(
          (po) => po.line_names.length === 0 && po.line_id == null
        );
        break;
      case "updated_today":
        list = list.filter((po) => po.hasEodToday);
        break;
      case "on_target":
        list = list.filter(
          (po) => po.health.status === "healthy" && po.progressPct > 0
        );
        break;
    }

    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (po) =>
          po.po_number.toLowerCase().includes(q) ||
          po.buyer.toLowerCase().includes(q) ||
          po.style.toLowerCase().includes(q)
      );
    }

    return list;
  }, [workOrders, activeTab, searchTerm, today]);

  // ── Tab counts ──────────────────────────────────────
  const tabCounts = useMemo(() => {
    const counts: Record<POViewTab, number> = {
      all: workOrders.length,
      at_risk: 0,
      ex_factory_soon: 0,
      no_line: 0,
      updated_today: 0,
      on_target: 0,
    };
    workOrders.forEach((po) => {
      if (po.health.status === "at_risk") counts.at_risk++;
      if (po.planned_ex_factory) {
        const days = differenceInDays(
          new Date(po.planned_ex_factory),
          new Date(today)
        );
        if (days <= 14) counts.ex_factory_soon++;
      }
      if (po.line_names.length === 0 && po.line_id == null) counts.no_line++;
      if (po.hasEodToday) counts.updated_today++;
      if (po.health.status === "healthy" && po.progressPct > 0)
        counts.on_target++;
    });
    return counts;
  }, [workOrders, today]);

  // ── KPIs ────────────────────────────────────────────
  const kpis = useMemo<POKPIs>(() => {
    const k: POKPIs = {
      activeOrders: workOrders.length,
      totalQty: 0,
      sewingOutput: 0,
      finishedOutput: 0,
      totalExtras: 0,
    };
    workOrders.forEach((po) => {
      k.totalQty += po.order_qty;
      k.sewingOutput += po.sewingOutput;
      k.finishedOutput += po.finishedOutput;
      k.totalExtras += Math.max(po.finishedOutput - po.order_qty, 0);
    });
    return k;
  }, [workOrders]);

  // ── Needs action cards ──────────────────────────────
  const needsActionCards = useMemo<NeedsActionCard[]>(() => {
    let noEod = 0;
    let exFactorySoon = 0;
    let noLine = 0;
    let qualitySpike = 0;

    workOrders.forEach((po) => {
      const isActive =
        po.status === "in_progress" || po.status === "not_started";
      if (isActive && !po.hasEodToday) noEod++;

      if (po.planned_ex_factory) {
        const days = differenceInDays(
          new Date(po.planned_ex_factory),
          new Date(today)
        );
        if (days <= 7 && po.progressPct < 80) exFactorySoon++;
      }

      if (isActive && po.line_names.length === 0 && po.line_id == null)
        noLine++;

      const rejectRate =
        po.sewingOutput > 0
          ? (po.totalRejects / po.sewingOutput) * 100
          : 0;
      if (rejectRate > 3) qualitySpike++;
    });

    const cards: NeedsActionCard[] = [];
    if (noEod > 0) {
      cards.push({
        key: "no_eod",
        title: "No EOD Today",
        count: noEod,
        description: `${noEod} active PO${noEod > 1 ? "s" : ""} with no submission today`,
        icon: ClipboardX,
        variant: "warning",
        targetTab: "updated_today",
      });
    }
    if (exFactorySoon > 0) {
      cards.push({
        key: "ex_factory",
        title: "Ex-Factory Soon",
        count: exFactorySoon,
        description: `${exFactorySoon} PO${exFactorySoon > 1 ? "s" : ""} due within 7 days, behind schedule`,
        icon: CalendarClock,
        variant: "destructive",
        targetTab: "ex_factory_soon",
      });
    }
    if (noLine > 0) {
      cards.push({
        key: "no_line",
        title: "No Line Assigned",
        count: noLine,
        description: `${noLine} active PO${noLine > 1 ? "s" : ""} without a production line`,
        icon: Unlink,
        variant: "warning",
        targetTab: "no_line",
      });
    }
    if (qualitySpike > 0) {
      cards.push({
        key: "quality",
        title: "Quality Spike",
        count: qualitySpike,
        description: `${qualitySpike} PO${qualitySpike > 1 ? "s" : ""} with reject rate > 3%`,
        icon: AlertTriangle,
        variant: "destructive",
        targetTab: "at_risk",
      });
    }
    return cards;
  }, [workOrders, today]);

  // ── Row expand + detail fetch ───────────────────────
  const toggleExpand = useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null);
        setDetailData(null);
        return;
      }

      setExpandedId(id);

      // Use cache
      const cached = detailCache.current.get(id);
      if (cached) {
        setDetailData(cached);
        return;
      }

      setDetailLoading(true);
      setDetailData(null);

      try {
        const factoryId = profile?.factory_id;
        if (!factoryId) return;

        const [targetsRes, actualsRes, cuttingRes, finLogsRes, storageRes] =
          await Promise.all([
            supabase
              .from("sewing_targets")
              .select(
                "*, lines(name, line_id), stages:planned_stage_id(name), work_orders(po_number, buyer, style, order_qty)"
              )
              .eq("work_order_id", id)
              .eq("factory_id", factoryId)
              .order("production_date", { ascending: false })
              .limit(30),
            supabase
              .from("sewing_actuals")
              .select(
                "*, lines(name, line_id), stages:actual_stage_id(name), work_orders(po_number, buyer, style, order_qty)"
              )
              .eq("work_order_id", id)
              .eq("factory_id", factoryId)
              .order("production_date", { ascending: false })
              .limit(30),
            supabase
              .from("cutting_actuals")
              .select("*, lines!cutting_actuals_line_id_fkey(name, line_id), work_orders(po_number, buyer, style, order_qty)")
              .eq("work_order_id", id)
              .eq("factory_id", factoryId)
              .order("production_date", { ascending: false }),
            supabase
              .from("finishing_daily_logs")
              .select("*, lines(name, line_id), work_orders(po_number, buyer, style, order_qty)")
              .eq("work_order_id", id)
              .eq("factory_id", factoryId)
              .order("production_date", { ascending: false }),
            supabase
              .from("storage_bin_cards")
              .select(
                "id, storage_bin_card_transactions(receive_qty, issue_qty, transaction_date)"
              )
              .eq("work_order_id", id)
              .eq("factory_id", factoryId),
          ]);

        // Build flat submissions list
        const submissions: POSubmissionRow[] = [];
        const lineName = (r: any) => r.lines?.name || r.lines?.line_id || "—";

        targetsRes.data?.forEach((t: any) => {
          const target =
            t.target_total_planned ??
            Math.round((t.per_hour_target ?? 0) * (t.hours_planned ?? 8));
          submissions.push({
            id: t.id,
            type: "sewing_target",
            date: t.production_date,
            lineName: lineName(t),
            submittedAt: t.submitted_at,
            headline: `Target ${target.toLocaleString()}`,
            raw: t,
          });
        });

        actualsRes.data?.forEach((a: any) => {
          submissions.push({
            id: a.id,
            type: "sewing_actual",
            date: a.production_date,
            lineName: lineName(a),
            submittedAt: a.submitted_at,
            headline: `Output ${(a.good_today || 0).toLocaleString()}`,
            raw: a,
          });
        });

        cuttingRes.data?.forEach((c: any) => {
          submissions.push({
            id: c.id,
            type: "cutting_actual",
            date: c.production_date,
            lineName: lineName(c),
            submittedAt: c.submitted_at,
            headline: `Cut ${(c.total_cutting || 0).toLocaleString()}`,
            raw: c,
          });
        });

        finLogsRes.data?.forEach((f: any) => {
          const isTgt = f.log_type === "TARGET";
          const qty = isTgt
            ? (f.per_hour_target || 0)
            : (f.poly || 0) + (f.carton || 0);
          submissions.push({
            id: f.id,
            type: isTgt ? "finishing_target" : "finishing_actual",
            date: f.production_date,
            lineName: lineName(f),
            submittedAt: f.submitted_at,
            headline: isTgt
              ? `Fin. Target ${qty.toLocaleString()}`
              : `Finished ${qty.toLocaleString()}`,
            raw: f,
          });
        });

        // Sort by date desc, then type order (targets before actuals)
        const typeOrder: Record<string, number> = {
          sewing_target: 0,
          sewing_actual: 1,
          cutting_actual: 2,
          finishing_target: 3,
          finishing_actual: 4,
        };
        submissions.sort((a, b) => {
          const dc = b.date.localeCompare(a.date);
          if (dc !== 0) return dc;
          return (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
        });

        // Build pipeline
        const wo = workOrders.find((w) => w.id === id);
        const orderQty = wo?.order_qty || 1;

        // Storage: sum of receive_qty across all bin cards
        let storageQty = 0;
        let storageDate: string | null = null;
        storageRes.data?.forEach((card: any) => {
          card.storage_bin_card_transactions?.forEach((tx: any) => {
            storageQty += tx.receive_qty || 0;
            if (
              tx.transaction_date &&
              (!storageDate || tx.transaction_date > storageDate)
            ) {
              storageDate = tx.transaction_date;
            }
          });
        });

        // Cutting: take max total_cutting (it's a running cumulative total)
        let cuttingQty = 0;
        let cuttingDate: string | null = null;
        cuttingRes.data?.forEach((c: any) => {
          const ct = c.total_cutting || 0;
          if (ct > cuttingQty) cuttingQty = ct;
          if (c.production_date && (!cuttingDate || c.production_date > cuttingDate)) {
            cuttingDate = c.production_date;
          }
        });

        const sewingQty = wo?.sewingOutput || 0;
        const sewingDate = actualsRes.data?.[0]?.production_date || null;

        let finQty = 0;
        let finDate: string | null = null;
        finLogsRes.data?.forEach((l: any) => {
          if (l.log_type === "TARGET") return; // only count OUTPUT for pipeline
          finQty += (l.poly || 0) + (l.carton || 0);
          if (
            l.production_date &&
            (!finDate || l.production_date > finDate)
          ) {
            finDate = l.production_date;
          }
        });

        const pctOf = (q: number) =>
          Math.min(Math.round((q / orderQty) * 100), 100);

        const pipeline: POPipelineStage[] = [
          {
            stage: "storage",
            label: "Storage",
            qty: storageQty,
            pct: pctOf(storageQty),
            lastDate: storageDate,
          },
          {
            stage: "cutting",
            label: "Cutting",
            qty: cuttingQty,
            pct: pctOf(cuttingQty),
            lastDate: cuttingDate,
          },
          {
            stage: "sewing",
            label: "Sewing",
            qty: sewingQty,
            pct: pctOf(sewingQty),
            lastDate: sewingDate,
          },
          {
            stage: "finishing",
            label: "Finishing",
            qty: finQty,
            pct: pctOf(finQty),
            lastDate: finDate,
          },
        ];

        // Build quality
        const totalRejects = wo?.totalRejects || 0;
        const totalRework = wo?.totalRework || 0;
        const totalOutput = sewingQty;
        const extrasTotal = Math.max(finQty - orderQty, 0);
        const extrasConsumed = wo?.extrasConsumed || 0;

        const quality: POQualityData = {
          totalOutput,
          totalRejects,
          totalRework,
          rejectRate: totalOutput > 0 ? (totalRejects / totalOutput) * 100 : 0,
          reworkRate: totalOutput > 0 ? (totalRework / totalOutput) * 100 : 0,
          extrasTotal,
          extrasConsumed,
          extrasAvailable: Math.max(extrasTotal - extrasConsumed, 0),
        };

        const detail: PODetailData = { submissions, pipeline, quality };
        detailCache.current.set(id, detail);
        setDetailData(detail);
      } catch (err) {
        console.error("Error fetching PO detail:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [expandedId, profile?.factory_id, workOrders]
  );

  return {
    loading,
    workOrders,
    filteredOrders,
    kpis,
    tabCounts,
    needsActionCards,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    expandedId,
    detailData,
    detailLoading,
    toggleExpand,
    refetch: fetchWorkOrders,
  };
}
