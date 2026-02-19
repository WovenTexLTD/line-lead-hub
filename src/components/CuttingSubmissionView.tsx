import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatDateTimeInTimezone } from "@/lib/date-utils";
import {
  Scissors,
  Target,
  Package,
  ImageIcon,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

export interface CuttingTargetData {
  id: string;
  production_date: string;
  line_name: string;
  buyer: string | null;
  style: string | null;
  po_number: string | null;
  colour: string | null;
  order_qty: number | null;
  submitted_at: string | null;
  man_power: number | null;
  marker_capacity: number | null;
  lay_capacity: number | null;
  cutting_capacity: number | null;
  under_qty: number | null;
  day_cutting: number | null;
  day_input: number | null;
  ot_hours_planned: number | null;
  ot_manpower_planned: number | null;
}

export interface CuttingActualData {
  id: string;
  production_date: string;
  line_name: string;
  buyer: string | null;
  style: string | null;
  po_number: string | null;
  colour: string | null;
  order_qty: number | null;
  submitted_at: string | null;
  man_power: number | null;
  marker_capacity: number | null;
  lay_capacity: number | null;
  cutting_capacity: number | null;
  under_qty: number | null;
  day_cutting: number;
  day_input: number;
  total_cutting: number | null;
  total_input: number | null;
  balance: number | null;
  ot_hours_actual: number | null;
  ot_manpower_actual: number | null;
  leftover_recorded: boolean | null;
  leftover_type: string | null;
  leftover_unit: string | null;
  leftover_quantity: number | null;
  leftover_notes: string | null;
  leftover_location: string | null;
  leftover_photo_urls?: string[] | null;
}

interface CuttingSubmissionViewProps {
  target?: CuttingTargetData | null;
  actual?: CuttingActualData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function VarianceIndicator({ actual, target }: { actual: number; target: number }) {
  const diff = actual - target;
  if (diff > 0) return <span className="text-green-600 dark:text-green-400 flex items-center gap-1 text-xs"><TrendingUp className="h-3 w-3" />+{diff.toLocaleString()}</span>;
  if (diff < 0) return <span className="text-destructive flex items-center gap-1 text-xs"><TrendingDown className="h-3 w-3" />{diff.toLocaleString()}</span>;
  return <span className="text-muted-foreground flex items-center gap-1 text-xs"><Minus className="h-3 w-3" />0</span>;
}

function FieldDisplay({ label, value, className }: {
  label: string;
  value: string | number | null | undefined;
  className?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`font-semibold ${className || ""}`}>
        {value != null ? (typeof value === "number" ? value.toLocaleString() : value) : "-"}
      </p>
    </div>
  );
}

export function CuttingSubmissionView({ target, actual, open, onOpenChange }: CuttingSubmissionViewProps) {
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
    ? "Cutting Submission"
    : hasActual
      ? "Cutting End of Day"
      : "Cutting Target";

  const Icon = hasActual ? Scissors : Target;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
          {/* Section B: Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <FieldDisplay label="Date" value={formatDate(primary.production_date)} />
            <FieldDisplay label="Line" value={primary.line_name} />
            <FieldDisplay label="Buyer" value={primary.buyer} />
            <FieldDisplay label="Style" value={primary.style} />
            <FieldDisplay label="PO Number" value={primary.po_number} />
            <FieldDisplay label="Colour" value={primary.colour} />
            <FieldDisplay label="Order Qty" value={primary.order_qty} />
          </div>

          {/* Section C: Performance Summary (comparison mode) */}
          {isComparison && target && actual && (
            <div className="border rounded-lg p-3 bg-primary/5">
              <h4 className="font-semibold text-sm mb-3 flex items-center justify-between">
                <span>Target vs Actual</span>
                <Badge variant="outline" className="text-xs">Comparison</Badge>
              </h4>
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground mb-1">
                  <span></span>
                  <span className="text-right">Target</span>
                  <span className="text-right">Actual</span>
                  <span className="text-right">Variance</span>
                </div>
                {[
                  { label: "Day Cutting", tgt: target.day_cutting, act: actual.day_cutting },
                  { label: "Day Input", tgt: target.day_input, act: actual.day_input },
                  { label: "Man Power", tgt: target.man_power, act: actual.man_power },
                  { label: "Cutting Capacity", tgt: target.cutting_capacity, act: actual.cutting_capacity },
                  { label: "Marker Capacity", tgt: target.marker_capacity, act: actual.marker_capacity },
                  { label: "Lay Capacity", tgt: target.lay_capacity, act: actual.lay_capacity },
                  ...(target.ot_hours_planned != null || actual.ot_hours_actual != null
                    ? [{ label: "OT Hours", tgt: target.ot_hours_planned, act: actual.ot_hours_actual }]
                    : []),
                  ...(target.ot_manpower_planned != null || actual.ot_manpower_actual != null
                    ? [{ label: "OT Manpower", tgt: target.ot_manpower_planned, act: actual.ot_manpower_actual }]
                    : []),
                ].map(({ label, tgt, act }) => (
                  <div key={label} className="grid grid-cols-4 gap-2 text-sm items-center">
                    <span className="text-muted-foreground truncate text-xs">{label}</span>
                    <span className="text-right text-muted-foreground">{(tgt ?? 0).toLocaleString()}</span>
                    <span className="text-right font-medium">{(act ?? 0).toLocaleString()}</span>
                    <div className="text-right">
                      <VarianceIndicator actual={act ?? 0} target={tgt ?? 0} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section D: Target Details (target-only mode) */}
          {hasTarget && !hasActual && target && (
            <>
              <div>
                <h4 className="font-semibold text-sm mb-3 text-primary">Target Capacities</h4>
                <div className="grid grid-cols-2 gap-4 p-3 bg-primary/5 rounded-lg">
                  <FieldDisplay label="Man Power" value={target.man_power} className="text-lg" />
                  <FieldDisplay label="Marker Capacity" value={target.marker_capacity} className="text-lg" />
                  <FieldDisplay label="Lay Capacity" value={target.lay_capacity} className="text-lg" />
                  <FieldDisplay label="Cutting Capacity" value={target.cutting_capacity} className="text-lg text-primary" />
                  <FieldDisplay label="Under Qty" value={target.under_qty} />
                  {target.ot_hours_planned != null && (
                    <FieldDisplay label="OT Hours Planned" value={target.ot_hours_planned} className="text-lg" />
                  )}
                  {target.ot_manpower_planned != null && (
                    <FieldDisplay label="OT Manpower Planned" value={target.ot_manpower_planned} className="text-lg" />
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-3 text-success">Target Daily Output</h4>
                <div className="grid grid-cols-2 gap-4 p-3 bg-success/5 rounded-lg">
                  <FieldDisplay label="Day Cutting Target" value={target.day_cutting ?? 0} className="text-xl" />
                  <FieldDisplay label="Day Input Target" value={target.day_input ?? 0} className="text-xl text-success" />
                </div>
              </div>
              <div className="text-center py-4 text-muted-foreground border rounded-lg bg-muted/30">
                <Scissors className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">End of day not submitted yet</p>
              </div>
            </>
          )}

          {/* Section E: Actual Details */}
          {hasActual && actual && (
            <>
              {/* When actual-only, show capacity fields */}
              {!hasTarget && (
                <div>
                  <h4 className="font-semibold text-sm mb-3">Capacities</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldDisplay label="Man Power" value={actual.man_power} />
                    <FieldDisplay label="Marker Capacity" value={actual.marker_capacity} />
                    <FieldDisplay label="Lay Capacity" value={actual.lay_capacity} />
                    <FieldDisplay label="Cutting Capacity" value={actual.cutting_capacity} className="text-primary" />
                    <FieldDisplay label="Under Qty" value={actual.under_qty} />
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-sm mb-3">
                  {isComparison ? "Cumulative Totals" : "Daily Output"}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {!isComparison && (
                    <>
                      <FieldDisplay label="Day Cutting" value={actual.day_cutting} />
                      <FieldDisplay label="Day Input" value={actual.day_input} className="text-success" />
                    </>
                  )}
                  <FieldDisplay label="Total Cutting" value={actual.total_cutting} />
                  <FieldDisplay label="Total Input" value={actual.total_input} className="text-success" />
                </div>
                {(actual.ot_hours_actual != null || actual.ot_manpower_actual != null) && !isComparison && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FieldDisplay label="OT Hours Actual" value={actual.ot_hours_actual} />
                    <FieldDisplay label="OT Manpower Actual" value={actual.ot_manpower_actual} />
                  </div>
                )}
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance</p>
                  <p className={`text-xl font-bold ${actual.balance != null && actual.balance < 0 ? "text-destructive" : ""}`}>
                    {actual.balance?.toLocaleString() || "-"}
                  </p>
                </div>
              </div>

              {/* When actual-only, show "target not submitted" message */}
              {!hasTarget && (
                <div className="text-center py-4 text-muted-foreground border rounded-lg bg-muted/30">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Morning target not submitted</p>
                </div>
              )}
            </>
          )}

          {/* Section F: Leftover / Fabric Saved */}
          {actual?.leftover_recorded && (
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Left Over / Fabric Saved
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <FieldDisplay label="Type" value={actual.leftover_type} />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Quantity</p>
                  <p className="font-semibold">
                    {actual.leftover_quantity?.toLocaleString() || "-"} {actual.leftover_unit || ""}
                  </p>
                </div>
                {actual.leftover_location && (
                  <div className="col-span-2">
                    <FieldDisplay label="Stored Location" value={actual.leftover_location} />
                  </div>
                )}
                {actual.leftover_notes && (
                  <div className="col-span-2">
                    <FieldDisplay label="Notes" value={actual.leftover_notes} className="text-sm" />
                  </div>
                )}
              </div>
              {actual.leftover_photo_urls && actual.leftover_photo_urls.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    Photos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {actual.leftover_photo_urls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-16 h-16 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                      >
                        <img src={url} alt={`Leftover ${index + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section G: Timestamps */}
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
            {target?.submitted_at && (
              <p>Target submitted: {formatDateTime(target.submitted_at)}</p>
            )}
            {actual?.submitted_at && (
              <p>Actual submitted: {formatDateTime(actual.submitted_at)}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
