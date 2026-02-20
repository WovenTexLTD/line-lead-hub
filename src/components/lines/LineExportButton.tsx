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
      // Summary section
      const totalTarget = lines.reduce((s, l) => s + l.totalTarget, 0);
      const totalOutput = lines.reduce((s, l) => s + l.totalOutput, 0);
      const overallAchievement = totalTarget > 0 ? Math.round((totalOutput / totalTarget) * 100) : 0;
      const linesOnTarget = lines.filter((l) => l.achievementPct >= 100).length;
      const activeLines = lines.filter((l) => l.isActive).length;

      const summaryRows = [
        [`Line Performance Report — ${dateLabel}`],
        [`Exported: ${format(new Date(), "PPpp")}`],
        [],
        ["Summary"],
        ["Total Lines", String(lines.length), "Active Lines", String(activeLines)],
        ["Total Target", String(totalTarget), "Total Output", String(totalOutput)],
        ["Overall Achievement", `${overallAchievement}%`, "Lines On Target", `${linesOnTarget} / ${lines.length}`],
        [],
      ];

      const headers = [
        "Line", "Unit", "Floor", "PO Number", "Buyer", "Style", "Item",
        "Target", "Output", "Achievement %", "Variance",
        "Avg Manpower", "Blockers", "Target Submitted", "EOD Submitted", "Status",
      ];

      const rows: string[][] = [];

      lines.forEach((line) => {
        const status = !line.isActive ? "Inactive" : line.anomaly === "no-output" ? "No Output" : line.anomaly === "critically-low" ? "Critical" : line.achievementPct >= 100 ? "On Target" : "Below Target";

        if (line.poBreakdown.length === 0) {
          rows.push([
            line.name || line.lineId, line.unitName || "", line.floorName || "",
            "", "", "", "",
            String(line.totalTarget), String(line.totalOutput),
            line.totalTarget > 0 ? `${line.achievementPct}%` : "N/A",
            String(line.variance),
            String(line.avgManpower), String(line.totalBlockers),
            line.targetSubmitted ? "Yes" : "No", line.eodSubmitted ? "Yes" : "No",
            status,
          ]);
        } else {
          line.poBreakdown.forEach((po, idx) => {
            rows.push([
              line.name || line.lineId, line.unitName || "", line.floorName || "",
              po.poNumber, po.buyer, po.style, po.item || "",
              String(po.target), String(po.output),
              po.target > 0 ? `${po.achievementPct}%` : "N/A",
              String(po.output - po.target),
              idx === 0 ? String(line.avgManpower) : "",
              idx === 0 ? String(line.totalBlockers) : "",
              idx === 0 ? (line.targetSubmitted ? "Yes" : "No") : "",
              idx === 0 ? (line.eodSubmitted ? "Yes" : "No") : "",
              idx === 0 ? status : "",
            ]);
          });
        }
      });

      const escape = (cell: string) => `"${String(cell).replace(/"/g, '""')}"`;

      const csvContent = [
        ...summaryRows.map((row) => row.map(escape).join(",")),
        headers.map(escape).join(","),
        ...rows.map((row) => row.map(escape).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
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
