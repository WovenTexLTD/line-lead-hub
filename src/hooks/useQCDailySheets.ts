import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ────────────────────────────────────────────────────────────────

export type DailySheetStatus = "in_progress" | "awaiting_signoff" | "signed_off";
export type DailyItemStatus = "pending" | "pass" | "fail" | "na";

export interface DailySheetRow {
  id: string;
  work_order_id: string;
  line_id: string;
  inspection_date: string;
  shift: string;
  status: DailySheetStatus;
  inspector_id: string;
  inspector_signoff_at: string | null;
  manager_signoff_at: string | null;
  product_type: string | null;
  fabric: string | null;
  target_qty: number | null;
  created_by: string;
  created_at: string;
  last_activity_at: string;
  // joined
  po_number: string;
  buyer: string;
  style: string;
  line_name: string;
  inspector_name: string | null;
  // aggregated
  items_total: number;
  items_pass: number;
  items_fail: number;
  items_na: number;
  items_pending: number;
}

export interface DailySheetItem {
  id: string;
  sheet_id: string;
  section_label: string;
  section_order: number;
  item_code: string;
  item_label: string;
  item_guidance: string | null;
  item_order: number;
  status: DailyItemStatus;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface DailySheetDetail extends Omit<DailySheetRow, "items_total" | "items_pass" | "items_fail" | "items_na" | "items_pending"> {
  template_version: number;
  manager_signoff_by: string | null;
  factory_id: string;
  planned_ex_factory: string | null;
  order_qty: number;
  items: DailySheetItem[];
}

// ── List hook ───────────────────────────────────────────────────────────

export function useQCDailySheets(options: { sinceDays?: number } = {}) {
  const { profile } = useAuth();
  const sinceDays = options.sinceDays ?? 30;
  const [rows, setRows] = useState<DailySheetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!profile?.factory_id) return;
    setLoading(true);
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - sinceDays);
      const sinceStr = sinceDate.toISOString().slice(0, 10);

      const { data: sheets } = await supabase
        .from("qc_daily_sheets")
        .select(
          `id, work_order_id, line_id, inspection_date, shift, status,
           inspector_id, inspector_signoff_at, manager_signoff_at,
           product_type, fabric, target_qty,
           created_by, created_at, last_activity_at,
           work_orders(po_number, buyer, style),
           lines(name, line_id)`
        )
        .eq("factory_id", profile.factory_id)
        .gte("inspection_date", sinceStr)
        .order("inspection_date", { ascending: false })
        .order("created_at", { ascending: false });

      const sheetIds = (sheets || []).map((s) => s.id);
      const inspectorIds = Array.from(
        new Set((sheets || []).map((s) => s.inspector_id).filter(Boolean) as string[])
      );

      // Aggregate item counts per sheet
      const counts = new Map<
        string,
        { total: number; pass: number; fail: number; na: number; pending: number }
      >();
      if (sheetIds.length > 0) {
        const { data: items } = await supabase
          .from("qc_daily_sheet_items")
          .select("sheet_id, status")
          .in("sheet_id", sheetIds);
        for (const i of items || []) {
          const c = counts.get(i.sheet_id) ?? {
            total: 0,
            pass: 0,
            fail: 0,
            na: 0,
            pending: 0,
          };
          c.total += 1;
          if (i.status === "pass") c.pass += 1;
          else if (i.status === "fail") c.fail += 1;
          else if (i.status === "na") c.na += 1;
          else c.pending += 1;
          counts.set(i.sheet_id, c);
        }
      }

      // Inspector names
      const inspectorNames = new Map<string, string | null>();
      if (inspectorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", inspectorIds);
        for (const p of profiles || []) {
          inspectorNames.set(p.id, p.full_name);
        }
      }

      const result: DailySheetRow[] = (sheets || []).map((s: any) => {
        const c = counts.get(s.id) ?? {
          total: 0,
          pass: 0,
          fail: 0,
          na: 0,
          pending: 0,
        };
        return {
          id: s.id,
          work_order_id: s.work_order_id,
          line_id: s.line_id,
          inspection_date: s.inspection_date,
          shift: s.shift,
          status: s.status,
          inspector_id: s.inspector_id,
          inspector_signoff_at: s.inspector_signoff_at,
          manager_signoff_at: s.manager_signoff_at,
          product_type: s.product_type,
          fabric: s.fabric,
          target_qty: s.target_qty,
          created_by: s.created_by,
          created_at: s.created_at,
          last_activity_at: s.last_activity_at,
          po_number: s.work_orders?.po_number ?? "",
          buyer: s.work_orders?.buyer ?? "",
          style: s.work_orders?.style ?? "",
          line_name: s.lines?.name ?? s.lines?.line_id ?? "",
          inspector_name: inspectorNames.get(s.inspector_id) ?? null,
          items_total: c.total,
          items_pass: c.pass,
          items_fail: c.fail,
          items_na: c.na,
          items_pending: c.pending,
        };
      });

      setRows(result);
    } finally {
      setLoading(false);
    }
  }, [profile?.factory_id, sinceDays]);

  useEffect(() => {
    if (profile?.factory_id) fetchRows();
  }, [fetchRows, profile?.factory_id]);

  return { rows, loading, refetch: fetchRows };
}

