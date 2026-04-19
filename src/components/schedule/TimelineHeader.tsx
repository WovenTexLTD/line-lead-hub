import { eachDayOfInterval, format, isToday, isWeekend } from "date-fns";
import type { ViewMode } from "@/hooks/useTimelineState";

interface Props {
  visibleRange: { start: Date; end: Date };
  viewMode: ViewMode;
  dayWidth: number;
}

export function TimelineHeader({ visibleRange, viewMode, dayWidth }: Props) {
  const days = eachDayOfInterval(visibleRange);
  const isMonth = viewMode === "month";

  return (
    <div className="flex border-b-2 border-slate-200 bg-slate-50/80">
      {/* Fixed line column header */}
      <div className="w-[176px] shrink-0 border-r-2 border-slate-200 px-5 py-3 flex items-end">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Production Line</span>
      </div>

      {/* Date columns */}
      <div className="flex">
        {days.map((day, i) => {
          const weekend = isWeekend(day);
          const todayCol = isToday(day);
          const isMonday = day.getDay() === 1;
          return (
            <div
              key={day.toISOString()}
              className={`flex flex-col items-center justify-center py-2.5
                ${weekend ? "bg-slate-100/50" : ""}
                ${todayCol ? "bg-blue-50/80" : ""}
                ${isMonday && i > 0 ? "border-l border-slate-200" : "border-l border-slate-100/80"}
              `}
              style={{ width: dayWidth, minWidth: dayWidth }}
            >
              <span className={`text-[9px] font-medium uppercase tracking-wide ${todayCol ? "text-blue-600" : weekend ? "text-slate-350" : "text-slate-400"}`}>
                {isMonth ? format(day, "EEEEE") : format(day, "EEE")}
              </span>
              <span className={`${isMonth ? "text-[10px]" : "text-xs"} font-bold tabular-nums mt-0.5 ${todayCol ? "text-blue-700" : weekend ? "text-slate-400" : "text-slate-600"}`}>
                {format(day, "d")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
