import { useState, useMemo } from "react";
import { format } from "date-fns";
import { SewingMachine } from "@/components/icons/SewingMachine";
import { useLinePerformance } from "@/components/lines/useLinePerformance";
import { LinePerformanceControls } from "@/components/lines/LinePerformanceControls";
import { LinePerformanceSummary } from "@/components/lines/LinePerformanceSummary";
import { LinePerformanceCards } from "@/components/lines/LinePerformanceCards";
import { LineDrilldownDrawer } from "@/components/lines/LineDrilldownDrawer";
import { LineExportButton } from "@/components/lines/LineExportButton";

export default function Lines() {
  const {
    loading,
    selectedDate,
    setSelectedDate,
    timeRange,
    setTimeRange,
    filters,
    setFilters,
    filteredLines,
    trendData,
    units,
    floors,
    factorySummary,
    refetch,
    dateRange,
  } = useLinePerformance();

  const [drawerLineId, setDrawerLineId] = useState<string | null>(null);

  const drawerLine = useMemo(
    () => (drawerLineId ? filteredLines.find((l) => l.id === drawerLineId) ?? null : null),
    [drawerLineId, filteredLines]
  );

  const drawerTrend = useMemo(
    () => (drawerLineId ? trendData.get(drawerLineId) ?? null : null),
    [drawerLineId, trendData]
  );

  const dateLabel = useMemo(() => {
    if (timeRange === "daily") return format(selectedDate, "MMM d, yyyy");
    return `Last ${timeRange} days`;
  }, [timeRange, selectedDate]);

  return (
    <div className="py-4 lg:py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SewingMachine className="h-6 w-6 text-primary" />
            Line Performance
          </h1>
          <p className="text-muted-foreground">
            Track sewing line output, targets, and PO contribution
          </p>
        </div>
        <LineExportButton lines={filteredLines} timeRange={timeRange} dateLabel={dateLabel} />
      </div>

      {/* Controls bar */}
      <LinePerformanceControls
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        filters={filters}
        onFiltersChange={setFilters}
        units={units}
        floors={floors}
        onRefresh={refetch}
      />

      {/* Summary KPIs */}
      <LinePerformanceSummary
        summary={factorySummary}
        activeLineCount={filteredLines.length}
      />

      {/* Line rows */}
      <LinePerformanceCards
        lines={filteredLines}
        loading={loading}
        onLineClick={(id) => setDrawerLineId(id)}
      />

      {/* Drilldown dialog */}
      <LineDrilldownDrawer
        line={drawerLine}
        trendData={drawerTrend}
        timeRange={timeRange}
        dateLabel={dateLabel}
        dateRange={dateRange}
        open={!!drawerLineId}
        onClose={() => setDrawerLineId(null)}
      />
    </div>
  );
}
