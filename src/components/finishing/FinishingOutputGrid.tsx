import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Plus, Edit2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HourlyLog {
  id: string;
  sheet_id: string;
  hour_slot: string;
  thread_cutting_target: number;
  thread_cutting_actual: number;
  inside_check_target: number;
  inside_check_actual: number;
  top_side_check_target: number;
  top_side_check_actual: number;
  buttoning_target: number;
  buttoning_actual: number;
  iron_target: number;
  iron_actual: number;
  get_up_target: number;
  get_up_actual: number;
  poly_target: number;
  poly_actual: number;
  carton_target: number;
  carton_actual: number;
  remarks: string | null;
  is_locked: boolean;
  submitted_at: string;
  submitted_by: string;
}

interface FinishingOutputGridProps {
  hourSlots: string[];
  hourlyLogs: HourlyLog[];
  currentHourSlot: string | null;
  isAdmin: boolean;
  userId: string;
  onAddOutput: (slot: string) => void;
  onToggleLock: (log: HourlyLog) => void;
}

const PROCESS_COLUMNS = [
  { key: "thread_cutting", label: "Thread Cutting" },
  { key: "inside_check", label: "Inside Check" },
  { key: "top_side_check", label: "Top Side Check" },
  { key: "buttoning", label: "Buttoning" },
  { key: "iron", label: "Iron" },
  { key: "get_up", label: "Get-up" },
  { key: "poly", label: "Poly" },
  { key: "carton", label: "Carton" },
];

export function FinishingOutputGrid({
  hourSlots,
  hourlyLogs,
  currentHourSlot,
  isAdmin,
  userId,
  onAddOutput,
  onToggleLock,
}: FinishingOutputGridProps) {
  const getLogForSlot = (slot: string) => {
    return hourlyLogs.find(log => log.hour_slot === slot);
  };

  const hasTargetData = (log: HourlyLog | undefined) => {
    if (!log) return false;
    return log.thread_cutting_target > 0 || log.inside_check_target > 0 || 
           log.top_side_check_target > 0 || log.buttoning_target > 0 ||
           log.iron_target > 0 || log.get_up_target > 0 ||
           log.poly_target > 0 || log.carton_target > 0;
  };

  const hasActualData = (log: HourlyLog | undefined) => {
    if (!log) return false;
    return log.thread_cutting_actual > 0 || log.inside_check_actual > 0 || 
           log.top_side_check_actual > 0 || log.buttoning_actual > 0 ||
           log.iron_actual > 0 || log.get_up_actual > 0 ||
           log.poly_actual > 0 || log.carton_actual > 0;
  };

  const canEdit = (log: HourlyLog | undefined) => {
    if (!log) return false;
    if (!hasTargetData(log)) return false;
    if (isAdmin) return true;
    if (log.is_locked) return false;
    return log.submitted_by === userId;
  };

  return (
    <div className="min-w-[900px]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="border p-2 text-left font-medium w-24">Time</th>
            {PROCESS_COLUMNS.map(col => (
              <th key={col.key} className="border p-2 text-center font-medium min-w-20">
                {col.label}
              </th>
            ))}
            <th className="border p-2 text-center font-medium w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {hourSlots.map(slot => {
            const log = getLogForSlot(slot);
            const isCurrent = slot === currentHourSlot;
            const hasTarget = hasTargetData(log);
            const hasActual = hasActualData(log);
            const editable = canEdit(log);

            return (
              <tr 
                key={slot} 
                className={cn(
                  "hover:bg-muted/30 transition-colors",
                  isCurrent && hasTarget && !hasActual && "bg-primary/5",
                  hasActual && "bg-green-50 dark:bg-green-950/20",
                  !hasTarget && "bg-muted/20"
                )}
              >
                <td className="border p-2 font-medium">
                  <div className="flex items-center gap-2">
                    <span className={cn(slot.startsWith("OT-") && "text-amber-600 dark:text-amber-400")}>
                      {slot}
                    </span>
                    {isCurrent && hasTarget && !hasActual && (
                      <Badge variant="outline" className="text-xs">Now</Badge>
                    )}
                    {hasActual && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {!hasTarget && (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </td>
                {PROCESS_COLUMNS.map(col => {
                  const targetKey = `${col.key}_target` as keyof HourlyLog;
                  const actualKey = `${col.key}_actual` as keyof HourlyLog;
                  const target = log ? (log[targetKey] as number) : null;
                  const actual = log ? (log[actualKey] as number) : null;

                  if (!hasTarget) {
                    return (
                      <td key={col.key} className="border p-1 text-center text-muted-foreground">
                        -
                      </td>
                    );
                  }

                  return (
                    <td key={col.key} className="border p-1 text-center">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">T: {target}</span>
                        <span className={cn(
                          "font-medium",
                          actual !== null && target !== null && actual < target && "text-destructive",
                          actual !== null && target !== null && actual >= target && "text-green-600"
                        )}>
                          A: {actual || 0}
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td className="border p-2">
                  <div className="flex items-center justify-center gap-1">
                    {hasTarget ? (
                      <>
                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onAddOutput(slot)}
                          >
                            {hasActual ? (
                              <Edit2 className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        {isAdmin && log && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onToggleLock(log)}
                          >
                            {log.is_locked ? (
                              <Lock className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">No target</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
