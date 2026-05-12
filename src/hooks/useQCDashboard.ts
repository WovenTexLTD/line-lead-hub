import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getTodayInTimezone } from "@/lib/date-utils";

// ── Types ────────────────────────────────────────────────────────────────

export type IssueStatus = "open" | "reviewed" | "resolved";
export type IssueSeverity = "minor" | "major" | "critical";
export type IssueSource = "order_tracker" | "daily_sheet";

export interface QCIssueRow {
  id: string;
  factory_id: string;
  source_type: IssueSource;
  source_record_id: string;
  source_item_id: string | null;
  work_order_id: string;
  line_id: string | null;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  raised_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  po_number: string;
  buyer: string;
  style: string;
  line_name: string | null;
  raised_by_name: string | null;
}

export interface QCActivityRow {
  kind: "tracker_item_update" | "daily_item_update";
  at: string; // updated_at
  source_id: string; // tracker_id or sheet_id
  source_type: IssueSource;
  item_code: string;
  item_label: string;
  status: string;
  updated_by_name: string | null;
  po_number: string;
  line_name: string | null;
}

export interface QCDashboardData {
  kpis: {
    sheetsToday: number;
    openIssues: number;
    trackersAwaitingSignoff: number;
    sheetsAwaitingSignoff: number;
    failedCheckpointsToday: number;
    criticalOpenIssues: number;
    recentlyUpdatedTrackers: number; // updated in last 7 days
  };
  openIssues: QCIssueRow[]; // top 50 newest
  recentActivity: QCActivityRow[]; // top 20 newest
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useQCDashboard() {
  const { profile, factory } = useAuth();
  const timezone = factory?.timezone || "Asia/Dhaka";
  const today = getTodayInTimezone(timezone);

  const [data, setData] = useState<QCDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!profile?.factory_id) return;
    setLoading(true);
    try {
      const factoryId = profile.factory_id;
      const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        sheetsTodayRes,
        openIssuesCountRes,
        criticalOpenRes,
        trackersAwaitingRes,
        sheetsAwaitingRes,
        recentTrackersRes,
        failedTodayRes,
        openIssuesListRes,
        recentTrackerItemsRes,
        recentDailyItemsRes,
      ] = await Promise.all([
        supabase
          .from("qc_daily_sheets")
          .select("id", { count: "exact", head: true })
          .eq("factory_id", factoryId)
          .eq("inspection_date", today),
        supabase
          .from("qc_issues")
          .select("id", { count: "exact", head: true })
          .eq("factory_id", factoryId)
          .eq("status", "open"),
        supabase
          .from("qc_issues")
          .select("id", { count: "exact", head: true })
          .eq("factory_id", factoryId)
          .eq("status", "open")
          .eq("severity", "critical"),
        supabase
          .from("qc_order_trackers")
          .select("id", { count: "exact", head: true })
          .eq("factory_id", factoryId)
          .eq("status", "awaiting_signoff"),
        supabase
          .from("qc_daily_sheets")
          .select("id", { count: "exact", head: true })
          .eq("factory_id", factoryId)
          .eq("status", "awaiting_signoff"),
        supabase
          .from("qc_order_trackers")
          .select("id", { count: "exact", head: true })
          .eq("factory_id", factoryId)
          .gte("last_activity_at", sevenDaysAgoIso),
        // Failed checkpoints today: items on today's sheets with status='fail'
        supabase
          .from("qc_daily_sheet_items")
          .select("id, qc_daily_sheets!inner(factory_id, inspection_date)")
          .eq("status", "fail")
          .eq("qc_daily_sheets.factory_id", factoryId)
          .eq("qc_daily_sheets.inspection_date", today),
        // Open issues list (with joins)
        supabase
          .from("qc_issues")
          .select(
            `id, factory_id, source_type, source_record_id, source_item_id,
             work_order_id, line_id, title, description, severity, status,
             raised_by, reviewed_by, reviewed_at, resolved_by, resolved_at,
             admin_notes, created_at, updated_at,
             work_orders(po_number, buyer, style),
             lines(name, line_id)`
          )
          .eq("factory_id", factoryId)
          .eq("status", "open")
          .order("severity", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50),
        // Recent tracker item updates (last 20)
        supabase
          .from("qc_order_tracker_items")
          .select(
            `id, tracker_id, item_code, item_label, status, updated_at, updated_by,
             qc_order_trackers!inner(factory_id, work_order_id, work_orders(po_number))`
          )
          .eq("qc_order_trackers.factory_id", factoryId)
          .not("updated_by", "is", null)
          .order("updated_at", { ascending: false })
          .limit(20),
        // Recent daily-sheet item updates (last 20)
        supabase
          .from("qc_daily_sheet_items")
          .select(
            `id, sheet_id, item_code, item_label, status, updated_at, updated_by,
             qc_daily_sheets!inner(factory_id, work_order_id, line_id,
                work_orders(po_number), lines(name, line_id))`
          )
          .eq("qc_daily_sheets.factory_id", factoryId)
          .not("updated_by", "is", null)
          .order("updated_at", { ascending: false })
          .limit(20),
      ]);

      // Collect user ids for name resolution
      const userIdSet = new Set<string>();
      (openIssuesListRes.data || []).forEach((r: any) => {
        if (r.raised_by) userIdSet.add(r.raised_by);
      });
      (recentTrackerItemsRes.data || []).forEach((r: any) => {
        if (r.updated_by) userIdSet.add(r.updated_by);
      });
      (recentDailyItemsRes.data || []).forEach((r: any) => {
        if (r.updated_by) userIdSet.add(r.updated_by);
      });

