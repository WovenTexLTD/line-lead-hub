import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, Search } from "lucide-react";
import { format } from "date-fns";
import type { ViewMode } from "@/hooks/useTimelineState";
import type { FactoryLine } from "@/hooks/useProductionSchedule";

interface Props {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onJumpToToday: () => void;
  visibleRange: { start: Date; end: Date };
  lines: FactoryLine[];
  buyers: string[];
  selectedLine: string;
  onLineChange: (value: string) => void;
  selectedBuyer: string;
  onBuyerChange: (value: string) => void;
  riskOnly: boolean;
  onRiskOnlyChange: (value: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function ScheduleControls({
  viewMode, onViewModeChange, onNavigateBack, onNavigateForward, onJumpToToday,
  visibleRange, lines, buyers, selectedLine, onLineChange, selectedBuyer, onBuyerChange,
  riskOnly, onRiskOnlyChange, search, onSearchChange,
}: Props) {
  const rangeLabel = viewMode === "week"
    ? `${format(visibleRange.start, "d MMM")} – ${format(visibleRange.end, "d MMM yyyy")}`
    : format(visibleRange.start, "MMMM yyyy");

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
          <Button
            variant={viewMode === "week" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs rounded-md"
            onClick={() => onViewModeChange("week")}
          >
            Week
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs rounded-md"
            onClick={() => onViewModeChange("month")}
          >
            Month
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={onNavigateBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-slate-700 min-w-[160px] text-center">{rangeLabel}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={onNavigateForward}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={onJumpToToday}>
          <CalendarDays className="h-3.5 w-3.5 mr-1" />
          Today
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search PO..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-7 w-[140px] pl-8 text-xs"
          />
        </div>

        <Select value={selectedLine} onValueChange={onLineChange}>
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue placeholder="All Lines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lines</SelectItem>
            {lines.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.line_id}{l.name ? ` – ${l.name}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedBuyer} onValueChange={onBuyerChange}>
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue placeholder="All Buyers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buyers</SelectItem>
            {buyers.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={riskOnly ? "default" : "outline"}
          size="sm"
          className="h-7 px-3 text-xs"
          aria-pressed={riskOnly}
          onClick={() => onRiskOnlyChange(!riskOnly)}
        >
          Risks Only
        </Button>
      </div>
    </div>
  );
}
