import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronRight,
  Clock,
  Archive,
  TrendingUp,
  PackageCheck,
} from "lucide-react";
import { healthColors, type HealthStatus, type POAggregates } from "@/lib/buyer-health";
import { BuyerWorkOrder } from "@/hooks/useBuyerPOAccess";
import { formatShortDate } from "@/lib/date-utils";

interface CompactPOCardProps {
  wo: BuyerWorkOrder;
  agg: POAggregates;
  health: { status: HealthStatus; label: string };
  todaySewing: number;
  todayFinishing: number;
  yesterdaySewing?: number;
  yesterdayFinishing?: number;
  onClick: () => void;
}

function DeltaChip({ current, yesterday }: { current: number; yesterday?: number }) {
  if (yesterday === undefined || yesterday === 0) return null;
  const delta = current - yesterday;
  if (delta === 0) return null;

  return (
    <span
      className={`text-[10px] font-medium ml-1.5 ${
        delta > 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {delta > 0 ? "+" : ""}
      {delta.toLocaleString()}
    </span>
  );
}

export function CompactPOCard({
  wo,
  agg,
  health,
  todaySewing,
  todayFinishing,
  yesterdaySewing,
  yesterdayFinishing,
  onClick,
}: CompactPOCardProps) {
  const sewPct =
    wo.order_qty > 0
      ? Math.min(100, Math.round((agg.cumulativeGood / wo.order_qty) * 100))
      : 0;
  const balance = Math.max(0, wo.order_qty - agg.cumulativeGood);

  return (
    <Card
      className="group cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-border/60 hover:border-primary/30"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <CardContent className="p-5 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-primary group-hover:underline">
                {wo.po_number}
              </h3>
              <Badge
                variant="outline"
                className={`text-xs px-2 py-0.5 shrink-0 ${healthColors[health.status]}`}
              >
                {health.label}
              </Badge>
              {wo.status && (
                <Badge variant="secondary" className="text-xs">
                  {wo.status.replace("_", " ")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {wo.style}
              {wo.color && ` — ${wo.color}`}
              {wo.item && ` — ${wo.item}`}
            </p>
          </div>
          <div className="text-right text-sm shrink-0">
            <div className="font-medium">
              {wo.order_qty.toLocaleString()} pcs
            </div>
            {wo.planned_ex_factory && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                <Clock className="h-3 w-3" />
                {formatShortDate(wo.planned_ex_factory)}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Sewing Progress</span>
            <span className="font-medium">
              {agg.cumulativeGood.toLocaleString()} / {wo.order_qty.toLocaleString()} ({sewPct}%)
            </span>
          </div>
          <Progress value={sewPct} className="h-2.5" />
          <div className="text-xs text-muted-foreground mt-1">
            Balance: {balance.toLocaleString()} pcs remaining
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" /> Sewn Today
            </div>
            <div className="text-base font-semibold">
              {todaySewing.toLocaleString()}
              <DeltaChip current={todaySewing} yesterday={yesterdaySewing} />
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <PackageCheck className="h-3 w-3" /> Packed Today
            </div>
            <div className="text-base font-semibold">
              {todayFinishing.toLocaleString()}
              <DeltaChip current={todayFinishing} yesterday={yesterdayFinishing} />
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Archive className="h-3 w-3" /> Total Packed
            </div>
            <div className="text-base font-semibold">
              {agg.finishingCarton.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Clickable hint */}
        <div className="flex items-center justify-end text-sm text-muted-foreground group-hover:text-primary transition-colors">
          <span>View details</span>
          <ChevronRight className="h-4 w-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </CardContent>
    </Card>
  );
}
