import { useMemo } from "react";
import { differenceInDays } from "date-fns";
import {
  Calendar,
  Package,
  Users,
  AlertTriangle,
  CheckCircle2,
  Layers,
  CalendarDays,
  Receipt,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { SewingMachine } from "@/components/icons/SewingMachine";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/date-utils";
import type { StyleOrderRollup, POControlRoomData } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleOrder: StyleOrderRollup | null;
  today: string; // YYYY-MM-DD
  onViewPO?: (poId: string) => void; // jump to that PO in PO Details view
}

// ── Status theme — mirrors the StyleOrderCard so dialog feels continuous ──
type DialogTheme = {
  headerBg: string;
  headerBorder: string;
  cornerTopRight: string;
  cornerBottomLeft: string;
  pillBg: string;
  pillText: string;
  pillBorder: string;
  pillDot: string;
  pillLabel: string;
  iconBg: string;
  iconShadow: string;
  numberText: string;
  accentText: string;
};

const THEMES: Record<string, DialogTheme> = {
  deadline_passed: {
    headerBg: "bg-gradient-to-br from-red-50 via-white to-rose-50/60 dark:from-red-950/40 dark:via-card dark:to-rose-950/20",
    headerBorder: "border-red-200/60 dark:border-red-800/40",
    cornerTopRight: "from-red-500/10",
    cornerBottomLeft: "from-red-500/5",
    pillBg: "bg-red-500/15",
    pillText: "text-red-700 dark:text-red-300",
    pillBorder: "border-red-400/30",
    pillDot: "bg-red-500",
    pillLabel: "Overdue",
    iconBg: "from-red-500 to-rose-600",
    iconShadow: "shadow-red-500/30",
    numberText: "text-red-900 dark:text-red-100",
    accentText: "text-red-700 dark:text-red-300",
  },
  at_risk: {
    headerBg: "bg-gradient-to-br from-amber-50 via-white to-orange-50/60 dark:from-amber-950/40 dark:via-card dark:to-orange-950/20",
    headerBorder: "border-amber-200/60 dark:border-amber-800/40",
    cornerTopRight: "from-amber-500/10",
    cornerBottomLeft: "from-amber-500/5",
    pillBg: "bg-amber-500/15",
    pillText: "text-amber-700 dark:text-amber-300",
    pillBorder: "border-amber-400/30",
    pillDot: "bg-amber-500",
    pillLabel: "At Risk",
    iconBg: "from-amber-500 to-orange-500",
    iconShadow: "shadow-amber-500/30",
    numberText: "text-amber-900 dark:text-amber-100",
    accentText: "text-amber-700 dark:text-amber-300",
  },
  watch: {
    headerBg: "bg-gradient-to-br from-yellow-50 via-white to-amber-50/60 dark:from-yellow-950/40 dark:via-card dark:to-amber-950/20",
    headerBorder: "border-yellow-200/60 dark:border-yellow-800/40",
    cornerTopRight: "from-yellow-500/10",
    cornerBottomLeft: "from-yellow-500/5",
    pillBg: "bg-yellow-500/15",
    pillText: "text-yellow-700 dark:text-yellow-300",
    pillBorder: "border-yellow-400/30",
    pillDot: "bg-yellow-500",
    pillLabel: "Watch",
    iconBg: "from-yellow-500 to-amber-500",
    iconShadow: "shadow-yellow-500/30",
    numberText: "text-yellow-900 dark:text-yellow-100",
    accentText: "text-yellow-700 dark:text-yellow-300",
  },
  healthy: {
    headerBg: "bg-gradient-to-br from-emerald-50 via-white to-green-50/60 dark:from-emerald-950/40 dark:via-card dark:to-green-950/20",
    headerBorder: "border-emerald-200/60 dark:border-emerald-800/40",
    cornerTopRight: "from-emerald-500/10",
    cornerBottomLeft: "from-emerald-500/5",
    pillBg: "bg-emerald-500/15",
    pillText: "text-emerald-700 dark:text-emerald-300",
    pillBorder: "border-emerald-400/30",
    pillDot: "bg-emerald-500",
    pillLabel: "On Track",
    iconBg: "from-emerald-500 to-green-600",
    iconShadow: "shadow-emerald-500/30",
    numberText: "text-emerald-900 dark:text-emerald-100",
    accentText: "text-emerald-700 dark:text-emerald-300",
  },
  no_deadline: {
    headerBg: "bg-gradient-to-br from-slate-50 via-white to-slate-50/60 dark:from-slate-950/40 dark:via-card dark:to-slate-950/20",
    headerBorder: "border-slate-200/60 dark:border-slate-800/40",
    cornerTopRight: "from-slate-500/10",
    cornerBottomLeft: "from-slate-500/5",
    pillBg: "bg-slate-500/15",
    pillText: "text-slate-700 dark:text-slate-300",
    pillBorder: "border-slate-400/30",
    pillDot: "bg-slate-500",
    pillLabel: "No Deadline",
    iconBg: "from-slate-500 to-slate-600",
    iconShadow: "shadow-slate-500/30",
    numberText: "text-slate-900 dark:text-slate-100",
    accentText: "text-slate-700 dark:text-slate-300",
  },
  completed: {
    headerBg: "bg-gradient-to-br from-emerald-50 via-white to-teal-50/60 dark:from-emerald-950/40 dark:via-card dark:to-teal-950/20",
    headerBorder: "border-emerald-200/60 dark:border-emerald-800/40",
    cornerTopRight: "from-emerald-500/10",
    cornerBottomLeft: "from-emerald-500/5",
    pillBg: "bg-emerald-500/15",
    pillText: "text-emerald-700 dark:text-emerald-300",
    pillBorder: "border-emerald-400/30",
    pillDot: "bg-emerald-500",
    pillLabel: "Done",
    iconBg: "from-emerald-500 to-teal-600",
    iconShadow: "shadow-emerald-500/30",
    numberText: "text-emerald-900 dark:text-emerald-100",
    accentText: "text-emerald-700 dark:text-emerald-300",
  },
};

