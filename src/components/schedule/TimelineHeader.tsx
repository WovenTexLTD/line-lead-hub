import { useMemo } from "react";
import { eachDayOfInterval, format, isToday, isWeekend, isSameMonth } from "date-fns";
import type { ViewMode } from "@/hooks/useTimelineState";

interface Props {
  visibleRange: { start: Date; end: Date };
  viewMode: ViewMode;
  dayWidth: number;
}

interface MonthSpan {
  label: string;
  colSpan: number;
}

export function TimelineHeader({ visibleRange, viewMode, dayWidth }: Props) {
  const days = eachDayOfInterval(visibleRange);
  const isMonth = viewMode === "month";

  // Group consecutive days by month for the top label row
  const monthSpans: MonthSpan[] = useMemo(() => {
    const spans: MonthSpan[] = [];
    let current: MonthSpan | null = null;
    for (const day of days) {
      const label = format(day, "MMMM yyyy");
      if (!current || current.label !== label) {
        current = { label, colSpan: 1 };
        spans.push(current);
      } else {
        current.colSpan++;
      }
    }
    return spans;
  }, [days]);

  return (
    <div className="sticky top-0 z-20 bg-white">
      {/* Month label row */}
      <div className="flex border-b border-slate-100">
        <div className="w-[148px] shrink-0 border-r border-slate-200 bg-slate-50 sticky left-0 z-30" />
        <div className="flex">
          {monthSpans.map((span, i) => (
            <div
              key={`${span.label}-${i}`}
              className={`flex items-center px-3 py-1.5 ${i > 0 ? "border-l border-slate-200" : ""}`}
              style={{ width: span.colSpan * dayWidth }}
            >
              <span className="text-[11px] font-bold text-slate-700 tracking-tight">{span.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day columns row */}
      <div className="flex border-b border-slate-200">
        <div className="w-[148px] shrink-0 border-r border-slate-200 px-3 py-2 flex items-end bg-slate-50 sticky left-0 z-30">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Line</span>
        </div>
        <div className="flex">
          {days.map((day, i) => {
            const weekend = isWeekend(day);
            const todayCol = isToday(day);
            const isFirstOfMonth = day.getDate() === 1 && i > 0;
            const isMonday = day.getDay() === 1;
            return (
              <div
                key={day.toISOString()}
                className={`flex flex-col items-center justify-center py-1.5
                  ${isFirstOfMonth ? "border-l-2 border-slate-300" : isMonday && i > 0 ? "border-l border-slate-200" : i > 0 ? "border-l border-slate-100" : ""}
                  ${weekend ? "bg-slate-50/60" : "bg-slate-50/30"}
                  ${todayCol ? "bg-blue-50/70" : ""}
                `}
                style={{ width: dayWidth, minWidth: dayWidth }}
              >
                <span className={`text-[9px] font-medium uppercase tracking-wider leading-none
                  ${todayCol ? "text-blue-600" : weekend ? "text-slate-300" : "text-slate-400"}
                `}>
                  {isMonth ? format(day, "EEEEE") : format(day, "EEE")}
                </span>
                <div className="relative mt-1 w-6 h-6 flex items-center justify-center">
                  {todayCol && (
                    <div className="absolute inset-0 rounded-full bg-blue-600 shadow-sm shadow-blue-600/30" />
                  )}
                  <span className={`relative ${isMonth ? "text-[10px]" : "text-[12px]"} font-bold tabular-nums leading-none
                    ${todayCol ? "text-white" : weekend ? "text-slate-400" : "text-slate-700"}
                  `}>
                    {format(day, "d")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
