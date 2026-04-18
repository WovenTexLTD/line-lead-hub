import { eachDayOfInterval, format, isToday, isWeekend } from "date-fns";
import type { ViewMode } from "@/hooks/useTimelineState";

interface Props {
  visibleRange: { start: Date; end: Date };
  viewMode: ViewMode;
  dayWidth: number;
}

export function TimelineHeader({ visibleRange, viewMode, dayWidth }: Props) {
  const days = eachDayOfInterval(visibleRange);

  return (
    <div className="flex border-b border-slate-200">
      <div className="w-[168px] shrink-0 border-r border-slate-200 bg-slate-50/50 px-4 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Line</span>
      </div>
      <div className="flex">
        {days.map((day) => {
          const weekend = isWeekend(day);
          const todayCol = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`flex flex-col items-center justify-center border-r border-slate-100/60 py-2 ${
                weekend ? "bg-slate-50/80" : ""
              } ${todayCol ? "bg-blue-50/60" : ""}`}
              style={{ width: dayWidth, minWidth: dayWidth }}
            >
              <span className={`text-[10px] font-medium ${todayCol ? "text-blue-600" : "text-slate-400"}`}>
                {format(day, "EEE")}
              </span>
              <span className={`text-xs font-semibold ${todayCol ? "text-blue-700" : "text-slate-600"}`}>
                {format(day, "d")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
