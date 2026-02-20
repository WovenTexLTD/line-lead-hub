import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { POQualityData } from "./types";

interface Props {
  quality: POQualityData;
  orderQty: number;
}

function StatCard({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "destructive" | "warning" | "success" | "default";
}) {
  const colorClass =
    variant === "destructive"
      ? "text-destructive"
      : variant === "warning"
        ? "text-warning"
        : variant === "success"
          ? "text-success"
          : "";

  return (
    <div className="p-3 rounded-lg border bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold font-mono ${colorClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function POQualityTab({ quality, orderQty }: Props) {
  const progressPct =
    orderQty > 0
      ? Math.min((quality.totalOutput / orderQty) * 100, 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Sewing Output</span>
          <span className="font-mono">
            {quality.totalOutput.toLocaleString()} / {orderQty.toLocaleString()}
          </span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Rejects"
          value={quality.totalRejects.toLocaleString()}
          sub={`${quality.rejectRate.toFixed(1)}% rate`}
          variant={quality.rejectRate > 3 ? "destructive" : "default"}
        />
        <StatCard
          label="Rework"
          value={quality.totalRework.toLocaleString()}
          sub={`${quality.reworkRate.toFixed(1)}% rate`}
          variant={quality.reworkRate > 5 ? "warning" : "default"}
        />
        <StatCard
          label="Extras"
          value={quality.extrasTotal.toLocaleString()}
          sub={
            quality.extrasConsumed > 0
              ? `${quality.extrasAvailable.toLocaleString()} available`
              : undefined
          }
          variant={quality.extrasTotal > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Available Extras"
          value={quality.extrasAvailable.toLocaleString()}
          variant={quality.extrasAvailable > 0 ? "success" : "default"}
        />
      </div>
    </div>
  );
}