// ── Detail hook ─────────────────────────────────────────────────────────

export function useQCDailySheet(sheetId: string | undefined) {
  const [data, setData] = useState<DailySheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSheet = useCallback(async () => {
    if (!sheetId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sheet, error: sErr } = await supabase
        .from("qc_daily_sheets")
        .select(
          `id, factory_id, work_order_id, line_id, inspection_date, shift,
           template_version, status,
           inspector_id, inspector_signoff_at,
           manager_signoff_by, manager_signoff_at,
           product_type, fabric, target_qty,
           created_by, created_at, updated_at, last_activity_at,
           work_orders(po_number, buyer, style, order_qty, planned_ex_factory),
           lines(name, line_id)`
        )
        .eq("id", sheetId)
        .single();

      if (sErr || !sheet) {
        setError(sErr?.message ?? "Sheet not found");
        setData(null);
        return;
      }

      const { data: items } = await supabase
        .from("qc_daily_sheet_items")
        .select("*")
        .eq("sheet_id", sheetId)
        .order("section_order")
        .order("item_order");

      let inspectorName: string | null = null;
      if (sheet.inspector_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", sheet.inspector_id)
          .maybeSingle();
        inspectorName = prof?.full_name ?? null;
      }

      const wo = (sheet as any).work_orders ?? {};
      const ln = (sheet as any).lines ?? {};
      setData({
        id: sheet.id,
        factory_id: sheet.factory_id,
        work_order_id: sheet.work_order_id,
        line_id: sheet.line_id,
        inspection_date: sheet.inspection_date,
        shift: sheet.shift,
        template_version: sheet.template_version,
        status: sheet.status as DailySheetStatus,
        inspector_id: sheet.inspector_id,
        inspector_signoff_at: sheet.inspector_signoff_at,
        manager_signoff_by: sheet.manager_signoff_by,
        manager_signoff_at: sheet.manager_signoff_at,
        product_type: sheet.product_type,
        fabric: sheet.fabric,
        target_qty: sheet.target_qty,
        created_by: sheet.created_by,
        created_at: sheet.created_at,
        last_activity_at: sheet.last_activity_at,
        po_number: wo.po_number ?? "",
        buyer: wo.buyer ?? "",
        style: wo.style ?? "",
        order_qty: wo.order_qty ?? 0,
        planned_ex_factory: wo.planned_ex_factory ?? null,
        line_name: ln.name ?? ln.line_id ?? "",
        inspector_name: inspectorName,
        items: (items as DailySheetItem[]) || [],
      });
    } finally {
      setLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    if (sheetId) fetchSheet();
  }, [fetchSheet, sheetId]);

  return { data, loading, error, refetch: fetchSheet };
}

// ── Mutations ───────────────────────────────────────────────────────────

export async function startDailySheet(args: {
  factoryId: string;
  workOrderId: string;
  lineId: string;
  inspectionDate: string;
  shift: string;
  inspectorId: string;
  productType?: string | null;
  fabric?: string | null;
  targetQty?: number | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("qc_start_daily_sheet", {
    p_factory_id: args.factoryId,
    p_work_order_id: args.workOrderId,
    p_line_id: args.lineId,
    p_inspection_date: args.inspectionDate,
    p_shift: args.shift,
    p_inspector_id: args.inspectorId,
    p_product_type: args.productType ?? null,
    p_fabric: args.fabric ?? null,
    p_target_qty: args.targetQty ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function updateDailyItem(
  itemId: string,
  patch: { status?: DailyItemStatus; notes?: string | null },
  updatedBy: string
) {
  const { error } = await supabase
    .from("qc_daily_sheet_items")
    .update({ ...patch, updated_by: updatedBy })
    .eq("id", itemId);
  if (error) throw error;
}

export async function requestDailyShiftSignoff(sheetId: string, userId: string) {
  const { error } = await supabase
    .from("qc_daily_sheets")
    .update({
      status: "awaiting_signoff",
      inspector_signoff_at: new Date().toISOString(),
      updated_by: userId,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", sheetId);
  if (error) throw error;
}

export async function signOffDailySheet(sheetId: string, userId: string) {
  const { error } = await supabase
    .from("qc_daily_sheets")
    .update({
      status: "signed_off",
      manager_signoff_by: userId,
      manager_signoff_at: new Date().toISOString(),
      updated_by: userId,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", sheetId);
  if (error) throw error;
}

export async function reopenDailySheet(sheetId: string, userId: string) {
  const { error } = await supabase
    .from("qc_daily_sheets")
    .update({
      status: "in_progress",
      inspector_signoff_at: null,
      manager_signoff_by: null,
      manager_signoff_at: null,
      updated_by: userId,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", sheetId);
  if (error) throw error;
}

/** Admin-only. ON DELETE CASCADE removes items; the orphan trigger auto-resolves linked issues. */
export async function deleteDailySheet(sheetId: string) {
  const { error } = await supabase
    .from("qc_daily_sheets")
    .delete()
    .eq("id", sheetId);
  if (error) throw error;
}
