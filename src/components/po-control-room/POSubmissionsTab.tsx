import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatShortDate, formatTimeInTimezone } from "@/lib/date-utils";
import { useAuth } from "@/contexts/AuthContext";
import { SewingSubmissionView } from "@/components/SewingSubmissionView";
import { FinishingSubmissionView } from "@/components/FinishingSubmissionView";
import { CuttingSubmissionView } from "@/components/CuttingSubmissionView";
import type { SewingTargetData, SewingActualData } from "@/components/SewingSubmissionView";
import type { FinishingTargetData, FinishingActualData } from "@/components/FinishingSubmissionView";
import type { CuttingActualData } from "@/components/CuttingSubmissionView";
import type { POSubmissionRow, SubmissionType } from "./types";
import { resolveStageLabel } from "@/lib/resolve-stage-label";

// ── Types for merged rows ─────────────────────────────────
type StageName = "sewing" | "cutting" | "finishing";

interface MergedRow {
  key: string;
  stage: StageName;
  label: string;
  variant: "info" | "success" | "warning" | "sewing" | "finishing";
  date: string;
  lineName: string;
  submittedAt: string | null;
  targetRow: POSubmissionRow | null;
  actualRow: POSubmissionRow | null;
}

// ── Stage badge variant when both target + actual exist ───
const STAGE_VARIANT: Record<StageName, MergedRow["variant"]> = {
  sewing: "sewing",
  cutting: "warning",
  finishing: "finishing",
};

function getStage(type: SubmissionType): StageName {
  if (type.startsWith("sewing")) return "sewing";
  if (type.startsWith("cutting")) return "cutting";
  return "finishing";
}

function mergeSubmissions(submissions: POSubmissionRow[]): MergedRow[] {
  const groups = new Map<string, { target: POSubmissionRow | null; actual: POSubmissionRow | null; stage: StageName }>();

  for (const row of submissions) {
    const stage = getStage(row.type);
    const key = `${stage}-${row.date}-${row.lineName}`;

    if (!groups.has(key)) {
      groups.set(key, { target: null, actual: null, stage });
    }
    const group = groups.get(key)!;

    if (row.type.endsWith("_target")) {
      group.target = row;
    } else {
      group.actual = row;
    }
  }

  const result: MergedRow[] = [];

  for (const [key, group] of groups) {
    const hasTarget = !!group.target;
    const hasActual = !!group.actual;
    const stageName = group.stage.charAt(0).toUpperCase() + group.stage.slice(1);
    const label = resolveStageLabel(stageName, hasTarget, hasActual);

    // Badge variant: combined uses stage color, target-only uses "info", actual-only keeps existing
    let variant: MergedRow["variant"];
    if (hasTarget && hasActual) {
      variant = STAGE_VARIANT[group.stage];
    } else if (hasTarget) {
      variant = "info";
    } else {
      variant = STAGE_VARIANT[group.stage];
    }

    // Latest submittedAt for the time column
    const times = [group.target?.submittedAt, group.actual?.submittedAt].filter(Boolean) as string[];
    const submittedAt = times.sort().pop() ?? null;

    const primaryRow = group.actual || group.target!;

    result.push({
      key,
      stage: group.stage,
      label,
      variant,
      date: primaryRow.date,
      lineName: primaryRow.lineName,
      submittedAt,
      targetRow: group.target,
      actualRow: group.actual,
    });
  }

  // Sort by date descending
  result.sort((a, b) => b.date.localeCompare(a.date));
  return result;
}

interface Props {
  submissions: POSubmissionRow[];
}

