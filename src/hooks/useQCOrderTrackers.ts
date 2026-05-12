import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ────────────────────────────────────────────────────────────────

export type TrackerStatus = "in_progress" | "awaiting_signoff" | "signed_off";

export interface POWithTracker {
  work_order_id: string;
  po_number: string;
  buyer: string;
  style: string;
  order_qty: number;
  planned_ex_factory: string | null;
  tracker_id: string | null;
  tracker_status: TrackerStatus | null;
  /** Inspector who started the tracker; null until a tracker exists. */
  created_by: string | null;
  items_total: number;
  items_done: number;
  items_issue: number;
  items_na: number;
  items_pending: number;
  last_activity_at: string | null;
}

/**
 * Display status for list views. A tracker that exists but has had zero
 * items completed/flagged reads as "Not Started" — the DB row is in_progress
 * but no real work has happened yet, so it shouldn't clutter the In Progress
 * tab. Detail page still shows the underlying DB status.
 */
export function effectiveTrackerStatus(
  row: POWithTracker
): TrackerStatus | "not_started" {
  if (!row.tracker_id || row.tracker_status === null) return "not_started";
  const touched = row.items_done + row.items_issue + row.items_na;
  if (row.tracker_status === "in_progress" && touched === 0) return "not_started";
  return row.tracker_status;
}

export interface OrderTrackerItem {
  id: string;
  tracker_id: string;
  section_label: string;
  section_order: number;
  item_code: string;
  item_label: string;
  item_guidance: string | null;
  item_order: number;
  status: "pending" | "done" | "issue" | "na";
  target_date: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface OrderTrackerDetail {
  id: string;
  factory_id: string;
  work_order_id: string;
  template_version: number;
  status: TrackerStatus;
  inspector_signoff_by: string | null;
  inspector_signoff_at: string | null;
  manager_signoff_by: string | null;
  manager_signoff_at: string | null;
  season: string | null;
  fabric: string | null;
  ship_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  // Parent PO (joined)
  po_number: string;
  buyer: string;
  style: string;
  order_qty: number;
  planned_ex_factory: string | null;
  // Items (separate fetch)
  items: OrderTrackerItem[];
}

// ── List hook: POs in factory with their tracker state ──────────────────

export function useQCOrderTrackers() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<POWithTracker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!profile?.factory_id) return;
    setLoading(true);
    try {
      // 1) All active POs in the factory
      const { data: wos } = await supabase
        .from("work_orders")
        .select("id, po_number, buyer, style, order_qty, planned_ex_factory")
        .eq("factory_id", profile.factory_id)
        .eq("is_active", true)
        .order("po_number");

      const ids = (wos || []).map((w) => w.id);
      if (ids.length === 0) {
        setRows([]);
        return;
      }

      // 2) Trackers for those POs
      const { data: trackers } = await supabase
        .from("qc_order_trackers")
        .select("id, work_order_id, status, last_activity_at, created_by")
        .in("work_order_id", ids);

      // 3) Item-status counts per tracker
      const trackerIds = (trackers || []).map((t) => t.id);
      const itemCountsByTracker = new Map<
        string,
        { done: number; issue: number; na: number; pending: number; total: number }
      >();
      if (trackerIds.length > 0) {
        const { data: items } = await supabase
          .from("qc_order_tracker_items")
          .select("tracker_id, status")
          .in("tracker_id", trackerIds);
        for (const i of items || []) {
          const c =
            itemCountsByTracker.get(i.tracker_id) ?? {
              done: 0,
              issue: 0,
              na: 0,
              pending: 0,
              total: 0,
            };
          c.total += 1;
          if (i.status === "done") c.done += 1;
          else if (i.status === "issue") c.issue += 1;
          else if (i.status === "na") c.na += 1;
          else c.pending += 1;
          itemCountsByTracker.set(i.tracker_id, c);
        }
      }

      const trackerByWO = new Map(
        (trackers || []).map((t) => [t.work_order_id, t])
      );

      const result: POWithTracker[] = (wos || []).map((w) => {
        const t = trackerByWO.get(w.id);
        const counts = t
          ? itemCountsByTracker.get(t.id) ?? {
              done: 0,
              issue: 0,
              na: 0,
              pending: 0,
              total: 0,
            }
          : { done: 0, issue: 0, na: 0, pending: 0, total: 0 };
        return {
          work_order_id: w.id,
          po_number: w.po_number,
          buyer: w.buyer,
          style: w.style,
          order_qty: w.order_qty,
          planned_ex_factory: w.planned_ex_factory,
          tracker_id: t?.id ?? null,
          tracker_status: (t?.status as TrackerStatus) ?? null,
          created_by: t?.created_by ?? null,
          items_total: counts.total,
          items_done: counts.done,
          items_issue: counts.issue,
          items_na: counts.na,
          items_pending: counts.pending,
          last_activity_at: t?.last_activity_at ?? null,
        };
      });

      setRows(result);
    } finally {
      setLoading(false);
    }
  }, [profile?.factory_id]);

  useEffect(() => {
    if (profile?.factory_id) fetchRows();
  }, [fetchRows, profile?.factory_id]);

  return { rows, loading, refetch: fetchRows };
}

