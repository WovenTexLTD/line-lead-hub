import { Download } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { LinePerformanceData, TimeRange } from "./types";

interface LineExportButtonProps {
  lines: LinePerformanceData[];
  timeRange: TimeRange;
  dateLabel: string;
}

export function LineExportButton({ lines, timeRange, dateLabel }: LineExportButtonProps) {
  function handleExport() {
    try {
      const totalTarget = lines.reduce((s, l) => s + l.totalTarget, 0);
      const totalOutput = lines.reduce((s, l) => s + l.totalOutput, 0);
      const overallAchievement = totalTarget > 0 ? Math.round((totalOutput / totalTarget) * 100) : 0;
      const linesOnTarget = lines.filter((l) => l.achievementPct >= 100).length;
      const activeLines = lines.filter((l) => l.isActive).length;
      const totalBlockers = lines.reduce((s, l) => s + l.totalBlockers, 0);
      const avgManpower = lines.length > 0 ? Math.round(lines.reduce((s, l) => s + l.avgManpower, 0) / lines.length) : 0;

      // Best & worst performing
      const activeLinesWithTarget = lines.filter((l) => l.isActive && l.totalTarget > 0);
      const sorted = [...activeLinesWithTarget].sort((a, b) => b.achievementPct - a.achievementPct);
      const bestLine = sorted[0];
      const worstLine = sorted[sorted.length - 1];

      const escape = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`;

      const summaryRows = [
        [`LINE PERFORMANCE REPORT`],
        [`Period: ${dateLabel}`],
        [`Exported: ${format(new Date(), "PPpp")}`],
        [],
        ["FACTORY SUMMARY"],
        ["Metric", "Value"],
        ["Total Lines", String(lines.length)],
        ["Active Lines", String(activeLines)],
        ["Total Target (pcs)", totalTarget.toLocaleString()],
        ["Total Output (pcs)", totalOutput.toLocaleString()],
        ["Overall Achievement", `${overallAchievement}%`],
        ["Lines On Target", `${linesOnTarget} of ${lines.length}`],
        ["Lines Below Target", `${lines.length - linesOnTarget} of ${lines.length}`],
        ["Total Blockers", String(totalBlockers)],
        ["Avg Manpower / Line", String(avgManpower)],
        ...(bestLine ? [["Best Performing Line", `${bestLine.name || bestLine.lineId} (${bestLine.achievementPct}%)`]] : []),
        ...(worstLine && worstLine !== bestLine ? [["Lowest Performing Line", `${worstLine.name || worstLine.lineId} (${worstLine.achievementPct}%)`]] : []),
        [],
        ["LINE DETAIL"],
      ];

      const headers = [
        "Line", "Unit", "Floor", "Status",
        "PO Number", "Buyer", "Style", "Item",
        "Target (pcs)", "Output (pcs)", "Achievement %", "Variance",
        "Avg Manpower", "Blockers",
        "Target Submitted", "EOD Submitted",
      ];

      const rows: string[][] = [];

      lines.forEach((line) => {
        const status = !line.isActive
          ? "Inactive"
          : line.anomaly === "no-output"
            ? "⚠ No Output"
            : line.anomaly === "critically-low"
              ? "⚠ Critical"
              : line.achievementPct >= 100
                ? "✓ On Target"
                : "Below Target";

        if (line.poBreakdown.length === 0) {
          rows.push([
            line.name || line.lineId, line.unitName || "", line.floorName || "",
            status,
            "", "", "", "",
            line.totalTarget.toLocaleString(), line.totalOutput.toLocaleString(),
            line.totalTarget > 0 ? `${line.achievementPct}%` : "N/A",
            String(line.variance),
            String(line.avgManpower), String(line.totalBlockers),
            line.targetSubmitted ? "Yes" : "No", line.eodSubmitted ? "Yes" : "No",
          ]);
        } else {
          line.poBreakdown.forEach((po, idx) => {
            rows.push([
              idx === 0 ? (line.name || line.lineId) : "",
              idx === 0 ? (line.unitName || "") : "",
              idx === 0 ? (line.floorName || "") : "",
              idx === 0 ? status : "",
              po.poNumber, po.buyer, po.style, po.item || "",
              po.target.toLocaleString(), po.output.toLocaleString(),
              po.target > 0 ? `${po.achievementPct}%` : "N/A",
              String(po.output - po.target),
              idx === 0 ? String(line.avgManpower) : "",
              idx === 0 ? String(line.totalBlockers) : "",
              idx === 0 ? (line.targetSubmitted ? "Yes" : "No") : "",
              idx === 0 ? (line.eodSubmitted ? "Yes" : "No") : "",
            ]);
          });
        }
      });

      const csvContent = [
        ...summaryRows.map((row) => row.map(escape).join(",")),
        headers.map(escape).join(","),
        ...rows.map((row) => row.map(escape).join(",")),
      ].join("\n");

      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const rangeLabel = timeRange === "daily" ? "daily" : `${timeRange}d`;
      link.download = `line_performance_${rangeLabel}_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("CSV exported");
    } catch {
      toast.error("Export failed");
    }
  }

  return (
    <Button variant="default" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4 mr-1" />
      Export CSV
    </Button>
  );
}
