import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { formatShortDate } from "@/lib/date-utils";
import type { POPipelineStage } from "./types";

interface Props {
  stages: POPipelineStage[];
}

function statusColor(pct: number) {
  if (pct >= 80) return "bg-success";
  if (pct >= 40) return "bg-warning";
  if (pct > 0) return "bg-primary";
  return "bg-muted-foreground/20";
}

function dotColor(pct: number) {
  if (pct >= 80) return "bg-success";
  if (pct >= 40) return "bg-warning";
  if (pct > 0) return "bg-primary";
  return "bg-muted-foreground/30";
}

export function POPipelineTab({ stages }: Props) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-1">
      {stages.map((stage, i) => (
        <div key={stage.stage} className="flex items-center gap-1 flex-1">
          {/* Stage card */}
          <div className="flex-1 p-3 rounded-lg border bg-card min-w-[100px]">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn("h-2 w-2 rounded-full shrink-0", dotColor(stage.pct))}
              />
              <span className="text-xs font-medium">{stage.label}</span>
            </div>
            {/* Bar */}
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  statusColor(stage.pct)
                )}
                style={{ width: `${Math.min(stage.pct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span className="font-mono">{stage.qty.toLocaleString()}</span>
              <span className="font-mono">{stage.pct}%</span>
            </div>
            {stage.lastDate && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatShortDate(stage.lastDate)}
              </p>
            )}
          </div>
          {/* Arrow between stages */}
          {i < stages.length - 1 && (
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 hidden sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}
