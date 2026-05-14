// QC PDF generator — produces shippable single-record and bulk PDFs that
// mirror the on-screen Daily Sheet / Order Tracker detail pages. Each
// record ends with a sign-off block showing the admin's stored signature
// image (from user_signatures.signature_url).

import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { formatShortDate, formatTimeInTimezone } from "@/lib/date-utils";

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

export interface QCPdfItem {
  section_label: string;
  section_order: number;
  item_code: string;
  item_label: string;
  item_guidance?: string | null;
  /** "pass" | "fail" | "na" | "pending" for daily sheets,
   *  "done" | "issue" | "na" | "pending" for trackers. */
  status: string;
  notes?: string | null;
  /** Tracker items only. */
  target_date?: string | null;
}

export interface QCDailySheetPdfPayload {
  kind: "daily_sheet";
  id: string;
  factory_name: string;
  factory_timezone: string;
  // Header fields
  po_number: string;
  buyer: string;
  style: string;
  order_qty: number | null;
  line_name: string;
  shift: string;
  inspection_date: string;
  inspector_name: string | null;
  product_type: string | null;
  fabric: string | null;
  target_qty: number | null;
  planned_ex_factory: string | null;
  // Sign-off
  status: "signed_off";
  manager_name: string | null;
  manager_signoff_at: string | null;
  signature_url: string | null;
  // Items
  items: QCPdfItem[];
}

export interface QCTrackerPdfPayload {
  kind: "order_tracker";
  id: string;
  factory_name: string;
  factory_timezone: string;
  // Header fields
  po_number: string;
  buyer: string;
  style: string;
  order_qty: number | null;
  season: string | null;
  fabric: string | null;
  ship_date: string | null;
  planned_ex_factory: string | null;
  // Sign-off
  status: "signed_off";
  manager_name: string | null;
  manager_signoff_at: string | null;
  signature_url: string | null;
  // Items
  items: QCPdfItem[];
}

export type QCPdfPayload = QCDailySheetPdfPayload | QCTrackerPdfPayload;

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Phase colors — match the on-screen palette so the PDF reads the same way. */
const PHASE_RGB: Array<{ banner: [number, number, number]; tint: [number, number, number] }> = [
  // navy
  { banner: [30, 41, 59], tint: [240, 244, 252] },
  // sienna / amber
  { banner: [180, 83, 9], tint: [254, 243, 199] },
  // plum / violet
  { banner: [88, 28, 135], tint: [243, 232, 255] },
  // forest / emerald
  { banner: [6, 95, 70], tint: [220, 252, 231] },
  // deep blue
  { banner: [30, 64, 175], tint: [219, 234, 254] },
  // rose
  { banner: [157, 23, 77], tint: [253, 224, 230] },
];

const STATUS_LABEL: Record<string, { label: string; rgb: [number, number, number] }> = {
  pass: { label: "PASS", rgb: [16, 185, 129] },
  done: { label: "DONE", rgb: [16, 185, 129] },
  fail: { label: "FAIL", rgb: [220, 38, 38] },
  issue: { label: "ISSUE", rgb: [217, 119, 6] },
  na: { label: "N/A", rgb: [120, 113, 108] },
  pending: { label: "PENDING", rgb: [100, 116, 139] },
};

interface PageCtx {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  margin: number;
  /** Current Y position in mm. */
  y: number;
  /** Last record-id rendered, used by addRecordSeparator to skip the first separator. */
  pageNumberStart: number;
}

function newDoc(): jsPDF {
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
}

function newCtx(doc: jsPDF): PageCtx {
  return {
    doc,
    pageW: doc.internal.pageSize.getWidth(),
    pageH: doc.internal.pageSize.getHeight(),
    margin: 12,
    y: 12,
    pageNumberStart: 1,
  };
}

/** Ensure at least `needed` mm of vertical space; otherwise start a new page. */
function ensureSpace(ctx: PageCtx, needed: number) {
  if (ctx.y + needed > ctx.pageH - 18 /* footer reserve */) {
    ctx.doc.addPage();
    ctx.y = 12;
  }
}

function drawHeaderBand(ctx: PageCtx, payload: QCPdfPayload) {
  const { doc, pageW, margin } = ctx;
  const h = 22;
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, ctx.y, pageW - margin * 2, h, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(payload.factory_name, margin + 4, ctx.y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    payload.kind === "daily_sheet"
      ? "DAILY QC SHEET — Signed off"
      : "ORDER MANAGER TRACKER — Signed off",
    margin + 4,
    ctx.y + 17
  );
  // Status pill on the right
  doc.setFillColor(16, 185, 129);
  const pillW = 28;
  doc.roundedRect(pageW - margin - pillW - 4, ctx.y + 6, pillW, 9, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SIGNED OFF", pageW - margin - pillW - 4 + pillW / 2, ctx.y + 12, {
    align: "center",
  });
  ctx.y += h + 4;
}

