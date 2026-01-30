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
  | "lines";

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

const MAX_ROWS = 20;

// ---------------------------------------------------------------------------
// Intent Classifier
// ---------------------------------------------------------------------------

interface Classification {
  categories: LiveDataCategory[];
  poNumberHint: string | null;
  buyerHint: string | null;
  lineNameHint: string | null;
}

export function classifyMessage(message: string): Classification {
  // Normalize smart/curly quotes and apostrophes to ASCII equivalents
  const normalized = message
    .replace(/[\u2018\u2019\u2032\u0060]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"');
  const lower = normalized.toLowerCase();
  const cats = new Set<LiveDataCategory>();

  // Blockers
  if (/blocker|blocked|block|issue|problem|obstacle|stuck|delay/i.test(lower)) {
    cats.add("blockers");
  }

  // Sewing output
  if (/sewing.?output|sewing.?actual|good.?today|reject|rework|sewing.?result|how much.*(sew|produc)/i.test(lower)) {
    cats.add("sewing_output");
  }

  // Sewing targets
  if (/sewing.?target|morning.?target|per.?hour.?target|manpower.?planned|target.?today/i.test(lower)) {
    cats.add("sewing_targets");
  }

  // Generic "sewing" → fetch both
  if (lower.includes("sewing") && !cats.has("sewing_output") && !cats.has("sewing_targets")) {
    cats.add("sewing_output");
    cats.add("sewing_targets");
  }

  // Cutting
  if (/cutting|cut.?output|cut.?today|day.?cutting|cutting.?status|cutting.?capacity|marker.?capacity|lay.?capacity/i.test(lower)) {
    cats.add("cutting");
  }

  // Finishing
  if (/finishing|poly|carton|iron|buttoning|thread.?cutting|inside.?check|top.?side|get.?up|finishing.?output/i.test(lower)) {
    cats.add("finishing");
  }

  // Work orders / PO
  if (/\bpo\b|purchase.?order|work.?order|\border\b|\bstatus\b|po-|buyer|brand|style|order.?qty|how.?far|ex.?factory|shipment|delivery|completion|complete/i.test(lower)) {
    cats.add("work_orders");
  }

  // Storage
  if (/storage|bin.?card|\bbin\b|fabric|stock|inventory|warehouse/i.test(lower)) {
    cats.add("storage");
  }

  // Lines
  if (/which.?line|line.?status|all.?lines|active.?lines|behind.?target|line.?performance|line.?efficiency/i.test(lower)) {
    cats.add("lines");
  }

  // Broad production queries (catch-all)
  if (
    cats.size === 0 &&
    /how.?many.*(produc|output|made|sew)|today.?s?.*(output|production|result)|(daily|today).*(summary|report|overview)|behind|efficiency|performance|ahead/i.test(lower)
  ) {
    cats.add("sewing_output");
    cats.add("sewing_targets");
    cats.add("blockers");
  }

  // Extract PO number hint
  const poMatch = lower.match(/po[- ]?(\d{2,6})/i);
  const poNumberHint = poMatch ? `PO-${poMatch[1].padStart(3, "0")}` : null;
  if (poNumberHint) cats.add("work_orders");

  // Extract buyer/brand hint — strip stopwords + production keywords, whatever remains is the buyer hint
  const STOPWORDS = /\b(how|far|are|we|with|the|what|is|status|of|for|on|about|our|my|a|an|any|order|orders|po|purchase|work|buyer|brand|production|update|progress|show|tell|me|get|give|can|you|please|do|does|current|currently|today|now|much|many|complete|completed|completion|done|behind|ahead|sewing|cutting|finishing|all|this|that|which|who|where|when|will|be|been|has|have|had|not|no|or|and|from|s)\b/gi;
  const cleaned = normalized.replace(STOPWORDS, "").replace(/[^a-zA-Z0-9&\s-]/g, "").replace(/\s+/g, " ").trim();
  const buyerHint = (!poNumberHint && cleaned.length >= 2) ? cleaned : null;
  if (buyerHint) cats.add("work_orders");

  // Extract line name hint
  const lineMatch = lower.match(/line[- ]?([a-z0-9]{1,4})/i);
  const lineNameHint = lineMatch ? lineMatch[0] : null;

  return {
    categories: Array.from(cats).slice(0, 4),
    poNumberHint,
    buyerHint,
    lineNameHint,
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
    return { category: "sewing_output", label: "Sewing Output (Today)", data: data || [], summary: fmtSewingOutput(data || [], today), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("sewing_output", "Sewing Output (Today)", err); }
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
    return { category: "sewing_targets", label: "Sewing Targets (Today)", data: data || [], summary: fmtSewingTargets(data || [], today), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("sewing_targets", "Sewing Targets (Today)", err); }
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

    return { category: "blockers", label: "Active Blockers", data: all, summary: fmtBlockers(all), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("blockers", "Active Blockers", err); }
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

    // Get cumulative progress from sewing_actuals — need per-line breakdown
    // because cumulative_good_total is per line, and orders can span multiple lines
    const progressMap = new Map<string, number>();
    if (data && data.length > 0 && data.length <= 15) {
      const woIds = data.map((wo: any) => wo.id);
      const { data: actuals } = await sb
        .from("sewing_actuals")
        .select("work_order_id, line_id, cumulative_good_total")
        .eq("factory_id", factoryId)
        .in("work_order_id", woIds)
        .order("production_date", { ascending: false });

      if (actuals) {
        // Step 1: For each (work_order, line) pair, keep the highest cumulative total
        const perLineMax = new Map<string, number>();
        for (const row of actuals) {
          const key = `${row.work_order_id}::${row.line_id}`;
          const existing = perLineMax.get(key) || 0;
          if ((row.cumulative_good_total || 0) > existing) {
            perLineMax.set(key, row.cumulative_good_total || 0);
          }
        }
        // Step 2: Sum across all lines for each work order
        for (const [key, value] of perLineMax) {
          const woId = key.split("::")[0];
          progressMap.set(woId, (progressMap.get(woId) || 0) + value);
        }
      }
    }

    const label = poHint ? `Work Order: ${poHint}` : buyerHint ? `Work Orders: ${buyerHint}` : "Active Work Orders";
    return { category: "work_orders", label, data: data || [], summary: fmtWorkOrders(data || [], progressMap), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("work_orders", "Work Orders", err); }
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

    return { category: "cutting", label: "Cutting Status (Today)", data: [...(actR.data || []), ...(tgtR.data || [])], summary: fmtCutting(actR.data || [], tgtR.data || [], today), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("cutting", "Cutting Status (Today)", err); }
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
    return { category: "finishing", label: "Finishing Status (Today)", data: data || [], summary: fmtFinishing(data || [], today), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("finishing", "Finishing Status (Today)", err); }
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
    return { category: "storage", label: "Storage Bin Cards", data: data || [], summary: fmtStorage(data || []), fetchedAt: new Date().toISOString() };
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
    return { category: "lines", label: "Line Status Overview", data: linesR.data || [], summary: fmtLines(linesR.data || [], actR.data || [], tgtR.data || [], today), fetchedAt: new Date().toISOString() };
  } catch (err) { return errorResult("lines", "Line Status Overview", err); }
}

// ---------------------------------------------------------------------------
// Formatters — compact text for LLM context
// ---------------------------------------------------------------------------

function ln(row: any): string { return row?.lines?.name || row?.lines?.line_id || "Unknown line"; }
function po(row: any): string { return row?.work_orders?.po_number || row?.po_number || "N/A"; }
function buyer(row: any): string { return row?.work_orders?.buyer || row?.buyer_name || ""; }

function fmtSewingOutput(data: any[], today: string): string {
  if (!data.length) return `No sewing output submitted for ${today}.`;
  const totalGood = data.reduce((s, r) => s + (r.good_today || 0), 0);
  const totalReject = data.reduce((s, r) => s + (r.reject_today || 0), 0);
  const totalRework = data.reduce((s, r) => s + (r.rework_today || 0), 0);
  const totalMP = data.reduce((s, r) => s + (r.manpower_actual || 0), 0);
  const withBlockers = data.filter((r) => r.has_blocker).length;

  let t = `Sewing Output for ${today} (${data.length} lines reported):\n`;
  t += `  Total Good: ${totalGood} pcs | Rejects: ${totalReject} | Rework: ${totalRework} | Total Manpower: ${totalMP}\n`;
  if (withBlockers > 0) t += `  Lines with blockers: ${withBlockers}\n`;
  t += `\n  Per-line breakdown:\n`;
  for (const r of data) {
    t += `  - ${ln(r)} (${po(r)}, ${buyer(r)}): Good=${r.good_today}, Reject=${r.reject_today}, Rework=${r.rework_today}, MP=${r.manpower_actual}, Cumulative=${r.cumulative_good_total}`;
    if (r.has_blocker) t += ` [BLOCKER: ${r.blocker_description || "unspecified"}]`;
    t += "\n";
  }
  return t;
}

function fmtSewingTargets(data: any[], today: string): string {
  if (!data.length) return `No sewing targets set for ${today}.`;
  let t = `Sewing Targets for ${today} (${data.length} lines):\n`;
  for (const r of data) {
    t += `  - ${ln(r)} (${po(r)}): ${r.per_hour_target}/hr target, ${r.manpower_planned} planned MP, ${r.ot_hours_planned || 0}hr OT\n`;
  }
  return t;
}

function fmtBlockers(data: any[]): string {
  if (!data.length) return "No active blockers currently open.";
  const open = data.filter((b) => b.blocker_status === "open").length;
  const inProg = data.filter((b) => b.blocker_status === "in_progress").length;
  const critical = data.filter((b) => b.blocker_impact === "critical").length;
  const high = data.filter((b) => b.blocker_impact === "high").length;

  let t = `Active Blockers: ${data.length} total (${open} open, ${inProg} in progress)`;
  if (critical) t += ` | CRITICAL: ${critical}`;
  if (high) t += ` | HIGH: ${high}`;
  t += "\n\n";

  for (const b of data) {
    const impact = (b.blocker_impact || "unknown").toUpperCase();
    const type = b.blocker_types?.name || "Unknown type";
    t += `  - [${impact}] ${b.department} / ${ln(b)} (${po(b)}): ${b.blocker_description || "No description"}\n`;
    t += `    Type: ${type} | Status: ${b.blocker_status} | Owner: ${b.blocker_owner || "unassigned"} | Date: ${b.production_date}\n`;
  }
  return t;
}

function fmtWorkOrders(data: any[], progressMap: Map<string, number>): string {
  if (!data.length) return "No matching active work orders found.";
  let t = `Active Work Orders (${data.length}):\n`;
  for (const wo of data) {
    const produced = progressMap.get(wo.id) || 0;
    const orderQty = wo.order_qty || 0;
    const woStatus = (wo.status || "active").toLowerCase();
    const isComplete = /complete|completed|done|shipped|closed/i.test(woStatus);
    // Use status field as truth: if marked complete, show 100% regardless of sewing data
    const pct = isComplete ? 100 : (orderQty > 0 ? Math.min(Math.round((produced / orderQty) * 100), 100) : 0);
    const lineName = wo.lines?.name || wo.lines?.line_id || "Unassigned";
    t += `  - ${wo.po_number} | ${wo.buyer} / ${wo.style}`;
    if (wo.item) t += ` / ${wo.item}`;
    if (wo.color) t += ` (${wo.color})`;
    t += `\n    Order: ${orderQty} pcs | Produced: ${produced} pcs (${pct}%) | Line: ${lineName}\n`;
    if (wo.planned_ex_factory) t += `    Planned Ex-Factory: ${wo.planned_ex_factory}`;
    if (wo.actual_ex_factory) t += ` | Actual: ${wo.actual_ex_factory}`;
    if (wo.planned_ex_factory || wo.actual_ex_factory) t += "\n";
    t += `    Status: ${wo.status || "active"} | SMV: ${wo.smv || "N/A"} | Target: ${wo.target_per_hour || "N/A"}/hr\n`;
  }
  return t;
}

function fmtCutting(actuals: any[], targets: any[], today: string): string {
  if (!actuals.length && !targets.length) return `No cutting data submitted for ${today}.`;
  let t = `Cutting Status for ${today}:\n`;
  if (targets.length) {
    t += `\n  Targets (${targets.length}):\n`;
    for (const r of targets) {
      t += `  - ${ln(r)} (${po(r)}): MP=${r.man_power}, Marker=${r.marker_capacity}, Lay=${r.lay_capacity}, Cut Cap=${r.cutting_capacity}\n`;
    }
  }
  if (actuals.length) {
    const totalDayCut = actuals.reduce((s, a) => s + (a.day_cutting || 0), 0);
    t += `\n  Actuals (${actuals.length}, total day cutting: ${totalDayCut}):\n`;
    for (const r of actuals) {
      t += `  - ${ln(r)} (${po(r)}): Day Cut=${r.day_cutting}, Day Input=${r.day_input}, Total Cut=${r.total_cutting || 0}, Balance=${r.balance || 0}\n`;
    }
  }
  return t;
}

function fmtFinishing(data: any[], today: string): string {
  if (!data.length) return `No finishing data submitted for ${today}.`;
  const targets = data.filter((r) => r.log_type === "TARGET");
  const outputs = data.filter((r) => r.log_type === "OUTPUT");

  let t = `Finishing Status for ${today}:\n`;
  if (targets.length) {
    t += `\n  Targets (${targets.length}):\n`;
    for (const r of targets) {
      t += `  - ${ln(r)}: ThreadCut=${r.thread_cutting || 0}, InsideCheck=${r.inside_check || 0}, Iron=${r.iron || 0}, Poly=${r.poly || 0}, Carton=${r.carton || 0}\n`;
    }
  }
  if (outputs.length) {
    const totalPoly = outputs.reduce((s, r) => s + (r.poly || 0), 0);
    const totalCarton = outputs.reduce((s, r) => s + (r.carton || 0), 0);
    t += `\n  Outputs (${outputs.length}, total poly: ${totalPoly}, total carton: ${totalCarton}):\n`;
    for (const r of outputs) {
      t += `  - ${ln(r)}: ThreadCut=${r.thread_cutting || 0}, InsideCheck=${r.inside_check || 0}, Iron=${r.iron || 0}, Poly=${r.poly || 0}, Carton=${r.carton || 0}\n`;
    }
  }
  return t;
}

function fmtStorage(data: any[]): string {
  if (!data.length) return "No storage bin cards found.";
  let t = `Storage Bin Cards (${data.length}):\n`;
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

function fmtLines(lines: any[], actuals: any[], targets: any[], today: string): string {
  if (!lines.length) return "No active lines found.";

  const outputByLine = new Map<string, number>();
  for (const a of actuals) {
    outputByLine.set(a.line_id, (outputByLine.get(a.line_id) || 0) + (a.good_today || 0));
  }
  const targetByLine = new Map<string, number>();
  for (const t of targets) {
    // approximate daily target = per_hour_target * 8 hours
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

  let t = `Active Lines: ${lines.length} | With output today: ${outputByLine.size}\n\n`;
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
  if (classification.categories.length === 0) return null;

  const today = getTodayForFactory(factoryTimezone);
  console.log(`[LIVE-DATA] Categories: [${classification.categories.join(", ")}], today=${today}, poHint=${classification.poNumberHint}, buyerHint=${classification.buyerHint}`);

  const fetchMap: Record<LiveDataCategory, () => Promise<LiveDataResult>> = {
    sewing_output: () => fetchSewingOutput(supabase, factoryId, today),
    sewing_targets: () => fetchSewingTargets(supabase, factoryId, today),
    blockers: () => fetchBlockers(supabase, factoryId),
    work_orders: () => fetchWorkOrders(supabase, factoryId, classification.poNumberHint, classification.buyerHint),
    cutting: () => fetchCutting(supabase, factoryId, today),
    finishing: () => fetchFinishing(supabase, factoryId, today),
    storage: () => fetchStorage(supabase, factoryId),
    lines: () => fetchLines(supabase, factoryId, today),
  };

  const results = await Promise.all(
    classification.categories.map((cat) => fetchMap[cat]())
  );

  return { results, todayDate: today };
}
