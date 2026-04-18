import { TimelineHeader } from "./TimelineHeader";
import { TimelineRow } from "./TimelineRow";
import type { ViewMode } from "@/hooks/useTimelineState";
import type { FactoryLine, ScheduleWithDetails } from "@/hooks/useProductionSchedule";

interface Props {
  lines: FactoryLine[];
  schedulesByLine: Map<string, ScheduleWithDetails[]>;
  visibleRange: { start: Date; end: Date };
  viewMode: ViewMode;
  onBarClick: (schedule: ScheduleWithDetails) => void;
}

export function TimelinePlanner({ lines, schedulesByLine, visibleRange, viewMode, onBarClick }: Props) {
  const dayWidth = viewMode === "week" ? 120 : 40;

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <div style={{ minWidth: viewMode === "week" ? "auto" : 1200 }}>
          <TimelineHeader visibleRange={visibleRange} viewMode={viewMode} dayWidth={dayWidth} />
          {lines.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-slate-400">
              No active lines found
            </div>
          ) : (
            lines.map((line, i) => (
              <TimelineRow
                key={line.id}
                line={line}
                schedules={schedulesByLine.get(line.id) ?? []}
                visibleRange={visibleRange}
                viewMode={viewMode}
                dayWidth={dayWidth}
                onBarClick={onBarClick}
                isEven={i % 2 === 0}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