function drawDetailsGrid(ctx: PageCtx, payload: QCPdfPayload) {
  const { doc, pageW, margin } = ctx;
  const fields: Array<{ label: string; value: string }> =
    payload.kind === "daily_sheet"
      ? [
          { label: "Order / PO No.", value: payload.po_number },
          { label: "Buyer", value: payload.buyer },
          { label: "Style", value: payload.style },
          { label: "Total Qty", value: payload.order_qty ? `${payload.order_qty.toLocaleString()} pcs` : "—" },
          { label: "Line", value: payload.line_name || "—" },
          { label: "Shift", value: capitalize(payload.shift) },
          { label: "Inspection Date", value: formatShortDate(payload.inspection_date) },
          { label: "Inspector", value: payload.inspector_name || "—" },
          { label: "Product Type", value: payload.product_type || "—" },
          { label: "Fabric / Material", value: payload.fabric || "—" },
          { label: "Target Qty", value: payload.target_qty ? `${payload.target_qty.toLocaleString()} pcs` : "—" },
          { label: "FOB / Ex-Factory", value: payload.planned_ex_factory ? formatShortDate(payload.planned_ex_factory) : "—" },
        ]
      : [
          { label: "Order / PO No.", value: payload.po_number },
          { label: "Buyer", value: payload.buyer },
          { label: "Season", value: payload.season || "—" },
          { label: "Ship Date", value: payload.ship_date ? formatShortDate(payload.ship_date) : "—" },
          { label: "Style", value: payload.style },
          { label: "Total Qty", value: payload.order_qty ? `${payload.order_qty.toLocaleString()} pcs` : "—" },
          { label: "Fabric", value: payload.fabric || "—" },
          { label: "FOB / Ex-Factory", value: payload.planned_ex_factory ? formatShortDate(payload.planned_ex_factory) : "—" },
        ];

  const cols = 4;
  const cellW = (pageW - margin * 2) / cols;
  const cellH = 13;
  const totalH = Math.ceil(fields.length / cols) * cellH;

  ensureSpace(ctx, totalH + 6);

  // Outer border
  doc.setDrawColor(220, 226, 240);
  doc.setLineWidth(0.2);
  doc.rect(margin, ctx.y, pageW - margin * 2, totalH);

  fields.forEach((field, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * cellW;
    const cy = ctx.y + row * cellH;

    // Cell separators
    if (col > 0) {
      doc.line(x, cy, x, cy + cellH);
    }
    if (row > 0) {
      doc.line(x, cy, x + cellW, cy);
    }

    // Label
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(field.label.toUpperCase(), x + 2.5, cy + 4.5);

    // Value
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const truncated = doc.splitTextToSize(field.value, cellW - 5)[0] ?? "";
    doc.text(truncated, x + 2.5, cy + 10);
  });

  ctx.y += totalH + 6;
}