// ── Detail hook: single tracker + its items + parent PO ────────────────

export function useQCOrderTracker(trackerId: string | undefined) {
  const [data, setData] = useState<OrderTrackerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTracker = useCallback(async () => {
    if (!trackerId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: tracker, error: trErr } = await supabase
        .from("qc_order_trackers")
        .select(
          `id, factory_id, work_order_id, template_version, status,
           inspector_signoff_by, inspector_signoff_at,
           manager_signoff_by, manager_signoff_at,
           season, fabric, ship_date,
           created_by, created_at, updated_at, last_activity_at,
           work_orders(po_number, buyer, style, order_qty, planned_ex_factory)`
        )
        .eq("id", trackerId)
        .single();

      if (trErr || !tracker) {
        setError(trErr?.message ?? "Tracker not found");
        setData(null);
        return;
      }

      const { data: items } = await supabase
        .from("qc_order_tracker_items")
        .select("*")
        .eq("tracker_id", trackerId)
        .order("section_order")
        .order("item_order");

      const wo = (tracker as any).work_orders ?? {};
      setData({
        id: tracker.id,
        factory_id: tracker.factory_id,
        work_order_id: tracker.work_order_id,
        template_version: tracker.template_version,
        status: tracker.status as TrackerStatus,
        inspector_signoff_by: tracker.inspector_signoff_by,
        inspector_signoff_at: tracker.inspector_signoff_at,
        manager_signoff_by: tracker.manager_signoff_by,
        manager_signoff_at: tracker.manager_signoff_at,
        season: tracker.season,
        fabric: tracker.fabric,
        ship_date: tracker.ship_date,
        created_by: tracker.created_by,
        created_at: tracker.created_at,
        updated_at: tracker.updated_at,
        last_activity_at: tracker.last_activity_at,
        po_number: wo.po_number ?? "",
        buyer: wo.buyer ?? "",
        style: wo.style ?? "",
        order_qty: wo.order_qty ?? 0,
        planned_ex_factory: wo.planned_ex_factory ?? null,
        items: (items as OrderTrackerItem[]) || [],
      });
    } finally {
      setLoading(false);
    }
  }, [trackerId]);

  useEffect(() => {
    if (trackerId) fetchTracker();
  }, [fetchTracker, trackerId]);

  return { data, loading, error, refetch: fetchTracker };
}

// ── Mutations ───────────────────────────────────────────────────────────

/**
 * Atomically creates a new tracker for a PO and snapshots its 32 checklist
 * items from the active order_manager template. Returns the new tracker id.
 */
export async function startOrderTracker(args: {
  factoryId: string;
  workOrderId: string;
  createdBy: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("qc_start_order_tracker", {
    p_factory_id: args.factoryId,
    p_work_order_id: args.workOrderId,
    p_created_by: args.createdBy,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Updates a single tracker item. Status changes trigger the auto-issue
 * server-side trigger (issue ↔ pending/done/na).
 */
export async function updateTrackerItem(
  itemId: string,
  patch: {
    status?: OrderTrackerItem["status"];
    target_date?: string | null;
    notes?: string | null;
  },
  updatedBy: string
) {
  const { error } = await supabase
    .from("qc_order_tracker_items")
    .update({ ...patch, updated_by: updatedBy })
    .eq("id", itemId);
  if (error) throw error;
}

/** Inspector requests sign-off → status='awaiting_signoff'. */
export async function requestTrackerSignoff(trackerId: string, userId: string) {
  const { error } = await supabase
    .from("qc_order_trackers")
    .update({
      status: "awaiting_signoff",
      inspector_signoff_by: userId,
      inspector_signoff_at: new Date().toISOString(),
      updated_by: userId,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", trackerId);
  if (error) throw error;
}

/** Admin/manager signs off → status='signed_off'. */
export async function signOffTracker(trackerId: string, userId: string) {
  const { error } = await supabase
    .from("qc_order_trackers")
    .update({
      status: "signed_off",
      manager_signoff_by: userId,
      manager_signoff_at: new Date().toISOString(),
      updated_by: userId,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", trackerId);
  if (error) throw error;
}

/** Admin reopens a signed-off / awaiting-signoff tracker → status='in_progress'. */
export async function reopenTracker(trackerId: string, userId: string) {
  const { error } = await supabase
    .from("qc_order_trackers")
    .update({
      status: "in_progress",
      inspector_signoff_by: null,
      inspector_signoff_at: null,
      manager_signoff_by: null,
      manager_signoff_at: null,
      updated_by: userId,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", trackerId);
  if (error) throw error;
}

/** Admin-only. ON DELETE CASCADE removes items; the orphan trigger auto-resolves linked issues. */
export async function deleteTracker(trackerId: string) {
  const { error } = await supabase
    .from("qc_order_trackers")
    .delete()
    .eq("id", trackerId);
  if (error) throw error;
}
