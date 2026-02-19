import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Scissors, CheckCircle, Shirt, CircleDot, Flame, Package, Box, Archive, FileText, Calendar, User, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface FinishingDailyLog {
  id: string;
  production_date: string;
  line_id: string | null;
  work_order_id: string | null;
  log_type: "TARGET" | "OUTPUT";
  shift: string | null;
  thread_cutting: number;
  inside_check: number;
  top_side_check: number;
  buttoning: number;
  iron: number;
  get_up: number;
  poly: number;
  carton: number;
  planned_hours: number | null;
  actual_hours: number | null;
  ot_hours_actual?: number | null;
  ot_manpower_actual?: number | null;
  ot_hours_planned?: number | null;
  ot_manpower_planned?: number | null;
  remarks: string | null;
  submitted_at: string;
  is_locked: boolean;
  line: {
    line_id: string;
    name: string | null;
  } | null;
  work_order: {
    po_number: string;
    style: string;
    buyer: string;
  } | null;
}

interface FinishingLogDetailModalProps {
  log: FinishingDailyLog | null;
  counterpart?: FinishingDailyLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROCESS_ITEMS = [
  { key: "thread_cutting", label: "Thread Cutting", icon: Scissors },
  { key: "inside_check", label: "Inside Check", icon: CheckCircle },
  { key: "top_side_check", label: "Top Side Check", icon: Shirt },
  { key: "buttoning", label: "Buttoning", icon: CircleDot },
  { key: "iron", label: "Iron", icon: Flame },
  { key: "get_up", label: "Get-up", icon: Package },
  { key: "poly", label: "Poly", icon: Box },
  { key: "carton", label: "Carton", icon: Archive },
] as const;

function VarianceIndicator({ actual, target }: { actual: number; target: number }) {
  const diff = actual - target;
  if (diff > 0) return <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><TrendingUp className="h-3 w-3" />+{diff.toLocaleString()}</span>;
  if (diff < 0) return <span className="text-destructive flex items-center gap-1"><TrendingDown className="h-3 w-3" />{diff.toLocaleString()}</span>;
  return <span className="text-muted-foreground flex items-center gap-1"><Minus className="h-3 w-3" />0</span>;
}

export function FinishingLogDetailModal({ log, counterpart, open, onOpenChange }: FinishingLogDetailModalProps) {
  if (!log) return null;

  const calculateTotal = () => {
    return (log.carton || 0);
  };

  // When viewing an OUTPUT with a TARGET counterpart, show comparison
  const showComparison = log.log_type === "OUTPUT" && counterpart?.log_type === "TARGET";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {log.log_type === "TARGET" ? "Daily Target Details" : "Daily Output Details"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(parseISO(log.production_date), "MMM dd, yyyy")}</span>
            </div>
            <div>
              <Badge variant={log.log_type === "TARGET" ? "secondary" : "default"}>
                {log.log_type}
              </Badge>
            </div>
          </div>

          {/* PO Info */}
          {log.work_order && (
            <div className="border rounded-lg p-3 space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">PO Number:</span>
                <p className="font-medium">{log.work_order.po_number}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-sm text-muted-foreground">Style:</span>
                  <p className="font-medium">{log.work_order.style}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Buyer:</span>
                  <p className="font-medium">{log.work_order.buyer}</p>
                </div>
              </div>
            </div>
          )}

          {/* Process Values */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">Process Values</span>
              <span className="text-sm text-muted-foreground">
                Total: {calculateTotal().toLocaleString()} pcs
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PROCESS_ITEMS.map((item) => {
                const Icon = item.icon;
                const value = log[item.key as keyof typeof log] as number;
                return (
                  <div key={item.key} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span className="font-medium">{value || 0}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Target vs Output Comparison */}
          {showComparison && counterpart && (
            <div className="border rounded-lg p-3 bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">Target vs Output</span>
                <Badge variant="outline" className="text-xs">Comparison</Badge>
              </div>
              <div className="space-y-1">
                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground mb-2">
                  <span>Process</span>
                  <span className="text-right">Target</span>
                  <span className="text-right">Output</span>
                  <span className="text-right">Variance</span>
                </div>
                {PROCESS_ITEMS.map((item) => {
                  const outputVal = (log[item.key as keyof typeof log] as number) || 0;
                  const targetVal = (counterpart[item.key as keyof typeof counterpart] as number) || 0;
                  return (
                    <div key={item.key} className="grid grid-cols-4 gap-2 text-sm items-center">
                      <span className="text-muted-foreground truncate text-xs">{item.label}</span>
                      <span className="text-right text-muted-foreground">{targetVal}</span>
                      <span className="text-right font-medium">{outputVal}</span>
                      <div className="text-right text-xs">
                        <VarianceIndicator actual={outputVal} target={targetVal} />
                      </div>
                    </div>
                  );
                })}
                {(counterpart.planned_hours != null || log.actual_hours != null) && (
                  <div className="grid grid-cols-4 gap-2 text-sm items-center border-t pt-1 mt-1">
                    <span className="text-muted-foreground text-xs">Hours</span>
                    <span className="text-right text-muted-foreground">{counterpart.planned_hours ?? "—"}</span>
                    <span className="text-right font-medium">{log.actual_hours ?? "—"}</span>
                    <div className="text-right text-xs">
                      {counterpart.planned_hours != null && log.actual_hours != null ? (
                        <VarianceIndicator actual={log.actual_hours} target={counterpart.planned_hours} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hours */}
          {(log.planned_hours != null || log.actual_hours != null) && (
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Hours</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {log.planned_hours != null && (
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="text-xs text-muted-foreground">Planned</span>
                    <p className="font-medium">{log.planned_hours}h</p>
                  </div>
                )}
                {log.actual_hours != null && (
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="text-xs text-muted-foreground">Actual</span>
                    <p className="font-medium">{log.actual_hours}h</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OT Section */}
          {(log.ot_hours_actual != null || log.ot_manpower_actual != null || log.ot_hours_planned != null || log.ot_manpower_planned != null) && (
            <div className="border rounded-lg p-3">
              <span className="font-medium">Overtime</span>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {log.ot_hours_planned != null && (
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="text-xs text-muted-foreground">OT Hours Planned</span>
                    <p className="font-medium">{log.ot_hours_planned}h</p>
                  </div>
                )}
                {log.ot_hours_actual != null && (
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="text-xs text-muted-foreground">OT Hours Actual</span>
                    <p className="font-medium">{log.ot_hours_actual}h</p>
                  </div>
                )}
                {log.ot_manpower_planned != null && (
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="text-xs text-muted-foreground">OT Manpower Planned</span>
                    <p className="font-medium">{log.ot_manpower_planned}</p>
                  </div>
                )}
                {log.ot_manpower_actual != null && (
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="text-xs text-muted-foreground">OT Manpower Actual</span>
                    <p className="font-medium">{log.ot_manpower_actual}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Remarks */}
          {log.remarks && (
            <div className="border rounded-lg p-3">
              <span className="text-sm text-muted-foreground">Remarks:</span>
              <p className="mt-1">{log.remarks}</p>
            </div>
          )}

          {/* Submitted At */}
          <div className="text-xs text-muted-foreground text-center">
            Submitted: {format(parseISO(log.submitted_at), "MMM dd, yyyy 'at' h:mm a")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