export function POSubmissionsTab({ submissions }: Props) {
  const { factory } = useAuth();
  const tz = factory?.timezone || "Asia/Dhaka";
  const formatTime = (ts: string) => formatTimeInTimezone(ts, tz);

  // Modal state
  const [sewingOpen, setSewingOpen] = useState(false);
  const [sewingTarget, setSewingTarget] = useState<SewingTargetData | null>(null);
  const [sewingActual, setSewingActual] = useState<SewingActualData | null>(null);

  const [finishingOpen, setFinishingOpen] = useState(false);
  const [finTarget, setFinTarget] = useState<FinishingTargetData | null>(null);
  const [finActual, setFinActual] = useState<FinishingActualData | null>(null);

  const [cuttingOpen, setCuttingOpen] = useState(false);
  const [cuttingActual, setCuttingActual] = useState<CuttingActualData | null>(null);

  if (submissions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No submissions found for this PO
      </p>
    );
  }

  // ── Builders ──────────────────────────────────────────
  function buildSewingTarget(raw: Record<string, unknown>): SewingTargetData {
    const r = raw as any;
    return {
      id: r.id,
      production_date: r.production_date,
      line_name: r.lines?.name || r.lines?.line_id || "—",
      po_number: r.work_orders?.po_number ?? null,
      buyer: r.buyer_name ?? r.work_orders?.buyer ?? null,
      style: r.style_code ?? r.work_orders?.style ?? null,
      order_qty: r.order_qty ?? r.work_orders?.order_qty ?? null,
      submitted_at: r.submitted_at ?? null,
      per_hour_target: r.per_hour_target ?? 0,
      manpower_planned: r.manpower_planned ?? null,
      hours_planned: r.hours_planned ?? null,
      target_total_planned: r.target_total_planned ?? null,
      ot_hours_planned: r.ot_hours_planned ?? null,
      stage_name: r.stages?.name ?? null,
      planned_stage_progress: r.planned_stage_progress ?? null,
      next_milestone: r.next_milestone ?? null,
      estimated_ex_factory: r.estimated_ex_factory ?? null,
      remarks: r.remarks ?? null,
    };
  }

  function buildSewingActual(raw: Record<string, unknown>): SewingActualData {
    const r = raw as any;
    return {
      id: r.id,
      production_date: r.production_date,
      line_name: r.lines?.name || r.lines?.line_id || "—",
      po_number: r.work_orders?.po_number ?? null,
      buyer: r.buyer_name ?? r.work_orders?.buyer ?? null,
      style: r.style_code ?? r.work_orders?.style ?? null,
      order_qty: r.order_qty ?? r.work_orders?.order_qty ?? null,
      submitted_at: r.submitted_at ?? null,
      good_today: r.good_today ?? 0,
      reject_today: r.reject_today ?? 0,
      rework_today: r.rework_today ?? 0,
      cumulative_good_total: r.cumulative_good_total ?? 0,
      manpower_actual: r.manpower_actual ?? 0,
      hours_actual: r.hours_actual ?? null,
      actual_per_hour: r.actual_per_hour ?? null,
      ot_hours_actual: r.ot_hours_actual ?? 0,
      ot_manpower_actual: r.ot_manpower_actual ?? null,
      stage_name: r.stages?.name ?? null,
      actual_stage_progress: r.actual_stage_progress ?? null,
      remarks: r.remarks ?? null,
      has_blocker: r.has_blocker ?? false,
      blocker_description: r.blocker_description ?? null,
      blocker_impact: r.blocker_impact ?? null,
      blocker_owner: r.blocker_owner ?? null,
      blocker_status: null,
    };
  }

  function buildFinishingTarget(raw: Record<string, unknown>): FinishingTargetData {
    const r = raw as any;
    return {
      id: r.id,
      production_date: r.production_date,
      submitted_at: r.submitted_at ?? null,
      po_number: r.work_orders?.po_number ?? null,
      buyer: r.work_orders?.buyer ?? null,
      style: r.work_orders?.style ?? null,
      thread_cutting: r.thread_cutting ?? 0,
      inside_check: r.inside_check ?? 0,
      top_side_check: r.top_side_check ?? 0,
      buttoning: r.buttoning ?? 0,
      iron: r.iron ?? 0,
      get_up: r.get_up ?? 0,
      poly: r.poly ?? 0,
      carton: r.carton ?? 0,
      planned_hours: r.planned_hours ?? null,
      ot_hours_planned: r.ot_hours_planned ?? null,
      ot_manpower_planned: r.ot_manpower_planned ?? null,
      remarks: r.remarks ?? null,
    };
  }

  function buildCuttingActual(raw: Record<string, unknown>): CuttingActualData {
    const r = raw as any;
    return {
      id: r.id,
      production_date: r.production_date,
      line_name: r.lines?.name || r.lines?.line_id || "—",
      buyer: r.work_orders?.buyer ?? null,
      style: r.work_orders?.style ?? r.style ?? null,
      po_number: r.work_orders?.po_number ?? r.po_no ?? null,
      colour: r.colour ?? null,
      order_qty: r.work_orders?.order_qty ?? r.order_qty ?? null,
      submitted_at: r.submitted_at ?? null,
      man_power: r.man_power ?? null,
      marker_capacity: r.marker_capacity ?? null,
      lay_capacity: r.lay_capacity ?? null,
      cutting_capacity: r.cutting_capacity ?? null,
      under_qty: r.under_qty ?? null,
      day_cutting: r.day_cutting ?? 0,
      day_input: r.day_input ?? 0,
      total_cutting: r.total_cutting ?? null,
      total_input: r.total_input ?? null,
      balance: r.balance ?? null,
      hours_actual: r.hours_actual ?? null,
      actual_per_hour: r.actual_per_hour ?? null,
      ot_hours_actual: r.ot_hours_actual ?? null,
      ot_manpower_actual: r.ot_manpower_actual ?? null,
      leftover_recorded: r.leftover_recorded ?? null,
      leftover_type: r.leftover_type ?? null,
      leftover_unit: r.leftover_unit ?? null,
      leftover_quantity: r.leftover_quantity ?? null,
      leftover_notes: r.leftover_notes ?? null,
      leftover_location: r.leftover_location ?? null,
      leftover_photo_urls: r.leftover_photo_urls ?? null,
    };
  }

  function buildFinishingActual(raw: Record<string, unknown>): FinishingActualData {
    const r = raw as any;
    return {
      id: r.id,
      production_date: r.production_date,
      submitted_at: r.submitted_at ?? null,
      po_number: r.work_orders?.po_number ?? null,
      buyer: r.work_orders?.buyer ?? null,
      style: r.work_orders?.style ?? null,
      thread_cutting: r.thread_cutting ?? 0,
      inside_check: r.inside_check ?? 0,
      top_side_check: r.top_side_check ?? 0,
      buttoning: r.buttoning ?? 0,
      iron: r.iron ?? 0,
      get_up: r.get_up ?? 0,
      poly: r.poly ?? 0,
      carton: r.carton ?? 0,
      actual_hours: r.actual_hours ?? null,
      ot_hours_actual: r.ot_hours_actual ?? null,
      ot_manpower_actual: r.ot_manpower_actual ?? null,
      remarks: r.remarks ?? null,
    };
  }

  // ── Merge submissions into grouped rows ──────────────
  const mergedRows = useMemo(() => mergeSubmissions(submissions), [submissions]);

  // ── Click handler (works with merged rows) ─────────────
  function handleMergedClick(merged: MergedRow) {
    if (merged.stage === "sewing") {
      setSewingTarget(merged.targetRow ? buildSewingTarget(merged.targetRow.raw) : null);
      setSewingActual(merged.actualRow ? buildSewingActual(merged.actualRow.raw) : null);
      setSewingOpen(true);
    } else if (merged.stage === "finishing") {
      setFinTarget(merged.targetRow ? buildFinishingTarget(merged.targetRow.raw) : null);
      setFinActual(merged.actualRow ? buildFinishingActual(merged.actualRow.raw) : null);
      setFinishingOpen(true);
    } else if (merged.stage === "cutting" && merged.actualRow) {
      setCuttingActual(buildCuttingActual(merged.actualRow.raw));
      setCuttingOpen(true);
    }
  }

  // ── Key metric for a single submission row ─────────────
  function singleMetric(row: POSubmissionRow): string {
    const r = row.raw as any;
    switch (row.type) {
      case "sewing_target": {
        const total = r.target_total_planned ?? Math.round((r.per_hour_target ?? 0) * (r.hours_planned ?? 8));
        return total.toLocaleString();
      }
      case "sewing_actual":
        return (r.good_today ?? 0).toLocaleString();
      case "cutting_actual":
        return (r.total_cutting ?? 0).toLocaleString();
      case "finishing_target":
        return (r.poly ?? 0).toLocaleString();
      case "finishing_actual":
        return (r.poly ?? 0).toLocaleString();
      default:
        return "—";
    }
  }

  // ── Key metric display for merged row ──────────────────
  function mergedMetric(merged: MergedRow) {
    if (merged.targetRow && merged.actualRow) {
      return (
        <>
          {singleMetric(merged.targetRow)}
          <span className="text-[10px] text-muted-foreground font-normal ml-1 mr-2">Target</span>
          {singleMetric(merged.actualRow)}
          <span className="text-[10px] text-muted-foreground font-normal ml-1">Output</span>
        </>
      );
    }
    const row = merged.actualRow || merged.targetRow!;
    const metricLabel = row.type.endsWith("_target") ? "Target"
      : row.type === "cutting_actual" ? "Total Cut"
      : "Output";
    return (
      <>
        {singleMetric(row)}
        <span className="text-[10px] text-muted-foreground font-normal ml-1">{metricLabel}</span>
      </>
    );
  }

  // ── Status cell for merged row ─────────────────────────
  function mergedStatusCell(merged: MergedRow) {
    // Actual blocker takes priority
    if (merged.actualRow) {
      const r = merged.actualRow.raw as any;
      if (r.has_blocker) return <StatusBadge variant="danger" size="sm">Blocker</StatusBadge>;
    }
    // Target late flag
    if (merged.targetRow) {
      const r = merged.targetRow.raw as any;
      if (r.is_late) return <StatusBadge variant="warning" size="sm">Late</StatusBadge>;
    }
    // Cutting pending/acknowledged
    if (merged.stage === "cutting" && merged.actualRow) {
      const r = merged.actualRow.raw as any;
      if (r.acknowledged) return <StatusBadge variant="success" size="sm">On Time</StatusBadge>;
      return <StatusBadge variant="info" size="sm">Pending</StatusBadge>;
    }
    return <StatusBadge variant="success" size="sm">On Time</StatusBadge>;
  }

  return (
    <>
      <div className="overflow-auto max-h-[380px]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Line</TableHead>
              <TableHead className="text-right">Key Metric</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mergedRows.map((merged) => (
              <TableRow
                key={merged.key}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleMergedClick(merged)}
              >
                <TableCell className="font-mono text-sm">
                  {formatShortDate(merged.date)}
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {merged.submittedAt ? formatTime(merged.submittedAt) : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge variant={merged.variant} size="sm">
                    {merged.label}
                  </StatusBadge>
                </TableCell>
                <TableCell className="font-medium">
                  {merged.lineName}
                </TableCell>
                <TableCell className="text-right font-mono font-bold">
                  {mergedMetric(merged)}
                </TableCell>
                <TableCell>
                  {mergedStatusCell(merged)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Sewing submission modal */}
      <SewingSubmissionView
        open={sewingOpen}
        onOpenChange={setSewingOpen}
        target={sewingTarget}
        actual={sewingActual}
      />

      {/* Finishing submission modal */}
      <FinishingSubmissionView
        open={finishingOpen}
        onOpenChange={setFinishingOpen}
        target={finTarget}
        actual={finActual}
      />

      {/* Cutting detail modal */}
      <CuttingSubmissionView
        open={cuttingOpen}
        onOpenChange={setCuttingOpen}
        actual={cuttingActual}
      />
    </>
  );
}

