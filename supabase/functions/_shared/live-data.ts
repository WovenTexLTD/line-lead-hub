// Live factory data queries for the chatbot
// Classifies user messages → fetches relevant production data → formats for LLM context

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LiveDataCategory =
  | "sewing_output"
  | "sewing_targets"
  | "blockers"
  | "work_orders"
  | "cutting"
  | "finishing"
  | "storage"
  | "lines"
  | "factory_summary";

export interface LiveDataResult {
  category: LiveDataCategory;
  label: string;
  data: Record<string, unknown>[];
  summary: string;
  fetchedAt: string;
  error?: string;
}

export interface LiveDataContext {
  results: LiveDataResult[];
  todayDate: string;
}

const MAX_ROWS = 200;

// ---------------------------------------------------------------------------
// Intent Classifier
// ---------------------------------------------------------------------------

interface Classification {
  categories: LiveDataCategory[];
  poNumberHint: string | null;
  buyerHint: string | null;
  lineNameHint: string | null;
  wantsSummary: boolean;
}

export function classifyMessage(message: string): Classification {
  // Normalize smart/curly quotes and apostrophes to ASCII equivalents
  const normalized = message
    .replace(/[\u2018\u2019\u2032\u0060]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"');
  const lower = normalized.toLowerCase();
  const cats = new Set<LiveDataCategory>();
  let wantsSummary = false;

  // Factory-wide summary requests
  if (/overall|factory.*(summary|status|overview|report)|daily.*(summary|report|overview)|how.*(factory|production).*(doing|going|perform)|total.*(output|production|today)|all.*(department|section)|complete.*(picture|overview)|dashboard|kpi|metric/i.test(lower)) {
    wantsSummary = true;
    cats.add("factory_summary");
  }

  // Blockers
  if (/blocker|blocked|block|issue|problem|obstacle|stuck|delay|bottleneck|hold.?up|pending/i.test(lower)) {
    cats.add("blockers");
  }

  // Sewing output
  if (/sewing.?output|sewing.?actual|good.?today|reject|rework|sewing.?result|how much.*(sew|produc)|sewing.*(pcs|pieces|quantity)|output.*(sew)/i.test(lower)) {
    cats.add("sewing_output");
  }

  // Sewing targets
  if (/sewing.?target|morning.?target|per.?hour.?target|manpower.?planned|target.?today|plan.*(sew)/i.test(lower)) {
    cats.add("sewing_targets");
  }

  // Generic "sewing" → fetch both
  if (lower.includes("sewing") && !cats.has("sewing_output") && !cats.has("sewing_targets")) {
    cats.add("sewing_output");
    cats.add("sewing_targets");
  }

  // Cutting
  if (/cutting|cut.?output|cut.?today|day.?cutting|cutting.?status|cutting.?capacity|marker.?capacity|lay.?capacity|fabric.?cut|cut.?balance|input.?today/i.test(lower)) {
    cats.add("cutting");
  }

  // Finishing
  if (/finishing|poly|carton|iron|buttoning|thread.?cutting|inside.?check|top.?side|get.?up|finishing.?output|pack|packing|shipment.?ready|export.?ready|qc.?pass/i.test(lower)) {
    cats.add("finishing");
  }

  // Work orders / PO
  if (/\bpo\b|purchase.?order|work.?order|\border\b|\bstatus\b|po-|buyer|brand|style|order.?qty|how.?far|ex.?factory|shipment|delivery|completion|complete|progress|which.*(order|po)|list.*(order|po)|active.*(order|po)/i.test(lower)) {
    cats.add("work_orders");
  }

  // Storage
  if (/storage|bin.?card|\bbin\b|fabric|stock|inventory|warehouse|material|raw.?material/i.test(lower)) {
    cats.add("storage");
  }

  // Lines
  if (/which.?line|line.?status|all.?lines|active.?lines|behind.?target|line.?performance|line.?efficiency|line.?output|best.?line|worst.?line|top.?line|lowest.?line|line.?comparison/i.test(lower)) {
    cats.add("lines");
  }

  // Statistical / analytical queries
  if (/statistic|analytic|average|efficiency|percent|ratio|compare|comparison|trend|growth|increase|decrease|highest|lowest|best|worst|top|bottom|rank|ranking|most|least|total|sum|count|how.?many/i.test(lower)) {
    // Add relevant categories for stats
    if (!cats.has("sewing_output")) cats.add("sewing_output");
    if (!cats.has("work_orders")) cats.add("work_orders");
    if (!cats.has("lines")) cats.add("lines");
    wantsSummary = true;
    cats.add("factory_summary");
  }

  // Broad production queries (catch-all)
  if (
    cats.size === 0 &&
    /how.?many.*(produc|output|made|sew)|today.?s?.*(output|production|result)|(daily|today).*(summary|report|overview)|behind|efficiency|performance|ahead|update/i.test(lower)
  ) {
    cats.add("sewing_output");
    cats.add("sewing_targets");
    cats.add("blockers");
    cats.add("factory_summary");
    wantsSummary = true;
  }

  // Extract PO number hint
  const poMatch = lower.match(/po[- ]?(\d{2,6})/i);
  const poNumberHint = poMatch ? `PO-${poMatch[1].padStart(3, "0")}` : null;
  if (poNumberHint) cats.add("work_orders");

  // Extract buyer/brand hint — strip stopwords + production keywords, whatever remains is the buyer hint
  const STOPWORDS = /\b(how|far|are|we|with|the|what|is|status|of|for|on|about|our|my|a|an|any|order|orders|po|purchase|work|buyer|brand|production|update|progress|show|tell|me|get|give|can|you|please|do|does|current|currently|today|now|much|many|complete|completed|completion|done|behind|ahead|sewing|cutting|finishing|all|this|that|which|who|where|when|will|be|been|has|have|had|not|no|or|and|from|s|total|quantity|pieces|pcs|number|count|output|percent|percentage|report|summary|daily|overall|list|active|inactive|open|factory|line|lines|target|targets|each|every|per|their|them|they|it|its|still|yet|so|but|up|at|in|to|by|i|if|go|going|look|make|should|would|could|need|want|also|just|more|most|there|here|then|than|into|only|these|those|some|being|being|since|until|while|after|before|both|between|own|such|under|over|down|out|off|was|were|did)\b/gi;
  const cleaned = normalized.replace(STOPWORDS, "").replace(/[^a-zA-Z0-9&\s-]/g, "").replace(/\s+/g, " ").trim();
  const buyerHint = (!poNumberHint && cleaned.length >= 2) ? cleaned : null;
  if (buyerHint) cats.add("work_orders");

  // Extract line name hint
  const lineMatch = lower.match(/line[- ]?([a-z0-9]{1,4})/i);
  const lineNameHint = lineMatch ? lineMatch[0] : null;

  return {
    categories: Array.from(cats),
    poNumberHint,
    buyerHint,
    lineNameHint,
    wantsSummary,
  };
}

// ---------------------------------------------------------------------------
// Today helper
// ---------------------------------------------------------------------------

export function getTodayForFactory(timezone: string | null): string {
  const tz = timezone || "Asia/Dhaka";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function errorResult(category: LiveDataCategory, label: string, err: unknown): LiveDataResult {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[LIVE-DATA] Error fetching ${category}: ${msg}`);
  return { category, label, data: [], summary: `(Unable to fetch ${label} data)`, fetchedAt: new Date().toISOString(), error: msg };
}

// ---------------------------------------------------------------------------
// Aggregate Types
// ---------------------------------------------------------------------------

interface SewingAggregates {
  linesReporting: number;
  totalGood: number;
  totalReject: number;
  totalRework: number;
  totalManpower: number;
  totalCumulativeGood: number;
  linesWithBlockers: number;
  avgGoodPerLine: number;
  topPerformingLine: { name: string; good: number } | null;
  lowestPerformingLine: { name: string; good: number } | null;
}

interface SewingTargetAggregates {
  linesWithTargets: number;
  totalPlannedManpower: number;
  totalPlannedOT: number;
  avgPerHourTarget: number;
  totalDailyTarget: number;
}

interface CuttingAggregates {
  linesReporting: number;
  totalDayCutting: number;
  totalDayInput: number;
  totalBalance: number;
  totalManpower: number;
  avgCuttingPerLine: number;
}

interface FinishingAggregates {
  linesReporting: number;
  totalPoly: number;
  totalCarton: number;
  totalIron: number;
  totalThreadCutting: number;
  avgPolyPerLine: number;
  avgCartonPerLine: number;
}

interface BlockerAggregates {
  totalActive: number;
  openCount: number;
  inProgressCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  byDepartment: { sewing: number; finishing: number };
  topBlockerTypes: { type: string; count: number }[];
}

interface LineAggregates {
  totalActiveLines: number;
  linesWithOutputToday: number;
  linesOnTarget: number;
  linesBehindTarget: number;
  avgEfficiency: number;
  topPerformers: { name: string; efficiency: number }[];
  needsAttention: { name: string; efficiency: number }[];
}

interface WorkOrderAggregates {
  activeCount: number;
  totalQty: number;
  totalSewingOutput: number;
  totalFinishingOutput: number;
  avgProgress: number;
  topBuyers: { buyer: string; qty: number; orderCount: number }[];
  upcomingExFactory: { po: string; buyer: string; date: string }[];
  ordersNearingCompletion: number;
  ordersBehindSchedule: number;
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

async function fetchSewingOutput(
  sb: SupabaseClient, factoryId: string, today: string,
): Promise<LiveDataResult> {
  try {
    const { data, error } = await sb
      .from("sewing_actuals")
      .select("production_date, good_today, reject_today, rework_today, cumulative_good_total, manpower_actual, has_blocker, blocker_description, line_id, lines(line_id, name), work_orders(po_number, buyer, style, order_qty)")
      .eq("factory_id", factoryId)
      .eq("production_date", today)
      .order("good_today", { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw error;
    
    // Compute aggregates
    const agg = computeSewingAggregates(data || []);
    
    return { category: "sewing_output", label: "Sewing Output (Today)", data: data || [], summary: fmtSewingOutput(data || [], today, agg), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("sewing_output", "Sewing Output (Today)", err); }
}

function computeSewingAggregates(data: any[]): SewingAggregates {
  const linesReporting = data.length;
  const totalGood = data.reduce((s, r) => s + (r.good_today || 0), 0);
  const totalReject = data.reduce((s, r) => s + (r.reject_today || 0), 0);
  const totalRework = data.reduce((s, r) => s + (r.rework_today || 0), 0);
  const totalManpower = data.reduce((s, r) => s + (r.manpower_actual || 0), 0);
  const totalCumulativeGood = data.reduce((s, r) => s + (r.cumulative_good_total || 0), 0);
  const linesWithBlockers = data.filter((r) => r.has_blocker).length;
  const avgGoodPerLine = linesReporting > 0 ? Math.round(totalGood / linesReporting) : 0;
  
  const sorted = [...data].sort((a, b) => (b.good_today || 0) - (a.good_today || 0));
  const topPerformingLine = sorted.length > 0 ? { name: sorted[0].lines?.name || sorted[0].lines?.line_id || "Unknown", good: sorted[0].good_today || 0 } : null;
  const lowestPerformingLine = sorted.length > 0 ? { name: sorted[sorted.length - 1].lines?.name || sorted[sorted.length - 1].lines?.line_id || "Unknown", good: sorted[sorted.length - 1].good_today || 0 } : null;
  
  return { linesReporting, totalGood, totalReject, totalRework, totalManpower, totalCumulativeGood, linesWithBlockers, avgGoodPerLine, topPerformingLine, lowestPerformingLine };
}

async function fetchSewingTargets(
  sb: SupabaseClient, factoryId: string, today: string,
): Promise<LiveDataResult> {
  try {
    const { data, error } = await sb
      .from("sewing_targets")
      .select("production_date, per_hour_target, manpower_planned, ot_hours_planned, lines(line_id, name), work_orders(po_number, buyer, style)")
      .eq("factory_id", factoryId)
      .eq("production_date", today)
      .order("per_hour_target", { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw error;
    
    const agg = computeSewingTargetAggregates(data || []);
    
    return { category: "sewing_targets", label: "Sewing Targets (Today)", data: data || [], summary: fmtSewingTargets(data || [], today, agg), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("sewing_targets", "Sewing Targets (Today)", err); }
}

function computeSewingTargetAggregates(data: any[]): SewingTargetAggregates {
  const linesWithTargets = data.length;
  const totalPlannedManpower = data.reduce((s, r) => s + (r.manpower_planned || 0), 0);
  const totalPlannedOT = data.reduce((s, r) => s + (Number(r.ot_hours_planned) || 0), 0);
  const totalPerHourTarget = data.reduce((s, r) => s + (r.per_hour_target || 0), 0);
  const avgPerHourTarget = linesWithTargets > 0 ? Math.round(totalPerHourTarget / linesWithTargets) : 0;
  // Assume 8-hour workday for daily target
  const totalDailyTarget = totalPerHourTarget * 8;
  
  return { linesWithTargets, totalPlannedManpower, totalPlannedOT, avgPerHourTarget, totalDailyTarget };
}

async function fetchBlockers(
  sb: SupabaseClient, factoryId: string,
): Promise<LiveDataResult> {
  try {
    const [sewR, finR] = await Promise.all([
      sb.from("production_updates_sewing")
        .select("production_date, blocker_description, blocker_impact, blocker_status, blocker_owner, output_qty, lines(line_id, name), work_orders(po_number, buyer, style), blocker_types(name)")
        .eq("factory_id", factoryId)
        .eq("has_blocker", true)
        .in("blocker_status", ["open", "in_progress"])
        .order("submitted_at", { ascending: false })
        .limit(MAX_ROWS),
      sb.from("production_updates_finishing")
        .select("production_date, blocker_description, blocker_impact, blocker_status, blocker_owner, lines(line_id, name), work_orders(po_number, buyer, style), blocker_types(name)")
        .eq("factory_id", factoryId)
        .eq("has_blocker", true)
        .in("blocker_status", ["open", "in_progress"])
        .order("submitted_at", { ascending: false })
        .limit(MAX_ROWS),
    ]);
    if (sewR.error) throw sewR.error;
    if (finR.error) throw finR.error;

    const all = [
      ...(sewR.data || []).map((b: any) => ({ ...b, department: "sewing" })),
      ...(finR.data || []).map((b: any) => ({ ...b, department: "finishing" })),
    ].slice(0, MAX_ROWS);

    const agg = computeBlockerAggregates(all);

    return { category: "blockers", label: "Active Blockers", data: all, summary: fmtBlockers(all, agg), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("blockers", "Active Blockers", err); }
}

function computeBlockerAggregates(data: any[]): BlockerAggregates {
  const totalActive = data.length;
  const openCount = data.filter((b) => b.blocker_status === "open").length;
  const inProgressCount = data.filter((b) => b.blocker_status === "in_progress").length;
  const criticalCount = data.filter((b) => b.blocker_impact === "critical").length;
  const highCount = data.filter((b) => b.blocker_impact === "high").length;
  const mediumCount = data.filter((b) => b.blocker_impact === "medium").length;
  const lowCount = data.filter((b) => b.blocker_impact === "low").length;
  
  const sewingBlockers = data.filter((b) => b.department === "sewing").length;
  const finishingBlockers = data.filter((b) => b.department === "finishing").length;
  
  // Count by blocker type
  const typeCount: Record<string, number> = {};
  for (const b of data) {
    const typeName = b.blocker_types?.name || "Unknown";
    typeCount[typeName] = (typeCount[typeName] || 0) + 1;
  }
  const topBlockerTypes = Object.entries(typeCount)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    totalActive,
    openCount,
    inProgressCount,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    byDepartment: { sewing: sewingBlockers, finishing: finishingBlockers },
    topBlockerTypes,
  };
}

async function fetchWorkOrders(
  sb: SupabaseClient, factoryId: string, poHint: string | null, buyerHint: string | null,
): Promise<LiveDataResult> {
  try {
    let q = sb.from("work_orders")
      .select("id, po_number, buyer, style, item, color, order_qty, smv, target_per_hour, target_per_day, planned_ex_factory, actual_ex_factory, status, is_active, lines(line_id, name)")
      .eq("factory_id", factoryId)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);

    if (poHint) {
      // Specific PO search — include completed/inactive orders too
      q = q.ilike("po_number", `%${poHint}%`);
    } else if (!buyerHint) {
      // No specific search — only show active orders to avoid noise
      q = q.eq("is_active", true);
    }
    // When buyerHint is set, fetch ALL orders (active + completed) so the LLM
    // can match buyer/style names. DB-level buyer filter is skipped because
    // special characters like & in "C&A" or ' in "Kohl's" break PostgREST filters.

    const { data, error } = await q;
    if (error) throw error;

    // Fetch both sewing and finishing output in parallel (matches frontend WorkOrdersView)
    const sewingMap = new Map<string, number>();
    const finishingMap = new Map<string, number>();
    if (data && data.length > 0) {
      const woIds = data.map((wo: any) => wo.id);
      const [sewingRes, finishingRes] = await Promise.all([
        // Sewing output from production_updates_sewing
        sb.from("production_updates_sewing")
          .select("work_order_id, output_qty")
          .eq("factory_id", factoryId)
          .in("work_order_id", woIds),
        // Finishing output from finishing_daily_logs (carton, OUTPUT type) — source of truth for progress %
        sb.from("finishing_daily_logs")
          .select("work_order_id, carton")
          .eq("factory_id", factoryId)
          .eq("log_type", "OUTPUT")
          .in("work_order_id", woIds),
      ]);

      if (sewingRes.data) {
        for (const row of sewingRes.data) {
          const woId = row.work_order_id;
          if (woId) {
            sewingMap.set(woId, (sewingMap.get(woId) || 0) + (row.output_qty || 0));
          }
        }
      }
      if (finishingRes.data) {
        for (const log of finishingRes.data) {
          const woId = log.work_order_id;
          if (woId) {
            finishingMap.set(woId, (finishingMap.get(woId) || 0) + (log.carton || 0));
          }
        }
      }
    }

    // ── Aggregate totals so LLM has exact numbers ──────────────────────────
    const agg = computeWorkOrderAggregates(data || [], sewingMap, finishingMap);

    const label = poHint ? `Work Order: ${poHint}` : buyerHint ? `Work Orders: ${buyerHint}` : "Active Work Orders";
    return { category: "work_orders", label, data: data || [], summary: fmtWorkOrders(data || [], sewingMap, finishingMap, agg), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("work_orders", "Work Orders", err); }
}

function computeWorkOrderAggregates(
  data: any[],
  sewingMap: Map<string, number>,
  finishingMap: Map<string, number>,
): WorkOrderAggregates {
  const activeOrders = data.filter((wo: any) => wo.is_active === true);
  const activeCount = activeOrders.length;
  const totalQty = activeOrders.reduce((s: number, wo: any) => s + (wo.order_qty || 0), 0);
  
  let totalSewingOutput = 0;
  let totalFinishingOutput = 0;
  let totalProgress = 0;
  let ordersNearingCompletion = 0;
  let ordersBehindSchedule = 0;
  const today = new Date().toISOString().split("T")[0];
  
  const upcomingExFactory: { po: string; buyer: string; date: string }[] = [];
  
  for (const wo of activeOrders) {
    const sewingOutput = sewingMap.get(wo.id) || 0;
    const finishingOutput = finishingMap.get(wo.id) || 0;
    totalSewingOutput += sewingOutput;
    totalFinishingOutput += finishingOutput;
    
    const orderQty = wo.order_qty || 0;
    const pct = orderQty > 0 ? Math.min(Math.round((finishingOutput / orderQty) * 100), 100) : 0;
    totalProgress += pct;
    
    if (pct >= 80 && pct < 100) ordersNearingCompletion++;
    
    // Check if behind schedule (ex-factory date passed but not complete)
    if (wo.planned_ex_factory && wo.planned_ex_factory < today && pct < 100) {
      ordersBehindSchedule++;
    }
    
    // Collect upcoming ex-factory dates (next 14 days)
    if (wo.planned_ex_factory && wo.planned_ex_factory >= today) {
      const daysUntil = Math.floor((new Date(wo.planned_ex_factory).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 14) {
        upcomingExFactory.push({ po: wo.po_number, buyer: wo.buyer, date: wo.planned_ex_factory });
      }
    }
  }
  
  const avgProgress = activeCount > 0 ? Math.round(totalProgress / activeCount) : 0;
  
  // Top buyers
  const byBuyer: Record<string, { qty: number; orderCount: number }> = {};
  for (const wo of activeOrders) {
    const b = wo.buyer || "Unknown";
    if (!byBuyer[b]) byBuyer[b] = { qty: 0, orderCount: 0 };
    byBuyer[b].qty += wo.order_qty || 0;
    byBuyer[b].orderCount += 1;
  }
  const topBuyers = Object.entries(byBuyer)
    .map(([buyer, stats]) => ({ buyer, qty: stats.qty, orderCount: stats.orderCount }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  
  upcomingExFactory.sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    activeCount,
    totalQty,
    totalSewingOutput,
    totalFinishingOutput,
    avgProgress,
    topBuyers,
    upcomingExFactory: upcomingExFactory.slice(0, 5),
    ordersNearingCompletion,
    ordersBehindSchedule,
  };
}

async function fetchCutting(
  sb: SupabaseClient, factoryId: string, today: string,
): Promise<LiveDataResult> {
  try {
    const [actR, tgtR] = await Promise.all([
      sb.from("cutting_actuals")
        .select("production_date, day_cutting, day_input, total_cutting, total_input, balance, man_power, lines(line_id, name), work_orders(po_number, buyer, style)")
        .eq("factory_id", factoryId)
        .eq("production_date", today)
        .order("day_cutting", { ascending: false })
        .limit(MAX_ROWS),
      sb.from("cutting_targets")
        .select("production_date, man_power, marker_capacity, lay_capacity, cutting_capacity, lines(line_id, name), work_orders(po_number, buyer, style)")
        .eq("factory_id", factoryId)
        .eq("production_date", today)
        .limit(MAX_ROWS),
    ]);
    if (actR.error) throw actR.error;
    if (tgtR.error) throw tgtR.error;

    const agg = computeCuttingAggregates(actR.data || []);

    return { category: "cutting", label: "Cutting Status (Today)", data: [...(actR.data || []), ...(tgtR.data || [])], summary: fmtCutting(actR.data || [], tgtR.data || [], today, agg), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("cutting", "Cutting Status (Today)", err); }
}

function computeCuttingAggregates(actuals: any[]): CuttingAggregates {
  const linesReporting = actuals.length;
  const totalDayCutting = actuals.reduce((s, a) => s + (a.day_cutting || 0), 0);
  const totalDayInput = actuals.reduce((s, a) => s + (a.day_input || 0), 0);
  const totalBalance = actuals.reduce((s, a) => s + (a.balance || 0), 0);
  const totalManpower = actuals.reduce((s, a) => s + (a.man_power || 0), 0);
  const avgCuttingPerLine = linesReporting > 0 ? Math.round(totalDayCutting / linesReporting) : 0;
  
  return { linesReporting, totalDayCutting, totalDayInput, totalBalance, totalManpower, avgCuttingPerLine };
}

async function fetchFinishing(
  sb: SupabaseClient, factoryId: string, today: string,
): Promise<LiveDataResult> {
  try {
    const { data, error } = await sb
      .from("finishing_daily_logs")
      .select("log_type, thread_cutting, inside_check, top_side_check, buttoning, iron, get_up, poly, carton, production_date, lines(line_id, name), work_orders(po_number, buyer, style)")
      .eq("factory_id", factoryId)
      .eq("production_date", today)
      .order("log_type", { ascending: true })
      .limit(MAX_ROWS);
    if (error) throw error;
    
    const agg = computeFinishingAggregates(data || []);
    
    return { category: "finishing", label: "Finishing Status (Today)", data: data || [], summary: fmtFinishing(data || [], today, agg), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("finishing", "Finishing Status (Today)", err); }
}

function computeFinishingAggregates(data: any[]): FinishingAggregates {
  const outputs = data.filter((r) => r.log_type === "OUTPUT");
  const linesReporting = outputs.length;
  const totalPoly = outputs.reduce((s, r) => s + (r.poly || 0), 0);
  const totalCarton = outputs.reduce((s, r) => s + (r.carton || 0), 0);
  const totalIron = outputs.reduce((s, r) => s + (r.iron || 0), 0);
  const totalThreadCutting = outputs.reduce((s, r) => s + (r.thread_cutting || 0), 0);
  const avgPolyPerLine = linesReporting > 0 ? Math.round(totalPoly / linesReporting) : 0;
  const avgCartonPerLine = linesReporting > 0 ? Math.round(totalCarton / linesReporting) : 0;
  
  return { linesReporting, totalPoly, totalCarton, totalIron, totalThreadCutting, avgPolyPerLine, avgCartonPerLine };
}

async function fetchStorage(
  sb: SupabaseClient, factoryId: string,
): Promise<LiveDataResult> {
  try {
    const { data, error } = await sb
      .from("storage_bin_cards")
      .select("buyer, style, color, construction, description, supplier_name, width, package_qty, work_orders(po_number, buyer, style, order_qty)")
      .eq("factory_id", factoryId)
      .limit(MAX_ROWS);
    if (error) throw error;
    
    const totalBinCards = (data || []).length;
    const totalPackageQty = (data || []).reduce((s, c) => s + (c.package_qty || 0), 0);
    
    return { category: "storage", label: "Storage Bin Cards", data: data || [], summary: fmtStorage(data || [], totalBinCards, totalPackageQty), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("storage", "Storage Bin Cards", err); }
}

async function fetchLines(
  sb: SupabaseClient, factoryId: string, today: string,
): Promise<LiveDataResult> {
  try {
    const [linesR, actR, tgtR] = await Promise.all([
      sb.from("lines").select("id, line_id, name, is_active").eq("factory_id", factoryId).eq("is_active", true).order("line_id"),
      sb.from("sewing_actuals").select("line_id, good_today").eq("factory_id", factoryId).eq("production_date", today),
      sb.from("sewing_targets").select("line_id, per_hour_target").eq("factory_id", factoryId).eq("production_date", today),
    ]);
    if (linesR.error) throw linesR.error;
    
    const agg = computeLineAggregates(linesR.data || [], actR.data || [], tgtR.data || []);
    
    return { category: "lines", label: "Line Status Overview", data: linesR.data || [], summary: fmtLines(linesR.data || [], actR.data || [], tgtR.data || [], today, agg), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("lines", "Line Status Overview", err); }
}

function computeLineAggregates(lines: any[], actuals: any[], targets: any[]): LineAggregates {
  const outputByLine = new Map<string, number>();
  for (const a of actuals) {
    outputByLine.set(a.line_id, (outputByLine.get(a.line_id) || 0) + (a.good_today || 0));
  }
  const targetByLine = new Map<string, number>();
  for (const t of targets) {
    targetByLine.set(t.line_id, (targetByLine.get(t.line_id) || 0) + ((t.per_hour_target || 0) * 8));
  }
  
  const totalActiveLines = lines.length;
  const linesWithOutputToday = outputByLine.size;
  
  let linesOnTarget = 0;
  let linesBehindTarget = 0;
  let totalEfficiency = 0;
  const efficiencies: { name: string; efficiency: number }[] = [];
  
  for (const line of lines) {
    const output = outputByLine.get(line.id) || 0;
    const target = targetByLine.get(line.id) || 0;
    const efficiency = target > 0 ? Math.round((output / target) * 100) : 0;
    
    if (target > 0) {
      totalEfficiency += efficiency;
      if (efficiency >= 100) linesOnTarget++;
      else linesBehindTarget++;
    }
    
    efficiencies.push({ name: line.name || line.line_id, efficiency });
  }
  
  const linesWithTargets = targetByLine.size;
  const avgEfficiency = linesWithTargets > 0 ? Math.round(totalEfficiency / linesWithTargets) : 0;
  
  efficiencies.sort((a, b) => b.efficiency - a.efficiency);
  const topPerformers = efficiencies.filter(e => e.efficiency > 0).slice(0, 3);
  const needsAttention = efficiencies.filter(e => e.efficiency > 0 && e.efficiency < 80).slice(-3).reverse();
  
  return {
    totalActiveLines,
    linesWithOutputToday,
    linesOnTarget,
    linesBehindTarget,
    avgEfficiency,
    topPerformers,
    needsAttention,
  };
}

async function fetchFactorySummary(
  sb: SupabaseClient, factoryId: string, today: string,
): Promise<LiveDataResult> {
  try {
    // Fetch all key metrics in parallel
    const [sewingActR, sewingTgtR, cuttingR, finishingR, blockersR, linesR, workOrdersR] = await Promise.all([
      sb.from("sewing_actuals")
        .select("good_today, reject_today, rework_today, manpower_actual, has_blocker")
        .eq("factory_id", factoryId)
        .eq("production_date", today),
      sb.from("sewing_targets")
        .select("per_hour_target, manpower_planned")
        .eq("factory_id", factoryId)
        .eq("production_date", today),
      sb.from("cutting_actuals")
        .select("day_cutting, day_input")
        .eq("factory_id", factoryId)
        .eq("production_date", today),
      sb.from("finishing_daily_logs")
        .select("poly, carton, log_type")
        .eq("factory_id", factoryId)
        .eq("production_date", today)
        .eq("log_type", "OUTPUT"),
      sb.from("production_updates_sewing")
        .select("blocker_impact, blocker_status")
        .eq("factory_id", factoryId)
        .eq("has_blocker", true)
        .in("blocker_status", ["open", "in_progress"]),
      sb.from("lines")
        .select("id")
        .eq("factory_id", factoryId)
        .eq("is_active", true),
      sb.from("work_orders")
        .select("order_qty, is_active")
        .eq("factory_id", factoryId)
        .eq("is_active", true),
    ]);
    
    const sewingActuals = sewingActR.data || [];
    const sewingTargets = sewingTgtR.data || [];
    const cuttingActuals = cuttingR.data || [];
    const finishingOutputs = finishingR.data || [];
    const activeBlockers = blockersR.data || [];
    const activeLines = linesR.data || [];
    const activeWorkOrders = workOrdersR.data || [];
    
    // Compute factory-wide stats
    const sewingTotalGood = sewingActuals.reduce((s, r) => s + (r.good_today || 0), 0);
    const sewingTotalReject = sewingActuals.reduce((s, r) => s + (r.reject_today || 0), 0);
    const sewingTotalManpower = sewingActuals.reduce((s, r) => s + (r.manpower_actual || 0), 0);
    const sewingDailyTarget = sewingTargets.reduce((s, r) => s + ((r.per_hour_target || 0) * 8), 0);
    const sewingEfficiency = sewingDailyTarget > 0 ? Math.round((sewingTotalGood / sewingDailyTarget) * 100) : 0;
    
    const cuttingTotalDay = cuttingActuals.reduce((s, r) => s + (r.day_cutting || 0), 0);
    const cuttingTotalInput = cuttingActuals.reduce((s, r) => s + (r.day_input || 0), 0);
    
    const finishingTotalPoly = finishingOutputs.reduce((s, r) => s + (r.poly || 0), 0);
    const finishingTotalCarton = finishingOutputs.reduce((s, r) => s + (r.carton || 0), 0);
    
    const blockerCount = activeBlockers.length;
    const criticalBlockers = activeBlockers.filter((b) => b.blocker_impact === "critical").length;
    
    const totalActiveOrders = activeWorkOrders.length;
    const totalOrderQty = activeWorkOrders.reduce((s, wo) => s + (wo.order_qty || 0), 0);
    
    const summary = fmtFactorySummary({
      today,
      sewingLinesReporting: sewingActuals.length,
      sewingTotalGood,
      sewingTotalReject,
      sewingTotalManpower,
      sewingDailyTarget,
      sewingEfficiency,
      cuttingLinesReporting: cuttingActuals.length,
      cuttingTotalDay,
      cuttingTotalInput,
      finishingLinesReporting: finishingOutputs.length,
      finishingTotalPoly,
      finishingTotalCarton,
      blockerCount,
      criticalBlockers,
      activeLines: activeLines.length,
      totalActiveOrders,
      totalOrderQty,
    });
    
    return {
      category: "factory_summary",
      label: "Factory Summary (Today)",
      data: [{
        sewing: { lines: sewingActuals.length, good: sewingTotalGood, reject: sewingTotalReject, efficiency: sewingEfficiency },
        cutting: { lines: cuttingActuals.length, output: cuttingTotalDay },
        finishing: { lines: finishingOutputs.length, poly: finishingTotalPoly, carton: finishingTotalCarton },
        blockers: { total: blockerCount, critical: criticalBlockers },
        workOrders: { active: totalActiveOrders, totalQty: totalOrderQty },
      }],
      summary,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) { return errorResult("factory_summary", "Factory Summary", err); }
}

// ---------------------------------------------------------------------------
// Formatters — compact text for LLM context
// ---------------------------------------------------------------------------

function ln(row: any): string { return row?.lines?.name || row?.lines?.line_id || "Unknown line"; }
function po(row: any): string { return row?.work_orders?.po_number || row?.po_number || "N/A"; }
function buyer(row: any): string { return row?.work_orders?.buyer || row?.buyer_name || ""; }

function fmtFactorySummary(stats: {
  today: string;
  sewingLinesReporting: number;
  sewingTotalGood: number;
  sewingTotalReject: number;
  sewingTotalManpower: number;
  sewingDailyTarget: number;
  sewingEfficiency: number;
  cuttingLinesReporting: number;
  cuttingTotalDay: number;
  cuttingTotalInput: number;
  finishingLinesReporting: number;
  finishingTotalPoly: number;
  finishingTotalCarton: number;
  blockerCount: number;
  criticalBlockers: number;
  activeLines: number;
  totalActiveOrders: number;
  totalOrderQty: number;
}): string {
  let t = `╔══════════════════════════════════════════════════════════════╗\n`;
  t += `║           FACTORY PRODUCTION SUMMARY - ${stats.today}           ║\n`;
  t += `╠══════════════════════════════════════════════════════════════╣\n`;
  t += `║ SEWING DEPARTMENT                                           ║\n`;
  t += `║   Lines Reporting: ${stats.sewingLinesReporting}                                       ║\n`;
  t += `║   Total Good Output: ${stats.sewingTotalGood.toLocaleString()} pcs                              ║\n`;
  t += `║   Total Rejects: ${stats.sewingTotalReject.toLocaleString()} pcs                                 ║\n`;
  t += `║   Daily Target: ${stats.sewingDailyTarget.toLocaleString()} pcs                                  ║\n`;
  t += `║   Efficiency: ${stats.sewingEfficiency}%                                            ║\n`;
  t += `║   Total Manpower: ${stats.sewingTotalManpower}                                        ║\n`;
  t += `╠══════════════════════════════════════════════════════════════╣\n`;
  t += `║ CUTTING DEPARTMENT                                          ║\n`;
  t += `║   Lines Reporting: ${stats.cuttingLinesReporting}                                       ║\n`;
  t += `║   Total Day Cutting: ${stats.cuttingTotalDay.toLocaleString()} pcs                             ║\n`;
  t += `║   Total Day Input: ${stats.cuttingTotalInput.toLocaleString()} pcs                               ║\n`;
  t += `╠══════════════════════════════════════════════════════════════╣\n`;
  t += `║ FINISHING DEPARTMENT                                        ║\n`;
  t += `║   Lines Reporting: ${stats.finishingLinesReporting}                                       ║\n`;
  t += `║   Total Poly: ${stats.finishingTotalPoly.toLocaleString()} pcs                                   ║\n`;
  t += `║   Total Carton: ${stats.finishingTotalCarton.toLocaleString()} pcs                                 ║\n`;
  t += `╠══════════════════════════════════════════════════════════════╣\n`;
  t += `║ BLOCKERS                                                    ║\n`;
  t += `║   Active Blockers: ${stats.blockerCount}                                        ║\n`;
  t += `║   Critical: ${stats.criticalBlockers}                                               ║\n`;
  t += `╠══════════════════════════════════════════════════════════════╣\n`;
  t += `║ WORK ORDERS                                                 ║\n`;
  t += `║   Active Orders: ${stats.totalActiveOrders}                                          ║\n`;
  t += `║   Total Order Quantity: ${stats.totalOrderQty.toLocaleString()} pcs                        ║\n`;
  t += `║   Active Lines: ${stats.activeLines}                                           ║\n`;
  t += `╚══════════════════════════════════════════════════════════════╝\n`;
  return t;
}

function fmtSewingOutput(data: any[], today: string, agg: SewingAggregates): string {
  if (!data.length) return `No sewing output submitted for ${today}.`;
  
  let t = `===== SEWING OUTPUT AGGREGATES (${today}) =====\n`;
  t += `Lines Reporting: ${agg.linesReporting}\n`;
  t += `Total Good Output: ${agg.totalGood.toLocaleString()} pcs\n`;
  t += `Total Rejects: ${agg.totalReject.toLocaleString()} pcs\n`;
  t += `Total Rework: ${agg.totalRework.toLocaleString()} pcs\n`;
  t += `Total Manpower: ${agg.totalManpower}\n`;
  t += `Cumulative Good (All Time): ${agg.totalCumulativeGood.toLocaleString()} pcs\n`;
  t += `Average Good Per Line: ${agg.avgGoodPerLine.toLocaleString()} pcs\n`;
  if (agg.topPerformingLine) t += `Top Performing Line: ${agg.topPerformingLine.name} (${agg.topPerformingLine.good} pcs)\n`;
  if (agg.lowestPerformingLine && agg.linesReporting > 1) t += `Lowest Performing Line: ${agg.lowestPerformingLine.name} (${agg.lowestPerformingLine.good} pcs)\n`;
  if (agg.linesWithBlockers > 0) t += `Lines with Blockers: ${agg.linesWithBlockers}\n`;
  t += `================================================\n\n`;
  
  t += `Per-line breakdown:\n`;
  for (const r of data) {
    t += `  - ${ln(r)} (${po(r)}, ${buyer(r)}): Good=${r.good_today}, Reject=${r.reject_today}, Rework=${r.rework_today}, MP=${r.manpower_actual}, Cumulative=${r.cumulative_good_total}`;
    if (r.has_blocker) t += ` [BLOCKER: ${r.blocker_description || "unspecified"}]`;
    t += "\n";
  }
  return t;
}

function fmtSewingTargets(data: any[], today: string, agg: SewingTargetAggregates): string {
  if (!data.length) return `No sewing targets set for ${today}.`;
  
  let t = `===== SEWING TARGETS AGGREGATES (${today}) =====\n`;
  t += `Lines with Targets: ${agg.linesWithTargets}\n`;
  t += `Total Planned Manpower: ${agg.totalPlannedManpower}\n`;
  t += `Total Planned OT Hours: ${agg.totalPlannedOT}\n`;
  t += `Average Per-Hour Target: ${agg.avgPerHourTarget} pcs/hr\n`;
  t += `Total Daily Target (8hr): ${agg.totalDailyTarget.toLocaleString()} pcs\n`;
  t += `==============================================\n\n`;
  
  t += `Per-line targets:\n`;
  for (const r of data) {
    t += `  - ${ln(r)} (${po(r)}): ${r.per_hour_target}/hr target, ${r.manpower_planned} planned MP, ${r.ot_hours_planned || 0}hr OT\n`;
  }
  return t;
}

function fmtBlockers(data: any[], agg: BlockerAggregates): string {
  if (!data.length) return "No active blockers currently open.";
  
  let t = `===== BLOCKER AGGREGATES =====\n`;
  t += `Total Active: ${agg.totalActive}\n`;
  t += `Open: ${agg.openCount} | In Progress: ${agg.inProgressCount}\n`;
  t += `By Severity: Critical=${agg.criticalCount}, High=${agg.highCount}, Medium=${agg.mediumCount}, Low=${agg.lowCount}\n`;
  t += `By Department: Sewing=${agg.byDepartment.sewing}, Finishing=${agg.byDepartment.finishing}\n`;
  if (agg.topBlockerTypes.length) {
    t += `Top Blocker Types:\n`;
    for (const bt of agg.topBlockerTypes) {
      t += `  - ${bt.type}: ${bt.count}\n`;
    }
  }
  t += `==============================\n\n`;

  t += `Blocker Details:\n`;
  for (const b of data) {
    const impact = (b.blocker_impact || "unknown").toUpperCase();
    const type = b.blocker_types?.name || "Unknown type";
    t += `  - [${impact}] ${b.department} / ${ln(b)} (${po(b)}): ${b.blocker_description || "No description"}\n`;
    t += `    Type: ${type} | Status: ${b.blocker_status} | Owner: ${b.blocker_owner || "unassigned"} | Date: ${b.production_date}\n`;
  }
  return t;
}

function fmtWorkOrders(
  data: any[],
  sewingMap: Map<string, number>,
  finishingMap: Map<string, number>,
  agg: WorkOrderAggregates,
): string {
  if (!data.length) return "No matching active work orders found.";

  let t = `===== WORK ORDER AGGREGATES =====\n`;
  t += `Active Orders: ${agg.activeCount}\n`;
  t += `Total Order Quantity: ${agg.totalQty.toLocaleString()} pcs\n`;
  t += `Total Sewing Output: ${agg.totalSewingOutput.toLocaleString()} pcs\n`;
  t += `Total Finishing Output: ${agg.totalFinishingOutput.toLocaleString()} pcs\n`;
  t += `Average Progress: ${agg.avgProgress}%\n`;
  t += `Orders Nearing Completion (80%+): ${agg.ordersNearingCompletion}\n`;
  t += `Orders Behind Schedule: ${agg.ordersBehindSchedule}\n`;
  if (agg.topBuyers.length) {
    t += `\nTop Buyers by Order Qty:\n`;
    for (const b of agg.topBuyers) {
      t += `  - ${b.buyer}: ${b.qty.toLocaleString()} pcs (${b.orderCount} orders)\n`;
    }
  }
  if (agg.upcomingExFactory.length) {
    t += `\nUpcoming Ex-Factory Dates (next 14 days):\n`;
    for (const ex of agg.upcomingExFactory) {
      t += `  - ${ex.po} (${ex.buyer}): ${ex.date}\n`;
    }
  }
  t += `=================================\n\n`;

  t += `Active Work Orders (${data.length}):\n`;
  for (const wo of data) {
    const sewingOutput = sewingMap.get(wo.id) || 0;
    const finishingOutput = finishingMap.get(wo.id) || 0;
    const orderQty = wo.order_qty || 0;
    const woStatus = (wo.status || "active").toLowerCase();
    const isComplete = /complete|completed|done|shipped|closed/i.test(woStatus);
    // Progress % uses finishing carton output (matches frontend source of truth)
    const pct = isComplete ? 100 : (orderQty > 0 ? Math.min(Math.round((finishingOutput / orderQty) * 100), 100) : 0);
    const lineName = wo.lines?.name || wo.lines?.line_id || "Unassigned";
    t += `  - ${wo.po_number} | ${wo.buyer} / ${wo.style}`;
    if (wo.item) t += ` / ${wo.item}`;
    if (wo.color) t += ` (${wo.color})`;
    t += `\n    Order: ${orderQty} pcs | Sewing Output: ${sewingOutput} pcs | Finishing Output: ${finishingOutput} pcs (${pct}%) | Line: ${lineName}\n`;
    if (wo.planned_ex_factory) t += `    Planned Ex-Factory: ${wo.planned_ex_factory}`;
    if (wo.actual_ex_factory) t += ` | Actual: ${wo.actual_ex_factory}`;
    if (wo.planned_ex_factory || wo.actual_ex_factory) t += "\n";
    t += `    Status: ${wo.status || "active"} | SMV: ${wo.smv || "N/A"} | Target: ${wo.target_per_hour || "N/A"}/hr\n`;
  }
  return t;
}

function fmtCutting(actuals: any[], targets: any[], today: string, agg: CuttingAggregates): string {
  if (!actuals.length && !targets.length) return `No cutting data submitted for ${today}.`;
  
  let t = `===== CUTTING AGGREGATES (${today}) =====\n`;
  t += `Lines Reporting: ${agg.linesReporting}\n`;
  t += `Total Day Cutting: ${agg.totalDayCutting.toLocaleString()} pcs\n`;
  t += `Total Day Input: ${agg.totalDayInput.toLocaleString()} pcs\n`;
  t += `Total Balance: ${agg.totalBalance.toLocaleString()} pcs\n`;
  t += `Total Manpower: ${agg.totalManpower}\n`;
  t += `Average Cutting Per Line: ${agg.avgCuttingPerLine.toLocaleString()} pcs\n`;
  t += `=======================================\n\n`;
  
  if (targets.length) {
    t += `Targets (${targets.length}):\n`;
    for (const r of targets) {
      t += `  - ${ln(r)} (${po(r)}): MP=${r.man_power}, Marker=${r.marker_capacity}, Lay=${r.lay_capacity}, Cut Cap=${r.cutting_capacity}\n`;
    }
    t += "\n";
  }
  if (actuals.length) {
    t += `Actuals (${actuals.length}):\n`;
    for (const r of actuals) {
      t += `  - ${ln(r)} (${po(r)}): Day Cut=${r.day_cutting}, Day Input=${r.day_input}, Total Cut=${r.total_cutting || 0}, Balance=${r.balance || 0}\n`;
    }
  }
  return t;
}

function fmtFinishing(data: any[], today: string, agg: FinishingAggregates): string {
  if (!data.length) return `No finishing data submitted for ${today}.`;
  const targets = data.filter((r) => r.log_type === "TARGET");
  const outputs = data.filter((r) => r.log_type === "OUTPUT");

  let t = `===== FINISHING AGGREGATES (${today}) =====\n`;
  t += `Lines Reporting Output: ${agg.linesReporting}\n`;
  t += `Total Poly: ${agg.totalPoly.toLocaleString()} pcs\n`;
  t += `Total Carton: ${agg.totalCarton.toLocaleString()} pcs\n`;
  t += `Total Iron: ${agg.totalIron.toLocaleString()} pcs\n`;
  t += `Total Thread Cutting: ${agg.totalThreadCutting.toLocaleString()} pcs\n`;
  t += `Average Poly Per Line: ${agg.avgPolyPerLine.toLocaleString()} pcs\n`;
  t += `Average Carton Per Line: ${agg.avgCartonPerLine.toLocaleString()} pcs\n`;
  t += `========================================\n\n`;
  
  if (targets.length) {
    t += `Targets (${targets.length}):\n`;
    for (const r of targets) {
      t += `  - ${ln(r)}: ThreadCut=${r.thread_cutting || 0}, InsideCheck=${r.inside_check || 0}, Iron=${r.iron || 0}, Poly=${r.poly || 0}, Carton=${r.carton || 0}\n`;
    }
    t += "\n";
  }
  if (outputs.length) {
    t += `Outputs (${outputs.length}):\n`;
    for (const r of outputs) {
      t += `  - ${ln(r)}: ThreadCut=${r.thread_cutting || 0}, InsideCheck=${r.inside_check || 0}, Iron=${r.iron || 0}, Poly=${r.poly || 0}, Carton=${r.carton || 0}\n`;
    }
  }
  return t;
}

function fmtStorage(data: any[], totalBinCards: number, totalPackageQty: number): string {
  if (!data.length) return "No storage bin cards found.";
  
  let t = `===== STORAGE AGGREGATES =====\n`;
  t += `Total Bin Cards: ${totalBinCards}\n`;
  t += `Total Package Quantity: ${totalPackageQty.toLocaleString()}\n`;
  t += `==============================\n\n`;
  
  t += `Bin Card Details:\n`;
  for (const c of data) {
    const woPo = c.work_orders?.po_number || "N/A";
    t += `  - PO: ${woPo} | Buyer: ${c.buyer || "N/A"} | Style: ${c.style || "N/A"}`;
    if (c.color) t += ` | Color: ${c.color}`;
    if (c.supplier_name) t += ` | Supplier: ${c.supplier_name}`;
    if (c.package_qty) t += ` | Pkg Qty: ${c.package_qty}`;
    t += "\n";
  }
  return t;
}

function fmtLines(lines: any[], actuals: any[], targets: any[], today: string, agg: LineAggregates): string {
  if (!lines.length) return "No active lines found.";

  const outputByLine = new Map<string, number>();
  for (const a of actuals) {
    outputByLine.set(a.line_id, (outputByLine.get(a.line_id) || 0) + (a.good_today || 0));
  }
  const targetByLine = new Map<string, number>();
  for (const t of targets) {
    targetByLine.set(t.line_id, (targetByLine.get(t.line_id) || 0) + ((t.per_hour_target || 0) * 8));
  }

  const statuses = lines.map((line) => {
    const output = outputByLine.get(line.id) || 0;
    const target = targetByLine.get(line.id) || 0;
    const pct = target > 0 ? Math.round((output / target) * 100) : 0;
    return { name: line.name || line.line_id, output, target, pct };
  });

  // Sort by efficiency ascending — behind-target lines first
  statuses.sort((a, b) => a.pct - b.pct);

  let t = `===== LINE PERFORMANCE AGGREGATES (${today}) =====\n`;
  t += `Total Active Lines: ${agg.totalActiveLines}\n`;
  t += `Lines with Output Today: ${agg.linesWithOutputToday}\n`;
  t += `Lines On Target (100%+): ${agg.linesOnTarget}\n`;
  t += `Lines Behind Target: ${agg.linesBehindTarget}\n`;
  t += `Average Efficiency: ${agg.avgEfficiency}%\n`;
  if (agg.topPerformers.length) {
    t += `\nTop Performers:\n`;
    for (const tp of agg.topPerformers) {
      t += `  - ${tp.name}: ${tp.efficiency}% efficiency\n`;
    }
  }
  if (agg.needsAttention.length) {
    t += `\nNeeds Attention (below 80%):\n`;
    for (const na of agg.needsAttention) {
      t += `  - ${na.name}: ${na.efficiency}% efficiency\n`;
    }
  }
  t += `==============================================\n\n`;
  
  t += `All Line Status:\n`;
  for (const ls of statuses) {
    const status = ls.target === 0
      ? "(no target set)"
      : ls.pct >= 100 ? `ON TARGET (${ls.pct}%)` : `BEHIND (${ls.pct}%)`;
    t += `  - ${ls.name}: Output=${ls.output}, Target=${ls.target}, ${status}\n`;
  }
  return t;
}

// ---------------------------------------------------------------------------
// Orchestrator — main entry point
// ---------------------------------------------------------------------------

export async function fetchLiveData(
  supabase: SupabaseClient,
  factoryId: string | null | undefined,
  message: string,
  factoryTimezone: string | null,
): Promise<LiveDataContext | null> {
  if (!factoryId) return null;

  const classification = classifyMessage(message);

  // Always include core factory data so the LLM has full context
  const cats = new Set<LiveDataCategory>(classification.categories);
  
  // Always include factory summary for comprehensive stats
  cats.add("factory_summary");
  cats.add("work_orders");
  cats.add("lines");
  
  classification.categories = Array.from(cats);

  const today = getTodayForFactory(factoryTimezone);
  console.log(`[LIVE-DATA] Categories: [${classification.categories.join(", ")}], today=${today}, poHint=${classification.poNumberHint}, buyerHint=${classification.buyerHint}, wantsSummary=${classification.wantsSummary}`);

  const fetchMap: Record<LiveDataCategory, () => Promise<LiveDataResult>> = {
    sewing_output: () => fetchSewingOutput(supabase, factoryId, today),
    sewing_targets: () => fetchSewingTargets(supabase, factoryId, today),
    blockers: () => fetchBlockers(supabase, factoryId),
    work_orders: () => fetchWorkOrders(supabase, factoryId, classification.poNumberHint, classification.buyerHint),
    cutting: () => fetchCutting(supabase, factoryId, today),
    finishing: () => fetchFinishing(supabase, factoryId, today),
    storage: () => fetchStorage(supabase, factoryId),
    lines: () => fetchLines(supabase, factoryId, today),
    factory_summary: () => fetchFactorySummary(supabase, factoryId, today),
  };

  const results = await Promise.all(
    classification.categories.map((cat) => fetchMap[cat]())
  );

  return { results, todayDate: today };
}