const PO_STATUS: Record<string, { variant: "default" | "warning" | "destructive" | "success" | "secondary"; label: string; ringColor: string }> = {
  deadline_passed: { variant: "destructive", label: "Overdue", ringColor: "ring-red-500/30" },
  at_risk: { variant: "warning", label: "At Risk", ringColor: "ring-amber-500/30" },
  watch: { variant: "warning", label: "Watch", ringColor: "ring-yellow-500/30" },
  healthy: { variant: "success", label: "On Track", ringColor: "ring-emerald-500/20" },
  no_deadline: { variant: "secondary", label: "No Deadline", ringColor: "ring-border" },
  completed: { variant: "success", label: "Done", ringColor: "ring-emerald-500/20" },
};

export function StyleOrderDetailDrawer({ open, onOpenChange, styleOrder, today, onViewPO }: Props) {
  const daysToEx = useMemo(() => {
    if (!styleOrder?.earliestExFactory) return null;
    return differenceInDays(new Date(styleOrder.earliestExFactory), new Date(today));
  }, [styleOrder?.earliestExFactory, today]);

  if (!styleOrder) return null;

  const theme = THEMES[styleOrder.health.status] ?? THEMES.healthy;
  const sewingPct = styleOrder.totalQty > 0 ? Math.min((styleOrder.sewingOutput / styleOrder.totalQty) * 100, 100) : 0;
  const finishingPct = styleOrder.totalQty > 0 ? Math.min((styleOrder.finishedOutput / styleOrder.totalQty) * 100, 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[94vw] max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        {/* ── Themed header — gradient tint matches the card status ───── */}
        <DialogHeader
          className={cn(
            "px-6 pt-6 pb-5 border-b flex-shrink-0 space-y-0 relative overflow-hidden",
            theme.headerBg,
            theme.headerBorder
          )}
        >
          <div className={cn("absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl to-transparent rounded-bl-full pointer-events-none", theme.cornerTopRight)} />
          <div className={cn("absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr to-transparent rounded-tr-full pointer-events-none", theme.cornerBottomLeft)} />

          <div className="relative flex items-start justify-between gap-4 pr-6">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={cn(
                  "h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg shrink-0",
                  theme.iconBg,
                  theme.iconShadow
                )}
              >
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[11px] font-semibold uppercase tracking-wider", theme.accentText)}>
                    {styleOrder.id.startsWith("order:") ? "Order" : "Purchase Order"}
                  </span>
                  {styleOrder.needs_review && (
                    <Badge variant="warning" className="gap-1 text-[10px]">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Needs Review
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-2xl leading-tight tracking-tight font-bold truncate">
                  {styleOrder.id.startsWith("order:") ? styleOrder.style_name : styleOrder.buyer}
                </DialogTitle>
                <p className="text-sm text-muted-foreground truncate">
                  {styleOrder.id.startsWith("order:") ? styleOrder.buyer : styleOrder.style_name}
                </p>
              </div>
            </div>

            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-sm shrink-0",
                theme.pillBg,
                theme.pillText,
                theme.pillBorder
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", theme.pillDot)} />
              {theme.pillLabel}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b flex-shrink-0">
            <TabsList className="mx-6 my-0 justify-start gap-0 h-auto bg-transparent rounded-none p-0">
              {[
                { v: "overview", label: "Overview" },
                { v: "pos", label: "Purchase Orders" },
                { v: "production", label: "Production" },
                { v: "schedule", label: "Schedule" },
              ].map((t) => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* ─────────────── OVERVIEW ─────────────── */}
              <TabsContent value="overview" className="mt-0 space-y-5">
                {/* Hero KPI — Total Quantity */}
                <div className={cn("relative overflow-hidden rounded-xl border p-5", theme.headerBg, theme.headerBorder)}>
                  <div className={cn("absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl to-transparent rounded-bl-full pointer-events-none", theme.cornerTopRight)} />
                  <div className="relative flex items-end justify-between gap-4">
                    <div>
                      <p className={cn("text-[11px] font-semibold uppercase tracking-wider mb-2", theme.accentText)}>
                        Total Quantity
                      </p>
                      <p className={cn("text-4xl md:text-5xl font-bold font-mono tracking-tight leading-none", theme.numberText)}>
                        <AnimatedNumber value={styleOrder.totalQty} />
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        across <span className={cn("font-semibold", theme.accentText)}>{styleOrder.poCount}</span> {styleOrder.poCount === 1 ? "PO" : "POs"}
                        <span className="text-muted-foreground/40 mx-1.5">·</span>
                        <span className="font-medium text-foreground/80 tabular-nums">{styleOrder.remaining.toLocaleString()}</span> remaining
                      </p>
                    </div>
                  </div>
                </div>

                {/* KPI grid — Sewing, Finishing, Days to ex-factory */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KPICard
                    label="Sewing Output"
                    value={styleOrder.sewingOutput}
                    sub={`${Math.round(sewingPct)}% of order`}
                    Icon={SewingMachine}
                    bg="from-blue-50 via-white to-blue-50/50 dark:from-blue-950/40 dark:via-card dark:to-blue-950/20"
                    border="border-blue-200/60 dark:border-blue-800/40"
                    accent="text-blue-600/70 dark:text-blue-400/70"
                    valueText="text-blue-900 dark:text-blue-100"
                    iconBg="from-blue-500 to-blue-600"
                    iconShadow="shadow-blue-500/25"
                    corner="from-blue-500/10"
                  />
                  <KPICard
                    label="Finishing Output"
                    value={styleOrder.finishedOutput}
                    sub={`${Math.round(finishingPct)}% complete`}
                    Icon={Package}
                    bg="from-violet-50 via-white to-purple-50/50 dark:from-violet-950/40 dark:via-card dark:to-purple-950/20"
                    border="border-violet-200/60 dark:border-violet-800/40"
                    accent="text-violet-600/70 dark:text-violet-400/70"
                    valueText="text-violet-900 dark:text-violet-100"
                    iconBg="from-violet-500 to-purple-600"
                    iconShadow="shadow-violet-500/25"
                    corner="from-violet-500/10"
                  />
                  <KPICard
                    label="Ex-Factory"
                    value={styleOrder.earliestExFactory ? formatShortDate(styleOrder.earliestExFactory) : "—"}
                    sub={
                      daysToEx === null
                        ? "No deadline set"
                        : daysToEx < 0
                          ? `${Math.abs(daysToEx)} days overdue`
                          : daysToEx === 0
                            ? "Due today"
                            : `${daysToEx} days remaining`
                    }
                    Icon={Calendar}
                    bg={
                      daysToEx === null
                        ? "from-slate-50 via-white to-slate-50/50 dark:from-slate-950/40 dark:via-card dark:to-slate-950/20"
                        : daysToEx < 0
                          ? "from-red-50 via-white to-rose-50/50 dark:from-red-950/40 dark:via-card dark:to-rose-950/20"
                          : daysToEx <= 7
                            ? "from-amber-50 via-white to-orange-50/50 dark:from-amber-950/40 dark:via-card dark:to-orange-950/20"
                            : "from-emerald-50 via-white to-green-50/50 dark:from-emerald-950/40 dark:via-card dark:to-green-950/20"
                    }
                    border={
                      daysToEx === null
                        ? "border-slate-200/60 dark:border-slate-800/40"
                        : daysToEx < 0
                          ? "border-red-200/60 dark:border-red-800/40"
                          : daysToEx <= 7
                            ? "border-amber-200/60 dark:border-amber-800/40"
                            : "border-emerald-200/60 dark:border-emerald-800/40"
                    }
                    accent={
                      daysToEx === null
                        ? "text-slate-600/70 dark:text-slate-400/70"
                        : daysToEx < 0
                          ? "text-red-600/70 dark:text-red-400/70"
                          : daysToEx <= 7
                            ? "text-amber-600/70 dark:text-amber-400/70"
                            : "text-emerald-600/70 dark:text-emerald-400/70"
                    }
                    valueText={
                      daysToEx === null
                        ? "text-slate-900 dark:text-slate-100"
                        : daysToEx < 0
                          ? "text-red-900 dark:text-red-100"
                          : daysToEx <= 7
                            ? "text-amber-900 dark:text-amber-100"
                            : "text-emerald-900 dark:text-emerald-100"
                    }
                    iconBg={
                      daysToEx === null
                        ? "from-slate-500 to-slate-600"
                        : daysToEx < 0
                          ? "from-red-500 to-rose-600"
                          : daysToEx <= 7
                            ? "from-amber-500 to-orange-500"
                            : "from-emerald-500 to-green-600"
                    }
                    iconShadow={
                      daysToEx === null
                        ? "shadow-slate-500/25"
                        : daysToEx < 0
                          ? "shadow-red-500/25"
                          : daysToEx <= 7
                            ? "shadow-amber-500/25"
                            : "shadow-emerald-500/25"
                    }
                    corner={
                      daysToEx === null
                        ? "from-slate-500/10"
                        : daysToEx < 0
                          ? "from-red-500/10"
                          : daysToEx <= 7
                            ? "from-amber-500/10"
                            : "from-emerald-500/10"
                    }
                    valueAsString
                  />
                </div>

                {/* Progress bars */}
                <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Production Progress
                    </h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      <span className="font-mono font-semibold text-foreground">
                        {Math.round(styleOrder.progressPct)}%
                      </span>{" "}
                      complete
                    </span>
                  </div>
                  <BigProgressBar
                    label="Sewing"
                    output={styleOrder.sewingOutput}
                    total={styleOrder.totalQty}
                    fill="bg-gradient-to-r from-emerald-500 to-emerald-600"
                    shadow="shadow-[0_2px_6px_-2px_rgb(16_185_129_/_0.55)]"
                  />
                  <BigProgressBar
                    label="Finishing"
                    output={styleOrder.finishedOutput}
                    total={styleOrder.totalQty}
                    fill="bg-gradient-to-r from-violet-500 to-purple-600"
                    shadow="shadow-[0_2px_6px_-2px_rgb(139_92_246_/_0.55)]"
                  />
                </div>

                {/* Lines + Status reasons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                      <Users className="h-3.5 w-3.5" />
                      Assigned Lines
                    </h3>
                    {styleOrder.lineNames.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No lines assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {styleOrder.lineNames.map((line) => (
                          <Badge
                            key={line}
                            variant="secondary"
                            className="text-xs font-medium"
                          >
                            {line}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Status Notes
                    </h3>
                    <ul className="space-y-1.5 text-sm">
                      {styleOrder.health.reasons.length === 0 ? (
                        <li className="flex items-center gap-2 text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>No issues detected</span>
                        </li>
                      ) : (
                        styleOrder.health.reasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </TabsContent>

              {/* ─────────────── PURCHASE ORDERS ─────────────── */}
              <TabsContent value="pos" className="mt-0 space-y-2.5">
                {styleOrder.pos.map((po, i) => (
                  <POListItem
                    key={po.id}
                    po={po}
                    index={i}
                    onClick={onViewPO ? () => onViewPO(po.id) : undefined}
                  />
                ))}
              </TabsContent>

              {/* ─────────────── PRODUCTION ─────────────── */}
              <TabsContent value="production" className="mt-0 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <KPICard
                    label="Sewing Output"
                    value={styleOrder.sewingOutput}
                    sub={`${Math.round(sewingPct)}% of total order`}
                    Icon={SewingMachine}
                    bg="from-blue-50 via-white to-blue-50/50 dark:from-blue-950/40 dark:via-card dark:to-blue-950/20"
                    border="border-blue-200/60 dark:border-blue-800/40"
                    accent="text-blue-600/70 dark:text-blue-400/70"
                    valueText="text-blue-900 dark:text-blue-100"
                    iconBg="from-blue-500 to-blue-600"
                    iconShadow="shadow-blue-500/25"
                    corner="from-blue-500/10"
                    big
                  />
                  <KPICard
                    label="Finishing Output"
                    value={styleOrder.finishedOutput}
                    sub={`${Math.round(finishingPct)}% finished`}
                    Icon={Package}
                    bg="from-violet-50 via-white to-purple-50/50 dark:from-violet-950/40 dark:via-card dark:to-purple-950/20"
                    border="border-violet-200/60 dark:border-violet-800/40"
                    accent="text-violet-600/70 dark:text-violet-400/70"
                    valueText="text-violet-900 dark:text-violet-100"
                    iconBg="from-violet-500 to-purple-600"
                    iconShadow="shadow-violet-500/25"
                    corner="from-violet-500/10"
                    big
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-4">
                    <Receipt className="h-3.5 w-3.5" />
                    Per-PO Breakdown
                  </h3>
                  <div className="space-y-1">
                    {styleOrder.pos.map((po) => (
                      <ProductionRow
                        key={po.id}
                        po={po}
                        onClick={onViewPO ? () => onViewPO(po.id) : undefined}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ─────────────── SCHEDULE (placeholder) ─────────────── */}
              <TabsContent value="schedule" className="mt-0">
                <PlaceholderTab
                  Icon={CalendarDays}
                  title="Schedule view"
                  description="Style-level timeline with child PO timelines is planned for a follow-up phase. For now, ex-factory dates are visible on the Overview and Purchase Orders tabs."
                />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────── Sub-components ───────────────

interface KPICardProps {
  label: string;
  value: number | string;
  sub: string;
  Icon: any;
  bg: string;
  border: string;
  accent: string;
  valueText: string;
  iconBg: string;
  iconShadow: string;
  corner: string;
  big?: boolean;
  valueAsString?: boolean;
}

function KPICard({
  label,
  value,
  sub,
  Icon,
  bg,
  border,
  accent,
  valueText,
  iconBg,
  iconShadow,
  corner,
  big,
  valueAsString,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 transition-all duration-300 hover:shadow-md group",
        bg,
        border
      )}
    >
      <div className={cn("absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl to-transparent rounded-bl-full pointer-events-none", corner)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p className={cn("text-[11px] font-semibold uppercase tracking-wider", accent)}>
            {label}
          </p>
          <p
            className={cn(
              "font-bold font-mono tracking-tight leading-none",
              valueText,
              big ? "text-3xl md:text-4xl" : "text-2xl"
            )}
          >
            {valueAsString ? (
              value
            ) : (
              <AnimatedNumber value={typeof value === "number" ? value : 0} />
            )}
          </p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        <div
          className={cn(
            "h-10 w-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg transition-shadow group-hover:shadow-xl shrink-0",
            iconBg,
            iconShadow
          )}
        >
          <Icon className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
      </div>
    </div>
  );
}

function BigProgressBar({
  label,
  output,
  total,
  fill,
  shadow,
}: {
  label: string;
  output: number;
  total: number;
  fill: string;
  shadow: string;
}) {
  const pct = total > 0 ? Math.min((output / total) * 100, 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-foreground/90">{label}</span>
        <span className="text-xs tabular-nums font-mono">
          <span className="font-bold">{output.toLocaleString()}</span>
          <span className="text-muted-foreground"> / {total.toLocaleString()}</span>
          <span className="text-muted-foreground/70 ml-2">({Math.round(pct)}%)</span>
        </span>
      </div>
      <div className="h-3 rounded-full bg-foreground/[0.06] overflow-hidden ring-1 ring-inset ring-foreground/[0.08]">
        <div
          className={cn("h-full rounded-full transition-all duration-700", fill, shadow)}
          style={{ width: `${pct}%`, minWidth: pct > 0 ? "0.75rem" : 0 }}
        />
      </div>
    </div>
  );
}

function POListItem({
  po,
  index,
  onClick,
}: {
  po: POControlRoomData;
  index: number;
  onClick?: () => void;
}) {
  const sewingPct = po.order_qty > 0 ? Math.min((po.sewingOutput / po.order_qty) * 100, 100) : 0;
  const finishingPct = po.order_qty > 0 ? Math.min((po.finishedOutput / po.order_qty) * 100, 100) : 0;
  const status = PO_STATUS[po.health.status] ?? PO_STATUS.healthy;

  const Element = onClick ? "button" : "div";

  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative w-full text-left rounded-xl border bg-card p-4 transition-all duration-200 ring-1 ring-inset",
        "animate-fade-in",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
        status.ringColor
      )}
      style={{ animationDelay: `${Math.min(index * 30, 200)}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-mono font-bold text-base tracking-tight">{po.po_number}</p>
            {po.color && (
              <Badge variant="secondary" className="text-[10px] font-medium">
                {po.color}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            <span className="font-semibold text-foreground/90">{po.order_qty.toLocaleString()}</span>{" "}
            pcs
            {po.line_names.length > 0 && (
              <>
                <span className="text-muted-foreground/40 mx-1.5">·</span>
                <span title={po.line_names.join(", ")}>
                  {po.line_names.length === 1
                    ? po.line_names[0]
                    : `${po.line_names[0]} +${po.line_names.length - 1}`}
                </span>
              </>
            )}
          </p>
        </div>
        <Badge variant={status.variant} className="shrink-0 text-[10px]">
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniProgress label="Sewing" pct={sewingPct} fill="bg-gradient-to-r from-emerald-500 to-emerald-600" />
        <MiniProgress label="Finishing" pct={finishingPct} fill="bg-gradient-to-r from-violet-500 to-purple-600" />
      </div>

      {po.planned_ex_factory && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/50">
          <Calendar className="h-3 w-3 shrink-0 opacity-70" />
          <span>Ex-Factory <span className="font-medium text-foreground/80">{formatShortDate(po.planned_ex_factory)}</span></span>
        </div>
      )}
    </Element>
  );
}

function MiniProgress({
  label,
  pct,
  fill,
}: {
  label: string;
  pct: number;
  fill: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </span>
        <span className="text-xs font-bold tabular-nums font-mono">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", fill)}
          style={{ width: `${pct}%`, minWidth: pct > 0 ? "0.375rem" : 0 }}
        />
      </div>
    </div>
  );
}

function ProductionRow({
  po,
  onClick,
}: {
  po: POControlRoomData;
  onClick?: () => void;
}) {
  const sewingPct = po.order_qty > 0 ? Math.min((po.sewingOutput / po.order_qty) * 100, 100) : 0;
  const finishingPct = po.order_qty > 0 ? Math.min((po.finishedOutput / po.order_qty) * 100, 100) : 0;

  const Element = onClick ? "button" : "div";

  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-3 py-2 px-3 rounded-lg w-full text-left transition-colors",
        onClick
          ? "cursor-pointer hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:bg-muted/60"
          : "hover:bg-muted/40"
      )}
    >
      <div className="flex items-center gap-3 sm:w-[180px] shrink-0">
        <span className="font-mono font-semibold text-sm">{po.po_number}</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {po.order_qty.toLocaleString()}
        </span>
      </div>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        <ProductionStageRow
          label="Sewing"
          output={po.sewingOutput}
          pct={sewingPct}
          fill="bg-gradient-to-r from-emerald-500 to-emerald-600"
        />
        <ProductionStageRow
          label="Finishing"
          output={po.finishedOutput}
          pct={finishingPct}
          fill="bg-gradient-to-r from-violet-500 to-purple-600"
        />
      </div>
    </Element>
  );
}

function ProductionStageRow({
  label,
  output,
  pct,
  fill,
}: {
  label: string;
  output: number;
  pct: number;
  fill: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-14 shrink-0 font-medium">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", fill)}
          style={{ width: `${pct}%`, minWidth: pct > 0 ? "0.375rem" : 0 }}
        />
      </div>
      <span className="font-mono font-medium tabular-nums w-14 text-right shrink-0">
        {output.toLocaleString()}
      </span>
    </div>
  );
}

function PlaceholderTab({
  Icon,
  title,
  description,
}: {
  Icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center mb-4 ring-1 ring-border">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{description}</p>
    </div>
  );
}
