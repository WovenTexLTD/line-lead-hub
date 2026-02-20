import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatShortDate, formatTimeInTimezone, formatDateTimeInTimezone } from "@/lib/date-utils";
import { useAuth } from "@/contexts/AuthContext";
import { SewingSubmissionView } from "@/components/SewingSubmissionView";
import { FinishingSubmissionView } from "@/components/FinishingSubmissionView";
import type { SewingTargetData, SewingActualData } from "@/components/SewingSubmissionView";
import type { FinishingTargetData, FinishingActualData } from "@/components/FinishingSubmissionView";
import { Scissors } from "lucide-react";
import type { POSubmissionRow, SubmissionType } from "./types";

// ── Badge config per type ────────────────────────────────
const TYPE_BADGE: Record<SubmissionType, { label: string; variant: "info" | "success" | "warning" | "sewing" | "finishing" }> = {
  sewing_target: { label: "Sewing Target", variant: "info" },
  sewing_actual: { label: "Sewing EOD", variant: "success" },
  cutting_actual: { label: "Cutting", variant: "warning" },
  finishing_target: { label: "Finishing Target", variant: "info" },
  finishing_actual: { label: "Finishing EOD", variant: "finishing" },
};

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
  const [cuttingRow, setCuttingRow] = useState<Record<string, unknown> | null>(null);

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

  // ── Click handler ─────────────────────────────────────
  function handleClick(row: POSubmissionRow) {
    if (row.type === "sewing_target" || row.type === "sewing_actual") {
      // Pair target + actual by same line + date
      const pairedTarget = submissions.find(
        (s) => s.type === "sewing_target" && s.date === row.date && s.lineName === row.lineName
      );
      const pairedActual = submissions.find(
        (s) => s.type === "sewing_actual" && s.date === row.date && s.lineName === row.lineName
      );
      setSewingTarget(pairedTarget ? buildSewingTarget(pairedTarget.raw) : null);
      setSewingActual(pairedActual ? buildSewingActual(pairedActual.raw) : null);
      setSewingOpen(true);
    } else if (row.type === "finishing_target" || row.type === "finishing_actual") {
      // Pair finishing target + actual by same line + date
      const pairedTarget = submissions.find(
        (s) => s.type === "finishing_target" && s.date === row.date && s.lineName === row.lineName
      );
      const pairedActual = submissions.find(
        (s) => s.type === "finishing_actual" && s.date === row.date && s.lineName === row.lineName
      );
      setFinTarget(pairedTarget ? buildFinishingTarget(pairedTarget.raw) : null);
      setFinActual(pairedActual ? buildFinishingActual(pairedActual.raw) : null);
      setFinishingOpen(true);
    } else if (row.type === "cutting_actual") {
      setCuttingRow(row.raw);
      setCuttingOpen(true);
    }
  }

  // ── Key metric per type ───────────────────────────────
  function keyMetric(row: POSubmissionRow) {
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

  function keyMetricLabel(type: SubmissionType) {
    switch (type) {
      case "sewing_target": return "Target";
      case "sewing_actual": return "Output";
      case "cutting_actual": return "Total Cut";
      case "finishing_target": return "Target";
      case "finishing_actual": return "Output";
    }
  }

  function statusCell(row: POSubmissionRow) {
    const r = row.raw as any;
    // Targets: flag if submitted late
    if (row.type === "sewing_target" || row.type === "finishing_target") {
      if (r.is_late) return <StatusBadge variant="warning" size="sm">Late</StatusBadge>;
      return <StatusBadge variant="success" size="sm">On Time</StatusBadge>;
    }
    // Actuals: flag if blocker reported
    if (row.type === "sewing_actual" || row.type === "finishing_actual") {
      if (r.has_blocker) return <StatusBadge variant="danger" size="sm">Blocker</StatusBadge>;
      return <StatusBadge variant="success" size="sm">On Time</StatusBadge>;
    }
    // Cutting
    if (r.acknowledged) return <StatusBadge variant="success" size="sm">On Time</StatusBadge>;
    return <StatusBadge variant="info" size="sm">Pending</StatusBadge>;
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
            {submissions.map((row) => {
              const badge = TYPE_BADGE[row.type];
              return (
                <TableRow
                  key={`${row.type}-${row.id}`}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleClick(row)}
                >
                  <TableCell className="font-mono text-sm">
                    {formatShortDate(row.date)}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {row.submittedAt ? formatTime(row.submittedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={badge.variant} size="sm">
                      {badge.label}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.lineName}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {keyMetric(row)}
                    <span className="text-[10px] text-muted-foreground font-normal ml-1">
                      {keyMetricLabel(row.type)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {statusCell(row)}
                  </TableCell>
                </TableRow>
              );
            })}
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
      <CuttingDetailDialog
        open={cuttingOpen}
        onOpenChange={setCuttingOpen}
        data={cuttingRow}
        timezone={tz}
      />
    </>
  );
}

// ── Cutting Detail Dialog (no existing modal for cutting) ─
function CuttingDetailDialog({
  open,
  onOpenChange,
  data,
  timezone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: Record<string, unknown> | null;
  timezone: string;
}) {
  if (!data) return null;
  const r = data as any;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Cutting Submission
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Date" value={formatShortDate(r.production_date)} />
            <Stat label="Line" value={r.lines?.name || r.lines?.line_id || "—"} />
            <Stat label="PO" value={r.po_no || "—"} />
            <Stat label="Style" value={r.style || "—"} />
            <Stat label="Total Cutting" value={(r.total_cutting || 0).toLocaleString()} bold />
            <Stat label="Total Input" value={(r.total_input || 0).toLocaleString()} bold />
            <Stat label="Day Cutting" value={(r.day_cutting || 0).toLocaleString()} />
            <Stat label="Day Input" value={(r.day_input || 0).toLocaleString()} />
            <Stat label="Balance" value={(r.balance || 0).toLocaleString()} />
            <Stat label="Manpower" value={r.man_power ?? "—"} />
            <Stat label="Hours" value={r.hours_actual ?? "—"} />
            <Stat label="Order Qty" value={(r.order_qty || 0).toLocaleString()} />
          </div>
          {r.submitted_at && (
            <p className="text-xs text-muted-foreground">
              Submitted: {formatDateTimeInTimezone(r.submitted_at, timezone)}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={bold ? "font-semibold font-mono" : "font-mono"}>{value}</p>
    </div>
  );
}
