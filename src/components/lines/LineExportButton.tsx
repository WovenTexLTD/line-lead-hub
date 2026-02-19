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
      const headers = [
        "Line", "Unit", "Floor", "PO Number", "Buyer", "Style",
        "Target", "Output", "Achievement %", "Variance",
      ];

      const rows: string[][] = [];

      lines.forEach((line) => {
        if (line.poBreakdown.length === 0) {
          rows.push([
            line.name || line.lineId, line.unitName || "", line.floorName || "",
            "", "", "",
            String(line.totalTarget), String(line.totalOutput),
            line.totalTarget > 0 ? `${line.achievementPct}` : "",
            String(line.variance),
          ]);
        } else {
          line.poBreakdown.forEach((po) => {
            rows.push([
              line.name || line.lineId, line.unitName || "", line.floorName || "",
              po.poNumber, po.buyer, po.style,
              String(po.target), String(po.output),
              po.target > 0 ? `${po.achievementPct}` : "",
              String(po.output - po.target),
            ]);
          });
        }
      });

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ),
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
