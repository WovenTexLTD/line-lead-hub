import { eachDayOfInterval, isToday, isWeekend } from "date-fns";
import { ScheduleBar } from "./ScheduleBar";
import type { ViewMode } from "@/hooks/useTimelineState";
import type { FactoryLine, ScheduleWithDetails } from "@/hooks/useProductionSchedule";

interface Props {
  line: FactoryLine;
  schedules: ScheduleWithDetails[];
  visibleRange: { start: Date; end: Date };
  viewMode: ViewMode;
  dayWidth: number;
  onBarClick: (schedule: ScheduleWithDetails) => void;
  isEven: boolean;
}

export function TimelineRow({ line, schedules, visibleRange, viewMode, dayWidth, onBarClick, isEven }: Props) {
  const days = eachDayOfInterval(visibleRange);
  const isEmpty = schedules.length === 0;

  return (
    <div className={`flex border-b border-slate-100 ${isEven ? "bg-white" : "bg-slate-50/30"}`} style={{ height: 68 }}>
      <div className="w-[168px] shrink-0 border-r border-slate-200 bg-slate-50/50 px-4 flex flex-col justify-center">
        <span className="text-sm font-semibold text-slate-800">{line.line_id}</span>
        {line.name && <span className="text-[10px] text-slate-400 truncate">{line.name}</span>}
      </div>

      <div className="relative flex-1">
        <div className="flex h-full">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`border-r border-slate-100/60 h-full ${
                isWeekend(day) ? "bg-slate-50/80" : ""
              } ${isToday(day) ? "bg-blue-50/40" : ""}`}
              style={{ width: dayWidth, minWidth: dayWidth }}
            />
          ))}
        </div>

        {isEmpty && (
          <div className="absolute inset-0 flex items-center pointer-events-none">
            <div className="w-full mx-6 border-t border-dashed border-slate-200/60" />
          </div>
        )}

        {days.map((day) =>
          isToday(day) ? (
            <div
              key="today"
              className="absolute top-0 bottom-0 w-[2px] bg-blue-500/70 pointer-events-none z-10"
              style={{ left: days.indexOf(day) * dayWidth + dayWidth / 2 }}
            />
          ) : null
        )}

        {schedules.map((s) => (
          <ScheduleBar
            key={s.id}
            schedule={s}
            visibleStart={visibleRange.start}
            dayWidth={dayWidth}
            onClick={() => onBarClick(s)}
          />
        ))}
      </div>
    </div>
  );
}
