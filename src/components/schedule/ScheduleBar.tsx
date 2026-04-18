import { parseISO, differenceInDays, isAfter } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import type { ScheduleWithDetails } from "@/hooks/useProductionSchedule";

interface Props {
  schedule: ScheduleWithDetails;
  visibleStart: Date;
  dayWidth: number;
  onClick: () => void;
}

function getBarColor(schedule: ScheduleWithDetails): string {
  if (schedule.status === "completed") return "bg-slate-200 text-slate-500 opacity-60";
  if (schedule.colour) return "text-white";
  const exFactory = schedule.workOrder.planned_ex_factory;
  if (exFactory) {
    const endDate = parseISO(schedule.end_date);
    const exDate = parseISO(exFactory);
    if (isAfter(endDate, exDate)) return "bg-red-500/90 text-white";
    const daysToEx = differenceInDays(exDate, endDate);
    if (daysToEx <= 7) return "bg-amber-500/90 text-white";
  }
  return "bg-blue-500/90 text-white";
}

export function ScheduleBar({ schedule, visibleStart, dayWidth, onClick }: Props) {
  const start = parseISO(schedule.start_date);
  const end = parseISO(schedule.end_date);

  const offsetDays = Math.max(0, differenceInDays(start, visibleStart));
  const clippedStart = start < visibleStart ? visibleStart : start;
  const durationDays = differenceInDays(end, clippedStart) + 1;

  const left = offsetDays * dayWidth;
  const width = Math.max(durationDays * dayWidth - 4, dayWidth - 4);

  const barColor = getBarColor(schedule);
  const isDelayed = schedule.status === "delayed";

  const exFactory = schedule.workOrder.planned_ex_factory;
  let exMarkerLeft: number | null = null;
  if (exFactory) {
    const exDate = parseISO(exFactory);
    const exOffset = differenceInDays(exDate, visibleStart);
    if (exOffset >= 0) {
      exMarkerLeft = exOffset * dayWidth + dayWidth / 2;
    }
  }

  const daysRemaining = exFactory ? differenceInDays(parseISO(exFactory), new Date()) : null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`absolute top-[10px] h-[44px] rounded-md shadow-sm cursor-pointer transition-all duration-150 hover:brightness-110 hover:shadow-md flex items-center px-3 gap-1.5 overflow-hidden ${barColor} ${isDelayed ? "border-l-4 border-red-600" : ""}`}
            style={{
              left: `${left + 2}px`,
              width: `${width}px`,
              ...(schedule.colour && schedule.status !== "completed" ? { backgroundColor: schedule.colour } : {}),
            }}
            onClick={onClick}
          >
            <span className="text-xs font-semibold truncate">{schedule.workOrder.po_number}</span>
            <span className="text-[10px] opacity-80 truncate hidden sm:inline">{schedule.workOrder.buyer}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <div className="space-y-1">
            <p className="font-semibold text-sm">{schedule.workOrder.po_number}</p>
            <p className="text-xs text-muted-foreground">{schedule.workOrder.buyer} – {schedule.workOrder.style}</p>
            <p className="text-xs">{format(start, "d MMM")} → {format(end, "d MMM yyyy")}</p>
            {daysRemaining !== null && (
              <p className={`text-xs font-medium ${daysRemaining <= 0 ? "text-red-600" : daysRemaining <= 7 ? "text-amber-600" : "text-slate-600"}`}>
                {daysRemaining <= 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d to ex-factory`}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {exMarkerLeft !== null && (
        <div
          className="absolute top-[6px] w-[2px] h-[10px] bg-red-400/60 rounded-full pointer-events-none"
          style={{ left: `${exMarkerLeft}px` }}
        />
      )}
    </>
  );
}