      const profilesById = new Map<string, string>();
      if (userIdSet.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(userIdSet));
        for (const p of profs || []) profilesById.set(p.id, p.full_name ?? "");
      }

      // Shape open issues
      const openIssues: QCIssueRow[] = (openIssuesListRes.data || []).map((r: any) => ({
        id: r.id,
        factory_id: r.factory_id,
        source_type: r.source_type,
        source_record_id: r.source_record_id,
        source_item_id: r.source_item_id,
        work_order_id: r.work_order_id,
        line_id: r.line_id,
        title: r.title,
        description: r.description,
        severity: r.severity,
        status: r.status,
        raised_by: r.raised_by,
        reviewed_by: r.reviewed_by,
        reviewed_at: r.reviewed_at,
        resolved_by: r.resolved_by,
        resolved_at: r.resolved_at,
        admin_notes: r.admin_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
        po_number: r.work_orders?.po_number ?? "",
        buyer: r.work_orders?.buyer ?? "",
        style: r.work_orders?.style ?? "",
        line_name: r.lines?.name ?? r.lines?.line_id ?? null,
        raised_by_name: r.raised_by ? profilesById.get(r.raised_by) ?? null : null,
      }));

      // Shape activity feed (merge tracker + daily, sort by updated_at desc)
      const trackerActivity: QCActivityRow[] = (recentTrackerItemsRes.data || []).map((r: any) => ({
        kind: "tracker_item_update",
        at: r.updated_at,
        source_id: r.tracker_id,
        source_type: "order_tracker",
        item_code: r.item_code,
        item_label: r.item_label,
        status: r.status,
        updated_by_name: r.updated_by ? profilesById.get(r.updated_by) ?? null : null,
        po_number: r.qc_order_trackers?.work_orders?.po_number ?? "",
        line_name: null,
      }));
      const dailyActivity: QCActivityRow[] = (recentDailyItemsRes.data || []).map((r: any) => ({
        kind: "daily_item_update",
        at: r.updated_at,
        source_id: r.sheet_id,
        source_type: "daily_sheet",
        item_code: r.item_code,
        item_label: r.item_label,
        status: r.status,
        updated_by_name: r.updated_by ? profilesById.get(r.updated_by) ?? null : null,
        po_number: r.qc_daily_sheets?.work_orders?.po_number ?? "",
        line_name:
          r.qc_daily_sheets?.lines?.name ?? r.qc_daily_sheets?.lines?.line_id ?? null,
      }));
      const recentActivity = [...trackerActivity, ...dailyActivity]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 20);

      setData({
        kpis: {
          sheetsToday: sheetsTodayRes.count ?? 0,
          openIssues: openIssuesCountRes.count ?? 0,
          criticalOpenIssues: criticalOpenRes.count ?? 0,
          trackersAwaitingSignoff: trackersAwaitingRes.count ?? 0,
          sheetsAwaitingSignoff: sheetsAwaitingRes.count ?? 0,
          failedCheckpointsToday: (failedTodayRes.data || []).length,
          recentlyUpdatedTrackers: recentTrackersRes.count ?? 0,
        },
        openIssues,
        recentActivity,
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.factory_id, today]);

  useEffect(() => {
    if (profile?.factory_id) fetchAll();
  }, [fetchAll, profile?.factory_id]);

  return { data, loading, refetch: fetchAll };
}

// ── Issue mutations ────────────────────────────────────────────────────

export async function markIssueReviewed(
  issueId: string,
  userId: string,
  adminNotes?: string
) {
  const patch: any = {
    status: "reviewed",
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  };
  if (adminNotes !== undefined) patch.admin_notes = adminNotes;
  const { error } = await supabase.from("qc_issues").update(patch).eq("id", issueId);
  if (error) throw error;
}

export async function markIssueResolved(
  issueId: string,
  userId: string,
  adminNotes?: string
) {
  const patch: any = {
    status: "resolved",
    resolved_by: userId,
    resolved_at: new Date().toISOString(),
  };
  if (adminNotes !== undefined) patch.admin_notes = adminNotes;
  const { error } = await supabase.from("qc_issues").update(patch).eq("id", issueId);
  if (error) throw error;
}

export async function reopenIssue(issueId: string, userId: string) {
  // Fetch current admin_notes so we can append an audit line. qc_issues
  // doesn't carry a dedicated reopened_by/at pair, so we journal into notes.
  const { data: existing, error: fetchErr } = await supabase
    .from("qc_issues")
    .select("admin_notes")
    .eq("id", issueId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const stamp = `[Reopened ${new Date().toISOString()} by ${userId}]`;
  const nextNotes = existing?.admin_notes
    ? `${existing.admin_notes}\n${stamp}`
    : stamp;

  const { error } = await supabase
    .from("qc_issues")
    .update({
      status: "open",
      reviewed_by: null,
      reviewed_at: null,
      resolved_by: null,
      resolved_at: null,
      admin_notes: nextNotes,
    })
    .eq("id", issueId);
  if (error) throw error;
}

export async function updateIssueSeverity(issueId: string, severity: IssueSeverity) {
  const { error } = await supabase
    .from("qc_issues")
    .update({ severity })
    .eq("id", issueId);
  if (error) throw error;
}

export async function updateIssueAdminNotes(issueId: string, notes: string) {
  const { error } = await supabase
    .from("qc_issues")
    .update({ admin_notes: notes || null })
    .eq("id", issueId);
  if (error) throw error;
}
