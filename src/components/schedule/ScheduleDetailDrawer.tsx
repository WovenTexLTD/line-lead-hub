import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO, differenceInDays } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import type { ScheduleWithDetails } from "@/hooks/useProductionSchedule";

interface Props {
  schedule: ScheduleWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (schedule: ScheduleWithDetails) => void;
  onDelete: (id: string) => void;
}

const statusColors: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  delayed: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  delayed: "Delayed",
};

export function ScheduleDetailDrawer({ schedule, open, onOpenChange, onEdit, onDelete }: Props) {
  if (!schedule) return null;

  const wo = schedule.workOrder;
  const start = parseISO(schedule.start_date);
  const end = parseISO(schedule.end_date);
  const duration = differenceInDays(end, start) + 1;
  const isAtRisk = wo.planned_ex_factory && parseISO(schedule.end_date) > parseISO(wo.planned_ex_factory);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[400px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">{wo.po_number}</SheetTitle>
            <Badge className={statusColors[schedule.status]}>{statusLabels[schedule.status]}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <DetailSection label="Buyer" value={wo.buyer} />
          <DetailSection label="Style" value={wo.style} />
          {wo.color && <DetailSection label="Color" value={wo.color} />}
          {wo.item && <DetailSection label="Item" value={wo.item} />}
          <DetailSection label="Line" value={`${schedule.line.line_id}${schedule.line.name ? ` – ${schedule.line.name}` : ""}`} />
          <DetailSection label="Start Date" value={format(start, "d MMMM yyyy")} />
          <DetailSection label="End Date" value={format(end, "d MMMM yyyy")} />
          <DetailSection label="Duration" value={`${duration} day${duration !== 1 ? "s" : ""}`} />

          {wo.planned_ex_factory && (
            <div className="flex items-start justify-between py-2 border-b border-slate-100">
              <span className="text-xs text-slate-500">Ex-Factory</span>
              <span className={`text-sm font-medium ${isAtRisk ? "text-red-600" : "text-slate-800"}`}>
                {format(parseISO(wo.planned_ex_factory), "d MMMM yyyy")}
                {isAtRisk && <span className="ml-1 text-[10px] text-red-500">(at risk)</span>}
              </span>
            </div>
          )}

          {schedule.target_qty && <DetailSection label="Target Qty" value={schedule.target_qty.toLocaleString()} />}
          {schedule.daily_target && <DetailSection label="Daily Target" value={schedule.daily_target.toLocaleString()} />}
          <DetailSection label="Order Qty" value={wo.order_qty?.toLocaleString() ?? "—"} />
          {schedule.notes && <DetailSection label="Notes" value={schedule.notes} />}
        </div>

        <div className="mt-8 flex items-center gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { onOpenChange(false); onEdit(schedule); }}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit Schedule
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 text-red-500 hover:text-red-600 hover:border-red-200">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from schedule?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will unschedule {wo.po_number} from {schedule.line.line_id}. The PO will appear in the unscheduled queue.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={() => { onDelete(schedule.id); onOpenChange(false); }}>
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailSection({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-100">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right max-w-[60%]">{value}</span>
    </div>
  );
}
