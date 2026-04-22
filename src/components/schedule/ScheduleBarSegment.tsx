import { parseISO, differenceInDays, isAfter, format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScheduleWithDetails } from "@/hooks/useProductionSchedule";
import type { BarSegment } from "./lane-layout";

interface Props {
  segment: BarSegment;
  dayWidth: number;
  rowPadding: number;
  laneHeight: number;
  laneGap: number;
  onClick: () => void;
}

function getBarStyles(schedule: ScheduleWithDetails): { bg: string; text: string; border: string } {
  if (schedule.status === "completed") {
    return { bg: "bg-slate-100", text: "text-slate-400", border: "border-slate-200" };
  }
  if (schedule.colour) {
    return { bg: "", text: "text-white", border: "border-transparent" };
  }
  const exFactory = schedule.workOrder.planned_ex_factory;
  if (exFactory) {
    const endDate = parseISO(schedule.end_date);
    const exDate = parseISO(exFactory);
    if (isAfter(endDate, exDate)) {
      return { bg: "bg-gradient-to-r from-red-500 to-red-600", text: "text-white", border: "border-red-600/20" };
    }
    const daysToEx = differenceInDays(exDate, endDate);
    if (daysToEx <= 7) {
      return { bg: "bg-gradient-to-r from-amber-500 to-amber-600", text: "text-white", border: "border-amber-600/20" };
    }
  }
  return { bg: "bg-gradient-to-r from-blue-500 to-blue-600", text: "text-white", border: "border-blue-700/10" };
}

export function ScheduleBarSegment({ segment, dayWidth, rowPadding, laneHeight, laneGap, onClick }: Props) {
  const { schedule, startDay, endDay, lane, totalLanes, isFirstSegment, isLastSegment } = segment;
  const styles = getBarStyles(schedule);
  const isDelayed = schedule.status === "delayed";
  const isCompleted = schedule.status === "completed";

  // Horizontal position
  const left = startDay * dayWidth + 3;
  const durationDays = endDay - startDay + 1;
  const width = Math.max(durationDays * dayWidth - 6, dayWidth * 0.4);

  // Vertical position within the row
  const top = rowPadding + lane * (laneHeight + laneGap);
  const height = laneHeight;

  // Rounding: only round the outer edges of the first/last segment
  const roundedLeft = isFirstSegment ? "rounded-l-lg" : "rounded-l-none";
  const roundedRight = isLastSegment ? "rounded-r-lg" : "rounded-r-none";

  // Only show text content on segments wide enough
  const showText = width > 40;
  // Show secondary text only on wider segments
  const showSecondary = width > 100 && laneHeight >= 36;

  // Ex-factory deadline marker (only on last segment)
  const exFactory = schedule.workOrder.planned_ex_factory;
  let exMarkerLeft: number | null = null;
  if (isLastSegment && exFactory && !isCompleted) {
    const exDate = parseISO(exFactory);
    const scheduleEnd = parseISO(schedule.end_date);
    const exDayOffset = differenceInDays(exDate, parseISO(schedule.start_date));
    // Only show if the ex-factory date falls within this segment's range
    const exDayFromVisStart = differenceInDays(exDate, new Date()); // just for tooltip
    const exAbsDay = startDay + differenceInDays(exDate, parseISO(schedule.start_date)) - differenceInDays(parseISO(schedule.start_date), parseISO(schedule.start_date));
    // Simpler: compute from visible start
    const visStart = new Date();
    // Actually let's just compute it properly
  }

  // Tooltip data
  const schedStart = parseISO(schedule.start_date);
  const schedEnd = parseISO(schedule.end_date);
  const daysRemaining = exFactory ? differenceInDays(parseISO(exFactory), new Date()) : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`absolute shadow-sm cursor-pointer
            transition-all duration-200 ease-out
            hover:shadow-lg hover:brightness-105 hover:z-20
            flex items-center overflow-hidden
            border ${styles.border} ${styles.bg} ${styles.text}
            ${isDelayed && isFirstSegment ? "ring-2 ring-red-400/40 ring-offset-1" : ""}
            ${isCompleted ? "opacity-50" : ""}
            ${roundedLeft} ${roundedRight}
          `}
          style={{
            top,
            height,
            left,
            width,
            ...(schedule.colour && !isCompleted ? { backgroundColor: schedule.colour } : {}),
          }}
          onClick={onClick}
        >
          {showText && (
            <div className="flex flex-col justify-center px-2.5 py-0.5 min-w-0 w-full">
              <span className={`${laneHeight >= 36 ? "text-[11px]" : "text-[9px]"} font-bold tracking-wide truncate leading-tight`}>
                {schedule.workOrder.po_number}
              </span>
              {showSecondary && (
                <span className={`text-[9px] truncate leading-tight mt-0.5 ${isCompleted ? "opacity-60" : "opacity-75"}`}>
                  {schedule.workOrder.buyer} · {schedule.workOrder.style}
                </span>
              )}
            </div>
          )}

          {/* Delayed indicator stripe */}
          {isDelayed && isFirstSegment && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 rounded-l-lg" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] p-3">
        <div className="space-y-1.5">
          <p className="font-bold text-[13px] text-foreground">{schedule.workOrder.po_number}</p>
          <p className="text-[11px] text-muted-foreground">{schedule.workOrder.buyer} · {schedule.workOrder.style}</p>
          <div className="h-px bg-border my-1.5" />
          <p className="text-[11px] text-foreground">{format(schedStart, "d MMM")} → {format(schedEnd, "d MMM yyyy")}</p>
          <p className="text-[11px] text-muted-foreground">{differenceInDays(schedEnd, schedStart) + 1} days · {schedule.workOrder.order_qty?.toLocaleString()} pcs</p>
          {daysRemaining !== null && (
            <p className={`text-[11px] font-semibold ${daysRemaining <= 0 ? "text-red-600" : daysRemaining <= 7 ? "text-amber-600" : "text-emerald-600"}`}>
              {daysRemaining <= 0 ? `${Math.abs(daysRemaining)}d past ex-factory` : `${daysRemaining}d to ex-factory`}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
