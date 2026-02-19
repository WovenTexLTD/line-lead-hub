import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatDateTimeInTimezone } from "@/lib/date-utils";
import {
  Factory,
  Crosshair,
  AlertTriangle,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

export interface SewingTargetData {
  id: string;
  production_date: string;
  line_name: string;
  po_number: string | null;
  buyer: string | null;
  style: string | null;
  order_qty: number | null;
  submitted_at: string | null;
  per_hour_target: number;
  manpower_planned: number | null;
  hours_planned: number | null;
  target_total_planned: number | null;
  ot_hours_planned: number | null;
  stage_name: string | null;
  planned_stage_progress: number | null;
  next_milestone: string | null;
  estimated_ex_factory: string | null;
  remarks: string | null;
}

export interface SewingActualData {
  id: string;
  production_date: string;
  line_name: string;
  po_number: string | null;
  buyer: string | null;
  style: string | null;
  order_qty: number | null;
  submitted_at: string | null;
  good_today: number;
  reject_today: number;
  rework_today: number;
  cumulative_good_total: number;
  manpower_actual: number;
  hours_actual: number | null;
  actual_per_hour: number | null;
  ot_hours_actual: number;
  ot_manpower_actual: number | null;
  stage_name: string | null;
  actual_stage_progress: number | null;
  remarks: string | null;
  has_blocker: boolean | null;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  blocker_status: string | null;
}

interface SewingSubmissionViewProps {
  target?: SewingTargetData | null;
  actual?: SewingActualData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function VarianceIndicator({ actual, target, decimals }: { actual: number; target: number; decimals?: number }) {
  const diff = actual - target;
  const formatted = decimals != null ? diff.toFixed(decimals) : diff.toLocaleString();
  if (diff > 0) return <span className="text-green-600 dark:text-green-400 flex items-center gap-1 text-xs"><TrendingUp className="h-3 w-3" />+{formatted}</span>;
  if (diff < 0) return <span className="text-destructive flex items-center gap-1 text-xs"><TrendingDown className="h-3 w-3" />{formatted}</span>;
  return <span className="text-muted-foreground flex items-center gap-1 text-xs"><Minus className="h-3 w-3" />0</span>;
}

function FieldDisplay({ label, value, className, suffix }: {
  label: string;
  value: string | number | null | undefined;
  className?: string;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`font-semibold ${className || ""}`}>
        {value != null ? (typeof value === "number" ? `${value.toLocaleString()}${suffix || ""}` : value) : "-"}
      </p>
    </div>
  );
}

export function SewingSubmissionView({ target, actual, open, onOpenChange }: SewingSubmissionViewProps) {
  const { factory } = useAuth();

  if (!target && !actual) return null;

  const formatDateTime = (dateString: string) => {
    const timezone = factory?.timezone || "Asia/Dhaka";
    return formatDateTimeInTimezone(dateString, timezone);
  };

  const hasTarget = !!target;
  const hasActual = !!actual;
  const isComparison = hasTarget && hasActual;

  // Primary record for header info (prefer actual since it's submitted later)
  const primary = actual || target!;

  // Title and icon based on mode
  const title = isComparison
    ? "Sewing Submission"
    : hasActual
      ? "Sewing End of Day"
      : "Sewing Target";

  const Icon = hasActual ? Factory : Crosshair;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
            <div className="flex gap-1.5 ml-auto">
              {hasTarget && (
                <Badge variant="outline" className="bg-primary/10 text-xs">
                  Target
                </Badge>
              )}
              {hasActual && (
                <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 text-xs">
                  Actual
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Order Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FieldDisplay label="Date" value={formatDate(primary.production_date)} />
            <FieldDisplay label="Line" value={primary.line_name} />
            <FieldDisplay label="Buyer" value={primary.buyer} />
            <FieldDisplay label="Style" value={primary.style} />
            <FieldDisplay label="PO Number" value={primary.po_number} />
            <FieldDisplay label="Order Qty" value={primary.order_qty} />
          </div>

          {/* Two-column Target & Actual display */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Left Column: Target (blue) or placeholder */}
            {hasTarget && target ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-primary">
                  <Crosshair className="h-4 w-4" />
                  Morning Target
                </h4>

                {/* Target Metrics */}
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Targets</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldDisplay label="Per Hour Target" value={target.per_hour_target} className="text-lg text-primary" />
                    <FieldDisplay label="Manpower Planned" value={target.manpower_planned} />
                    <FieldDisplay label="Hours Planned" value={target.hours_planned} />
                    <FieldDisplay label="OT Hours Planned" value={target.ot_hours_planned} />
                  </div>
                </div>

                {/* Derived Totals */}
                {target.hours_planned != null && target.hours_planned > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Derived Totals</p>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldDisplay label="Target Total Output" value={Math.round(target.per_hour_target * target.hours_planned)} className="text-lg text-primary" />
                    </div>
                  </div>
                )}

                {/* Stage & Progress */}
                {(target.stage_name || target.planned_stage_progress != null || target.next_milestone) && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Stage & Progress</p>
                    <div className="grid grid-cols-2 gap-3">
                      {target.stage_name && (
                        <FieldDisplay label="Planned Stage" value={target.stage_name} />
                      )}
                      {target.planned_stage_progress != null && (
                        <FieldDisplay label="Stage Progress" value={target.planned_stage_progress} suffix="%" />
                      )}
                      {target.next_milestone && (
                        <FieldDisplay label="Next Milestone" value={target.next_milestone} />
                      )}
                      {target.estimated_ex_factory && (
                        <FieldDisplay label="Est. Ex-Factory" value={formatDate(target.estimated_ex_factory)} />
                      )}
                    </div>
                  </div>
                )}

                {/* Remarks */}
                {target.remarks && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Remarks</p>
                    <p className="text-sm text-muted-foreground">{target.remarks}</p>
                  </div>
                )}

                {/* Target Timestamp */}
                {target.submitted_at && (
                  <p className="text-xs text-muted-foreground pt-2 border-t border-primary/10">
                    Submitted: {formatDateTime(target.submitted_at)}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4 flex flex-col items-center justify-center text-center min-h-[200px]">
                <Crosshair className="h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Morning target not submitted</p>
              </div>
            )}

            {/* Right Column: Actual (green) or placeholder */}
            {hasActual && actual ? (
              <div className="rounded-lg border border-success/20 bg-success/5 p-4 space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-success">
                  <Factory className="h-4 w-4" />
                  End of Day Actual
                </h4>

                {/* Output */}
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Output</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldDisplay label="Good Output" value={actual.good_today} className="text-lg text-success" />
                    <FieldDisplay label="Reject" value={actual.reject_today} />
                    <FieldDisplay label="Rework" value={actual.rework_today} />
                    <FieldDisplay label="Cumulative Good Total" value={actual.cumulative_good_total} className="text-lg" />
                  </div>
                </div>

                {/* Derived Rates */}
                {actual.hours_actual != null && actual.hours_actual > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Derived Rates</p>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldDisplay label="Output per Hour" value={Math.round((actual.good_today / actual.hours_actual) * 100) / 100} suffix=" /hr" className="text-lg text-success" />
                    </div>
                  </div>
                )}

                {/* Resources */}
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Resources</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldDisplay label="Manpower Actual" value={actual.manpower_actual} />
                    <FieldDisplay label="Hours Actual" value={actual.hours_actual} />
                    <FieldDisplay label="OT Hours Actual" value={actual.ot_hours_actual} />
                    {actual.ot_manpower_actual != null && actual.ot_manpower_actual > 0 && (
                      <FieldDisplay label="OT Manpower Actual" value={actual.ot_manpower_actual} />
                    )}
                  </div>
                </div>

                {/* Stage & Progress */}
                {(actual.stage_name || actual.actual_stage_progress != null) && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Stage & Progress</p>
                    <div className="grid grid-cols-2 gap-3">
                      {actual.stage_name && (
                        <FieldDisplay label="Actual Stage" value={actual.stage_name} />
                      )}
                      {actual.actual_stage_progress != null && (
                        <FieldDisplay label="Stage Progress" value={actual.actual_stage_progress} suffix="%" />
                      )}
                    </div>
                  </div>
                )}

                {/* Blocker */}
                {actual.has_blocker && (
                  <div className={`p-3 rounded-lg border ${
                    actual.blocker_impact === 'critical' ? 'border-destructive/30 bg-destructive/5' :
                    actual.blocker_impact === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
                    actual.blocker_impact === 'medium' ? 'border-warning/30 bg-warning/5' :
                    'border-success/30 bg-success/5'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <span className="font-semibold text-xs uppercase tracking-wide">Blocker</span>
                      {actual.blocker_impact && (
                        <StatusBadge variant={actual.blocker_impact as any} size="sm">
                          {actual.blocker_impact}
                        </StatusBadge>
                      )}
                      {actual.blocker_status && (
                        <StatusBadge variant={actual.blocker_status === 'resolved' ? 'success' : 'default'} size="sm">
                          {actual.blocker_status}
                        </StatusBadge>
                      )}
                    </div>
                    <p className="text-sm">{actual.blocker_description || 'No description'}</p>
                    {actual.blocker_owner && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <User className="h-3 w-3" />
                        Owner: {actual.blocker_owner}
                      </p>
                    )}
                  </div>
                )}

                {/* Remarks */}
                {actual.remarks && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Remarks</p>
                    <p className="text-sm text-muted-foreground">{actual.remarks}</p>
                  </div>
                )}

                {/* Actual Timestamp */}
                {actual.submitted_at && (
                  <p className="text-xs text-muted-foreground pt-2 border-t border-success/10">
                    Submitted: {formatDateTime(actual.submitted_at)}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4 flex flex-col items-center justify-center text-center min-h-[200px]">
                <Factory className="h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">End of day not submitted yet</p>
              </div>
            )}
          </div>

          {/* Comparison table (full width, below columns) */}
          {isComparison && target && actual && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-semibold text-sm mb-3 flex items-center justify-between">
                <span>Target vs Actual Comparison</span>
                <Badge variant="outline" className="text-xs">Variance</Badge>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-2 pr-4 font-medium">Metric</th>
                      <th className="text-right py-2 px-3 font-medium">Target</th>
                      <th className="text-right py-2 px-3 font-medium">Actual</th>
                      <th className="text-right py-2 pl-3 font-medium">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows: { label: string; tgt: number | null | undefined; act: number | null | undefined; suffix?: string; decimals?: number }[] = [
                        { label: "Output per Hour", tgt: target.per_hour_target, act: actual.actual_per_hour, decimals: 2 },
                        { label: "Total Output", tgt: target.target_total_planned, act: actual.good_today },
                        { label: "Hours", tgt: target.hours_planned, act: actual.hours_actual },
                        { label: "Manpower", tgt: target.manpower_planned, act: actual.manpower_actual },
                        { label: "OT Hours", tgt: target.ot_hours_planned, act: actual.ot_hours_actual },
                        { label: "Stage Progress", tgt: target.planned_stage_progress, act: actual.actual_stage_progress, suffix: "%" },
                      ];
                      return rows.map(({ label, tgt, act, suffix, decimals }) => (
                        <tr key={label} className="border-b border-muted/50 last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">{label}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {tgt != null ? `${decimals != null ? Number(tgt).toFixed(decimals) : tgt.toLocaleString()}${suffix || ""}` : "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {act != null ? `${decimals != null ? Number(act).toFixed(decimals) : act.toLocaleString()}${suffix || ""}` : "—"}
                          </td>
                          <td className="py-2 pl-3 text-right">
                            {tgt != null && act != null
                              ? <VarianceIndicator actual={act} target={tgt} decimals={decimals} />
                              : <span className="text-muted-foreground text-xs">—</span>
                            }
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