function drawSectionHeader(
  ctx: PageCtx,
  phaseNum: number,
  label: string,
  paletteIdx: number,
  summary: { done: number; issue: number; pending: number; total: number }
) {
  const { doc, pageW, margin } = ctx;
  const h = 9;
  ensureSpace(ctx, h + 2);

  const palette = PHASE_RGB[paletteIdx % PHASE_RGB.length];
  doc.setFillColor(...palette.banner);
  doc.rect(margin, ctx.y, pageW - margin * 2, h, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  // Strip "PHASE N —" / "SECTION N —" prefix the template label may already
  // include — otherwise the phase number renders twice in the banner.
  const cleanLabel = label.replace(/^(PHASE|SECTION)\s+\d+\s*[—\-:]\s*/i, "");
  doc.text(`PHASE ${phaseNum}  —  ${cleanLabel.toUpperCase()}`, margin + 3, ctx.y + 6);

  // Right-side summary — ASCII only; jsPDF's default Helvetica is Latin-1
  // and renders unicode glyphs (checks, alerts, hourglasses) as garbage.
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const right = `Done ${summary.done}  ·  Issue ${summary.issue}  ·  Pending ${summary.pending}  ·  ${summary.total} item${summary.total === 1 ? "" : "s"}`;
  doc.text(right, pageW - margin - 3, ctx.y + 6, { align: "right" });

  ctx.y += h;
}

function drawItem(ctx: PageCtx, item: QCPdfItem, paletteIdx: number) {
  const { doc, pageW, margin } = ctx;
  const rowH = item.notes && item.notes.trim() ? 12 : 8;
  ensureSpace(ctx, rowH + 1);

  const palette = PHASE_RGB[paletteIdx % PHASE_RGB.length];

  // Light tinted body
  doc.setFillColor(...palette.tint);
  doc.rect(margin, ctx.y, pageW - margin * 2, rowH, "F");
  doc.setDrawColor(220, 226, 240);
  doc.setLineWidth(0.1);
  doc.line(margin, ctx.y + rowH, pageW - margin, ctx.y + rowH);

  // Item code + label
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(item.item_code, margin + 3, ctx.y + 5);
  doc.setFont("helvetica", "normal");
  const labelMaxW = pageW - margin * 2 - 70;
  const label = doc.splitTextToSize(item.item_label, labelMaxW)[0] ?? "";
  doc.text(label, margin + 18, ctx.y + 5);

  // Status pill
  const statusKey = item.status.toLowerCase();
  const sMeta = STATUS_LABEL[statusKey] ?? STATUS_LABEL.pending;
  doc.setFillColor(...sMeta.rgb);
  const pillW = 18;
  doc.roundedRect(pageW - margin - pillW - 3, ctx.y + 1.5, pillW, 5, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(sMeta.label, pageW - margin - pillW - 3 + pillW / 2, ctx.y + 5, { align: "center" });

  // Target date (tracker items)
  if (item.target_date) {
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Target: ${formatShortDate(item.target_date)}`, pageW - margin - pillW - 8, ctx.y + 5, {
      align: "right",
    });
  }

  // Notes line
  if (item.notes && item.notes.trim()) {
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    const noteW = pageW - margin * 2 - 6;
    const lines = doc.splitTextToSize(`Note: ${item.notes.trim()}`, noteW);
    doc.text(lines[0] ?? "", margin + 3, ctx.y + 10);
  }

  ctx.y += rowH;
}

function drawSignoffFooter(
  ctx: PageCtx,
  payload: QCPdfPayload,
  signatureDataUrl: string | null
) {
  const { doc, pageW, margin } = ctx;

  // Push to a stable position near bottom; if not enough space, new page first.
  const needed = 38;
  if (ctx.y + needed > ctx.pageH - 12) {
    doc.addPage();
    ctx.y = 12;
  }

  // Push the footer down to near the bottom so it always lives at the page foot.
  const footerY = ctx.pageH - margin - 30;
  ctx.y = Math.max(ctx.y, footerY);

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(margin, ctx.y, pageW - margin, ctx.y);

  ctx.y += 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("ORDER SIGN-OFF SUMMARY", margin, ctx.y + 4);

  ctx.y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 70, 90);
  const signedAtText = payload.manager_signoff_at
    ? `${formatShortDate(payload.manager_signoff_at)} ${formatTimeInTimezone(
        payload.manager_signoff_at,
        payload.factory_timezone
      )}`
    : "—";

  doc.text(`Signed off by:  ${payload.manager_name || "—"}`, margin, ctx.y);
  doc.text(`Signed off at:  ${signedAtText}`, margin, ctx.y + 5);

  // Signature on the right
  const sigW = 50;
  const sigH = 18;
  const sigX = pageW - margin - sigW;
  const sigY = ctx.y - 2;
  doc.setDrawColor(180, 190, 210);
  doc.setLineWidth(0.2);
  doc.rect(sigX, sigY, sigW, sigH);
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, "PNG", sigX + 2, sigY + 2, sigW - 4, sigH - 4);
    } catch {
      // ignore signature draw errors
    }
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 130, 150);
  doc.text("Manager Signature", sigX + sigW / 2, sigY + sigH + 4, { align: "center" });

  ctx.y = sigY + sigH + 8;
}

function capitalize(s: string): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ──────────────────────────────────────────────────────────────────────
// Section grouping
// ──────────────────────────────────────────────────────────────────────

function groupSections(items: QCPdfItem[]) {
  const map = new Map<string, { order: number; items: QCPdfItem[] }>();
  for (const it of items) {
    const g = map.get(it.section_label) ?? { order: it.section_order, items: [] };
    g.items.push(it);
    map.set(it.section_label, g);
  }
  return Array.from(map.entries())
    .map(([label, g]) => ({ label, order: g.order, items: g.items }))
    .sort((a, b) => a.order - b.order);
}

function summarize(items: QCPdfItem[]) {
  const c = { done: 0, issue: 0, pending: 0, na: 0, total: items.length };
  for (const it of items) {
    const s = it.status.toLowerCase();
    if (s === "pass" || s === "done") c.done += 1;
    else if (s === "fail" || s === "issue") c.issue += 1;
    else if (s === "na") c.na += 1;
    else c.pending += 1;
  }
  return c;
}

// ──────────────────────────────────────────────────────────────────────
// Per-record renderer
// ──────────────────────────────────────────────────────────────────────

async function renderRecord(ctx: PageCtx, payload: QCPdfPayload) {
  let signatureDataUrl: string | null = null;
  if (payload.signature_url) {
    try {
      signatureDataUrl = await fetchImageAsDataUrl(payload.signature_url);
    } catch (e) {
      console.warn("Could not load signature image", e);
    }
  }

  drawHeaderBand(ctx, payload);
  drawDetailsGrid(ctx, payload);

  const grouped = groupSections(payload.items);
  grouped.forEach((g, idx) => {
    drawSectionHeader(ctx, g.order, g.label, idx, summarize(g.items));
    g.items.forEach((it) => drawItem(ctx, it, idx));
    ctx.y += 2;
  });

  drawSignoffFooter(ctx, payload, signatureDataUrl);
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

export async function generateQCRecordPDF(payload: QCPdfPayload): Promise<Blob> {
  const doc = newDoc();
  const ctx = newCtx(doc);
  await renderRecord(ctx, payload);
  return doc.output("blob");
}

export async function generateQCBulkPDF(payloads: QCPdfPayload[]): Promise<Blob> {
  if (payloads.length === 0) throw new Error("No records to export");
  const doc = newDoc();
  const ctx = newCtx(doc);
  for (let i = 0; i < payloads.length; i++) {
    if (i > 0) {
      doc.addPage();
      ctx.y = 12;
    }
    await renderRecord(ctx, payloads[i]);
  }

  // Page numbering across the entire document
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 150);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Page ${p} of ${total}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" }
    );
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ──────────────────────────────────────────────────────────────────────
// Data loaders — gather all the fields needed for a payload from Supabase
// ──────────────────────────────────────────────────────────────────────

interface LoaderCtx {
  factoryName: string;
  factoryTimezone: string;
}

export async function loadDailySheetPayload(
  sheetId: string,
  ctxIn: LoaderCtx
): Promise<QCDailySheetPdfPayload> {
  const { data: sheet, error } = await supabase
    .from("qc_daily_sheets")
    .select(
      `id, status, inspection_date, shift, product_type, fabric, target_qty,
       inspector_id, manager_signoff_by, manager_signoff_at,
       work_orders(po_number, buyer, style, order_qty, planned_ex_factory),
       lines(name, line_id)`
    )
    .eq("id", sheetId)
    .single();
  if (error || !sheet) throw new Error(error?.message || "Sheet not found");
  if (sheet.status !== "signed_off") throw new Error("Only signed-off sheets can be exported.");

  const { data: items } = await supabase
    .from("qc_daily_sheet_items")
    .select("section_label, section_order, item_code, item_label, item_guidance, status, notes")
    .eq("sheet_id", sheetId)
    .order("section_order")
    .order("item_order");

  // Resolve names for inspector + manager
  const userIds = [sheet.inspector_id, sheet.manager_signoff_by].filter(Boolean) as string[];
  const namesById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of profs || []) namesById.set(p.id, p.full_name ?? "");
  }

  let signatureUrl: string | null = null;
  if (sheet.manager_signoff_by) {
    const { data: sig } = await supabase
      .from("user_signatures")
      .select("signature_url")
      .eq("user_id", sheet.manager_signoff_by)
      .maybeSingle();
    signatureUrl = sig?.signature_url ?? null;
  }

  const wo = (sheet as any).work_orders ?? {};
  const ln = (sheet as any).lines ?? {};

  return {
    kind: "daily_sheet",
    id: sheet.id,
    factory_name: ctxIn.factoryName,
    factory_timezone: ctxIn.factoryTimezone,
    po_number: wo.po_number ?? "",
    buyer: wo.buyer ?? "",
    style: wo.style ?? "",
    order_qty: wo.order_qty ?? null,
    line_name: ln.name ?? ln.line_id ?? "",
    shift: sheet.shift,
    inspection_date: sheet.inspection_date,
    inspector_name: sheet.inspector_id ? namesById.get(sheet.inspector_id) ?? null : null,
    product_type: sheet.product_type,
    fabric: sheet.fabric,
    target_qty: sheet.target_qty,
    planned_ex_factory: wo.planned_ex_factory ?? null,
    status: "signed_off",
    manager_name: sheet.manager_signoff_by ? namesById.get(sheet.manager_signoff_by) ?? null : null,
    manager_signoff_at: sheet.manager_signoff_at,
    signature_url: signatureUrl,
    items: (items as QCPdfItem[]) || [],
  };
}

export async function loadTrackerPayload(
  trackerId: string,
  ctxIn: LoaderCtx
): Promise<QCTrackerPdfPayload> {
  const { data: t, error } = await supabase
    .from("qc_order_trackers")
    .select(
      `id, status, season, fabric, ship_date,
       inspector_signoff_by, manager_signoff_by, manager_signoff_at,
       work_orders(po_number, buyer, style, order_qty, planned_ex_factory)`
    )
    .eq("id", trackerId)
    .single();
  if (error || !t) throw new Error(error?.message || "Tracker not found");
  if (t.status !== "signed_off") throw new Error("Only signed-off trackers can be exported.");

  const { data: items } = await supabase
    .from("qc_order_tracker_items")
    .select("section_label, section_order, item_code, item_label, item_guidance, status, notes, target_date")
    .eq("tracker_id", trackerId)
    .order("section_order")
    .order("item_order");

  const userIds = [t.manager_signoff_by, t.inspector_signoff_by].filter(Boolean) as string[];
  const namesById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of profs || []) namesById.set(p.id, p.full_name ?? "");
  }

  let signatureUrl: string | null = null;
  if (t.manager_signoff_by) {
    const { data: sig } = await supabase
      .from("user_signatures")
      .select("signature_url")
      .eq("user_id", t.manager_signoff_by)
      .maybeSingle();
    signatureUrl = sig?.signature_url ?? null;
  }

  const wo = (t as any).work_orders ?? {};

  return {
    kind: "order_tracker",
    id: t.id,
    factory_name: ctxIn.factoryName,
    factory_timezone: ctxIn.factoryTimezone,
    po_number: wo.po_number ?? "",
    buyer: wo.buyer ?? "",
    style: wo.style ?? "",
    order_qty: wo.order_qty ?? null,
    season: t.season,
    fabric: t.fabric,
    ship_date: t.ship_date,
    planned_ex_factory: wo.planned_ex_factory ?? null,
    status: "signed_off",
    manager_name: t.manager_signoff_by ? namesById.get(t.manager_signoff_by) ?? null : null,
    manager_signoff_at: t.manager_signoff_at,
    signature_url: signatureUrl,
    items: (items as QCPdfItem[]) || [],
  };
}

// ──────────────────────────────────────────────────────────────────────
// One-shot helpers for callers
// ──────────────────────────────────────────────────────────────────────

export async function downloadSingleDailySheetPDF(
  sheetId: string,
  ctxIn: LoaderCtx
) {
  const payload = await loadDailySheetPayload(sheetId, ctxIn);
  const blob = await generateQCRecordPDF(payload);
  const filename = `daily-qc-sheet-${payload.po_number || sheetId}-${payload.inspection_date}-${payload.shift}.pdf`;
  downloadBlob(blob, filename.replace(/\s+/g, "-"));
}

export async function downloadSingleTrackerPDF(trackerId: string, ctxIn: LoaderCtx) {
  const payload = await loadTrackerPayload(trackerId, ctxIn);
  const blob = await generateQCRecordPDF(payload);
  const filename = `order-tracker-${payload.po_number || trackerId}.pdf`;
  downloadBlob(blob, filename.replace(/\s+/g, "-"));
}

export async function downloadBulkSheetsPDF(
  sheetIds: string[],
  ctxIn: LoaderCtx
) {
  const payloads = await Promise.all(
    sheetIds.map((id) => loadDailySheetPayload(id, ctxIn))
  );
  const blob = await generateQCBulkPDF(payloads);
  const ts = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `qc-daily-sheets-${sheetIds.length}-${ts}.pdf`);
}

export async function downloadBulkTrackersPDF(
  trackerIds: string[],
  ctxIn: LoaderCtx
) {
  const payloads = await Promise.all(
    trackerIds.map((id) => loadTrackerPayload(id, ctxIn))
  );
  const blob = await generateQCBulkPDF(payloads);
  const ts = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `qc-order-trackers-${trackerIds.length}-${ts}.pdf`);
}
