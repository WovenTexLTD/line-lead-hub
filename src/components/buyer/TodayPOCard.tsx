import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveDot } from "@/components/ui/live-dot";
import { ChevronDown, ChevronUp } from "lucide-react";
import { computeHealth, healthColors, POAggregates } from "@/lib/buyer-health";
import { formatTimeInTimezone } from "@/lib/date-utils";
import { BuyerWorkOrder } from "@/hooks/useBuyerPOAccess";

interface DeptEntry {
  department: string;
  label: string;
  time: string | null;
}

interface TodayPOCardProps {
  wo: BuyerWorkOrder;
  aggregates: POAggregates;
  timeline: DeptEntry[];
  timezone: string;
  lastSubmittedAt?: string | null;
}

export function TodayPOCard({ wo, aggregates, timeline, timezone, lastSubmittedAt }: TodayPOCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const health = computeHealth(wo, aggregates);

  // Compute compact summary per department — use timeline for storage since aggregates don't track it
  const hasStorageEntries = timeline.some(e => e.department === "storage");
  const storageSummary = hasStorageEntries ? `Storage: ${timeline.filter(e => e.department === "storage").length} txn` : null;
  const cuttingSummary = aggregates.cuttingTotal > 0 ? `Cutting: ${aggregates.cuttingTotal.toLocaleString()}` : null;
  const sewingSummary = aggregates.sewingOutput > 0 ? `Sewing: ${aggregates.sewingOutput.toLocaleString()} good` : null;
  const finishingSummary = aggregates.finishingCarton > 0 ? `Finishing: ${aggregates.finishingCarton.toLocaleString()} packed` : null;

  const summaryParts = [storageSummary, cuttingSummary, sewingSummary, finishingSummary].filter(Boolean);

  const DEPT_COLORS: Record<string, string> = {
    sewing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    cutting: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    finishing: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    storage: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <button
              onClick={() => navigate(`/buyer/po/${wo.id}`)}
              className="text-sm font-semibold hover:underline text-primary"
            >
              {wo.po_number}
            </button>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${healthColors[health.status]}`}>
              {health.label}
            </Badge>
            <LiveDot lastUpdate={lastSubmittedAt ?? null} />
            <span className="text-xs text-muted-foreground truncate">
              {wo.style}{wo.color ? ` — ${wo.color}` : ""}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Compact summary */}
        {summaryParts.length > 0 ? (
          <div className="text-xs text-muted-foreground">
            {summaryParts.join(" | ")}
          </div>
        ) : (
          <div className="text-xs text-amber-600 dark:text-amber-400">
            No submissions today
          </div>
        )}

        {/* Expanded timeline */}
        {expanded && timeline.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {timeline.map((entry, i) => (
              <div key={i} className="flex items-start gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 ${DEPT_COLORS[entry.department] || ""}`}
                >
                  {entry.department}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-xs">{entry.label}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {entry.time ? formatTimeInTimezone(entry.time, timezone) : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {expanded && timeline.length === 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground text-center py-2">No detailed entries</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
