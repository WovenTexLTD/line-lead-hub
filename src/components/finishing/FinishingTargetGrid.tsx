import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Plus, Edit2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HourlyLog {
  id: string;
  sheet_id: string;
  hour_slot: string;
  thread_cutting_target: number;
  inside_check_target: number;
  top_side_check_target: number;
  buttoning_target: number;
  iron_target: number;
  get_up_target: number;
  poly_target: number;
  carton_target: number;
  remarks: string | null;
  is_locked: boolean;
  submitted_at: string;
  submitted_by: string;
}

interface FinishingTargetGridProps {
  hourSlots: string[];
  hourlyLogs: HourlyLog[];
  currentHourSlot: string | null;
  isAdmin: boolean;
  userId: string;
  onAddHour: (slot: string) => void;
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

export function FinishingTargetGrid({
  hourSlots,
  hourlyLogs,
  currentHourSlot,
  isAdmin,
  userId,
  onAddHour,
  onToggleLock,
}: FinishingTargetGridProps) {
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

  const canEdit = (log: HourlyLog | undefined) => {
    if (!log) return true;
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
            const editable = canEdit(log);

            return (
              <tr 
                key={slot} 
                className={cn(
                  "hover:bg-muted/30 transition-colors",
                  isCurrent && !hasTarget && "bg-primary/5",
                  hasTarget && "bg-blue-50 dark:bg-blue-950/20"
                )}
              >
                <td className="border p-2 font-medium">
                  <div className="flex items-center gap-2">
                    <span className={cn(slot.startsWith("OT-") && "text-amber-600 dark:text-amber-400")}>
                      {slot}
                    </span>
                    {isCurrent && !hasTarget && (
                      <Badge variant="outline" className="text-xs">Now</Badge>
                    )}
                    {hasTarget && (
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                </td>
                {PROCESS_COLUMNS.map(col => {
                  const targetKey = `${col.key}_target` as keyof HourlyLog;
                  const target = log ? (log[targetKey] as number) : null;

                  return (
                    <td key={col.key} className="border p-1 text-center">
                      {log && hasTarget ? (
                        <span className="font-medium text-blue-600">
                          {target}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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
                            onClick={() => onAddHour(slot)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onToggleLock(log!)}
                          >
                            {log?.is_locked ? (
                              <Lock className="h-3.5 w-3.5 text-amber-600" />
                            ) : (
                              <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onAddHour(slot)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Set
                      </Button>
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
