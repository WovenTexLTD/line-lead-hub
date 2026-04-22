import { useMemo } from "react";
import { eachDayOfInterval, isToday, isWeekend, differenceInDays, parseISO } from "date-fns";
import { ScheduleBarSegment } from "./ScheduleBarSegment";
import { computeSegments } from "./lane-layout";
import type { ViewMode } from "@/hooks/useTimelineState";
import type { FactoryLine, ScheduleWithDetails } from "@/hooks/useProductionSchedule";
import type { RowSize } from "@/pages/Schedule";

// Base lane height per row size
const LANE_HEIGHTS: Record<RowSize, number> = {
  compact: 30,
  default: 40,
  expanded: 48,
};

const LANE_GAP = 3; // px between stacked lanes
const ROW_PADDING = 6; // px top/bottom padding inside the row

interface Props {
  line: FactoryLine;
  schedules: ScheduleWithDetails[];
  visibleRange: { start: Date; end: Date };
  viewMode: ViewMode;
  dayWidth: number;
  rowSize: RowSize;
  onBarClick: (schedule: ScheduleWithDetails) => void;
  isEven: boolean;
}

export function TimelineRow({ line, schedules, visibleRange, viewMode, dayWidth, rowSize, onBarClick, isEven }: Props) {
  const days = eachDayOfInterval(visibleRange);
  const isEmpty = schedules.length === 0;
  const activeSchedules = schedules.filter((s) => s.status !== "completed");

  // Compute segmented lane layout
  const segments = useMemo(
    () => computeSegments(schedules, visibleRange.start, visibleRange.end),
    [schedules, visibleRange.start, visibleRange.end]
  );

  // Max concurrent lanes determines row height
  const maxLanes = useMemo(() => {
    let max = 0;
    for (const seg of segments) {
      if (seg.totalLanes > max) max = seg.totalLanes;
    }
    return Math.max(max, 1);
  }, [segments]);

  const baseLaneHeight = LANE_HEIGHTS[rowSize];
  // When there's only 1 lane, use generous height. When stacked, compress lanes.
  const laneHeight = maxLanes === 1 ? baseLaneHeight : Math.max(Math.floor(baseLaneHeight * 0.75), 24);
  const rowHeight = ROW_PADDING * 2 + maxLanes * laneHeight + (maxLanes - 1) * LANE_GAP;

  // Detect risk state for the row
  const hasRisk = useMemo(() =>
    activeSchedules.some((s) => {
      if (!s.workOrder.planned_ex_factory) return false;
      return parseISO(s.end_date) > parseISO(s.workOrder.planned_ex_factory);
    }),
  [activeSchedules]);

  // Today column index for marker
  const todayIndex = useMemo(() => {
    const todayOffset = differenceInDays(new Date(), visibleRange.start);
    return todayOffset >= 0 && todayOffset < days.length ? todayOffset : -1;
  }, [visibleRange.start, days.length]);

  return (
    <div
      className={`flex group/row transition-colors duration-100
        ${isEven ? "bg-white" : "bg-slate-25"}
        ${hasRisk ? "bg-red-50/20" : ""}
        ${isEmpty ? "" : "hover:bg-blue-50/20"}
      `}
      style={{ height: rowHeight }}
    >
      {/* Fixed line label column */}
      <div className={`w-[176px] shrink-0 border-r-2 border-slate-200 px-5 flex items-center gap-3
        ${isEmpty ? "bg-slate-50/60" : "bg-slate-50/80"}
      `}>
        <div className="flex flex-col min-w-0">
          <span className={`text-[13px] font-bold tracking-tight ${isEmpty ? "text-slate-400" : "text-slate-800"}`}>
            {line.line_id}
          </span>
          {line.name && rowSize !== "compact" && (
            <span className="text-[10px] text-slate-400 truncate leading-tight">{line.name}</span>
          )}
        </div>
        {hasRisk && (
          <div className="w-2 h-2 rounded-full bg-red-400 shrink-0 animate-pulse" title="Ex-factory risk" />
        )}
        {maxLanes > 1 && (
          <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 rounded px-1 py-0.5">{maxLanes}</span>
        )}
      </div>

      {/* Grid area */}
      <div className="relative flex-1 border-b border-slate-100">
        {/* Day column grid */}
        <div className="flex h-full">
          {days.map((day, i) => {
            const weekend = isWeekend(day);
            const isMonday = day.getDay() === 1;
            const todayCol = i === todayIndex;
            return (
              <div
                key={day.toISOString()}
                className={`h-full
                  ${isMonday && i > 0 ? "border-l border-slate-200/80" : "border-l border-slate-100/70"}
                  ${weekend ? "bg-slate-50/60" : ""}
                  ${todayCol ? "bg-blue-50/50" : ""}
                `}
                style={{ width: dayWidth, minWidth: dayWidth }}
              />
            );
          })}
        </div>

        {/* Idle line indicator */}
        {isEmpty && (
          <div className="absolute inset-0 flex items-center pointer-events-none px-4">
            <div className="w-full border-t border-dashed border-slate-200/50" />
          </div>
        )}

        {/* Today vertical marker */}
        {todayIndex >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-blue-500/60 pointer-events-none z-10"
            style={{ left: todayIndex * dayWidth + dayWidth / 2 }}
          >
            <div className="absolute inset-0 w-[6px] -ml-[2px] bg-blue-400/10 blur-[2px]" />
          </div>
        )}

        {/* Schedule bar segments */}
        {segments.map((seg, i) => (
          <ScheduleBarSegment
            key={`${seg.scheduleId}-${seg.startDay}`}
            segment={seg}
            dayWidth={dayWidth}
            rowPadding={ROW_PADDING}
            laneHeight={laneHeight}
            laneGap={LANE_GAP}
            onClick={() => onBarClick(seg.schedule)}
          />
        ))}
      </div>
    </div>
  );
}
