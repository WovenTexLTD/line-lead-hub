import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatDateTimeInTimezone } from "@/lib/date-utils";
import {
  Factory,
  Crosshair,
  Scissors,
  CheckCircle,
  Shirt,
  CircleDot,
  Flame,
  Package,
  Box,
  Archive,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

export interface FinishingTargetData {
  id: string;
  production_date: string;
  submitted_at: string | null;
  po_number: string | null;
  buyer: string | null;
  style: string | null;
  thread_cutting: number;
  inside_check: number;
  top_side_check: number;
  buttoning: number;
  iron: number;
  get_up: number;
  poly: number;
  carton: number;
  planned_hours: number | null;
  ot_hours_planned: number | null;
  ot_manpower_planned: number | null;
  remarks: string | null;
}

export interface FinishingActualData {
  id: string;
  production_date: string;
  submitted_at: string | null;
  po_number: string | null;
  buyer: string | null;
  style: string | null;
  thread_cutting: number;
  inside_check: number;
  top_side_check: number;
  buttoning: number;
  iron: number;
  get_up: number;
  poly: number;
  carton: number;
  actual_hours: number | null;
  ot_hours_actual: number | null;
  ot_manpower_actual: number | null;
  remarks: string | null;
}

interface FinishingSubmissionViewProps {
  target?: FinishingTargetData | null;
  actual?: FinishingActualData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROCESS_ITEMS = [
  { key: "thread_cutting", label: "threadCutting", icon: Scissors },
  { key: "inside_check", label: "insideCheck", icon: CheckCircle },
  { key: "top_side_check", label: "topSideCheck", icon: Shirt },
  { key: "buttoning", label: "buttoning", icon: CircleDot },
  { key: "iron", label: "iron", icon: Flame },
  { key: "get_up", label: "getUp", icon: Package },
  { key: "poly", label: "poly", icon: Box },
  { key: "carton", label: "carton", icon: Archive },
] as const;

function VarianceIndicator({ actual, target, decimals }: { actual: number; target: number; decimals?: number }) {
  const diff = actual - target;
  const formatted = decimals != null ? diff.toFixed(decimals) : diff.toLocaleString();
  if (diff > 0) return <span className="text-green-600 dark:text-green-400 flex items-center gap-1 text-xs"><TrendingUp className="h-3 w-3" />+{formatted}</span>;
  if (diff < 0) return <span className="text-destructive flex items-center gap-1 text-xs"><TrendingDown className="h-3 w-3" />{formatted}</span>;
  return <span className="text-muted-foreground flex items-center gap-1 text-xs"><Minus className="h-3 w-3" />0</span>;
}

function FieldDisplay({ label, value, className, suffix }: {
  label: string;
  value: string | number | null | undefined;
  className?: string;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`font-semibold ${className || ""}`}>
        {value != null ? (typeof value === "number" ? `${value.toLocaleString()}${suffix || ""}` : value) : "-"}
      </p>
    </div>
  );
}

export function FinishingSubmissionView({ target, actual, open, onOpenChange }: FinishingSubmissionViewProps) {
  const { factory } = useAuth();
  const { t } = useTranslation();

  if (!target && !actual) return null;

  const formatDateTime = (dateString: string) => {
    const timezone = factory?.timezone || "Asia/Dhaka";
    return formatDateTimeInTimezone(dateString, timezone);
  };

  const hasTarget = !!target;
  const hasActual = !!actual;
  const isComparison = hasTarget && hasActual;

  const primary = actual || target!;

  const title = isComparison
    ? t('modals.finishingSubmission')
    : hasActual
      ? t('modals.finishingEndOfDay')
      : t('modals.finishingTarget');

  const Icon = hasActual ? Factory : Crosshair;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
            <div className="flex gap-1.5 ml-auto">
              {hasTarget && (
                <Badge variant="outline" className="bg-primary/10 text-xs">
                  {t('modals.target')}
                </Badge>
              )}
              {hasActual && (
                <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 text-xs">
                  {t('modals.actual')}
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Order Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FieldDisplay label={t('modals.date')} value={formatDate(primary.production_date)} />
            <FieldDisplay label={t('modals.buyer')} value={primary.buyer} />
            <FieldDisplay label={t('modals.style')} value={primary.style} />
            <FieldDisplay label={t('modals.poNumber')} value={primary.po_number} />
          </div>

          {/* Two-column Target & Actual display */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Left Column: Target (blue) */}
            {hasTarget && target ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-primary">
                  <Crosshair className="h-4 w-4" />
                  {t('modals.morningTarget')}
                </h4>

                {/* Process Values */}
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">{t('modals.processTargets')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {PROCESS_ITEMS.filter(item => item.key !== "poly" && item.key !== "carton").map((item) => {
                      const value = target[item.key as keyof FinishingTargetData] as number;
                      return (
                        <FieldDisplay
                          key={item.key}
                          label={t('modals.' + item.label)}
                          value={value}
                          suffix=" /hr"
                        />
                      );
                    })}
                    <FieldDisplay label={t('modals.poly')} value={target.poly} suffix=" /hr" className="text-success" />
                    {target.planned_hours != null && target.planned_hours > 0 && (
                      <FieldDisplay label={t('modals.targetTotalPoly')} value={Math.round(target.poly * target.planned_hours)} className="text-success" />
                    )}
                    <FieldDisplay label={t('modals.carton')} value={target.carton} suffix=" /hr" className="text-lg text-warning" />
                    {target.planned_hours != null && target.planned_hours > 0 && (
                      <FieldDisplay label={t('modals.targetTotalCarton')} value={Math.round(target.carton * target.planned_hours)} className="text-lg text-warning" />
                    )}
                  </div>
                </div>

                {/* Hours & Resources */}
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">{t('modals.hoursAndResources')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldDisplay label={t('modals.plannedHours')} value={target.planned_hours} />
                    <FieldDisplay label={t('modals.otHoursPlanned')} value={target.ot_hours_planned} />
                    {target.ot_manpower_planned != null && target.ot_manpower_planned > 0 && (
                      <FieldDisplay label={t('modals.otManpowerPlanned')} value={target.ot_manpower_planned} />
                    )}
                  </div>
                </div>

                {/* Remarks */}
                {target.remarks && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">{t('modals.remarks')}</p>
                    <p className="text-sm text-muted-foreground">{target.remarks}</p>
                  </div>
                )}

                {/* Timestamp */}
                {target.submitted_at && (
                  <p className="text-xs text-muted-foreground pt-2 border-t border-primary/10">
                    {t('modals.submitted')}: {formatDateTime(target.submitted_at)}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4 flex flex-col items-center justify-center text-center min-h-[200px]">
                <Crosshair className="h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('modals.morningTargetNotSubmitted')}</p>
              </div>
            )}

            {/* Right Column: Actual (green) */}
            {hasActual && actual ? (
              <div className="rounded-lg border border-success/20 bg-success/5 p-4 space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-success">
                  <Factory className="h-4 w-4" />
                  {t('modals.endOfDayActual')}
                </h4>

                {/* Process Values */}
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">{t('modals.processOutput')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {PROCESS_ITEMS.filter(item => item.key !== "poly" && item.key !== "carton").map((item) => {
                      const value = actual[item.key as keyof FinishingActualData] as number;
                      return (
                        <FieldDisplay
                          key={item.key}
                          label={t('modals.' + item.label)}
                          value={value}
                        />
                      );
                    })}
                    {actual.actual_hours != null && actual.actual_hours > 0 && (
                      <FieldDisplay label={t('modals.polyPerHour')} value={Math.round((actual.poly / actual.actual_hours) * 100) / 100} suffix=" /hr" className="text-success" />
                    )}
                    <FieldDisplay label={t('modals.poly')} value={actual.poly} className="text-success" />
                    {actual.actual_hours != null && actual.actual_hours > 0 && (
                      <FieldDisplay label={t('modals.cartonPerHour')} value={Math.round((actual.carton / actual.actual_hours) * 100) / 100} suffix=" /hr" className="text-lg text-warning" />
                    )}
                    <FieldDisplay label={t('modals.carton')} value={actual.carton} className="text-lg text-warning" />
                  </div>
                </div>

                {/* Hours & Resources */}
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">{t('modals.hoursAndResources')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldDisplay label={t('modals.actualHours')} value={actual.actual_hours} />
                    <FieldDisplay label={t('modals.otHoursActual')} value={actual.ot_hours_actual} />
                    {actual.ot_manpower_actual != null && actual.ot_manpower_actual > 0 && (
                      <FieldDisplay label={t('modals.otManpowerActual')} value={actual.ot_manpower_actual} />
                    )}
                  </div>
                </div>

                {/* Remarks */}
                {actual.remarks && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">{t('modals.remarks')}</p>
                    <p className="text-sm text-muted-foreground">{actual.remarks}</p>
                  </div>
                )}

                {/* Timestamp */}
                {actual.submitted_at && (
                  <p className="text-xs text-muted-foreground pt-2 border-t border-success/10">
                    {t('modals.submitted')}: {formatDateTime(actual.submitted_at)}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4 flex flex-col items-center justify-center text-center min-h-[200px]">
                <Factory className="h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('modals.endOfDayNotSubmitted')}</p>
              </div>
            )}
          </div>

          {/* Comparison table (full width, below columns) */}
          {isComparison && target && actual && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-semibold text-sm mb-3 flex items-center justify-between">
                <span>{t('modals.targetVsActual')}</span>
                <Badge variant="outline" className="text-xs">{t('modals.variance')}</Badge>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-left py-2 pr-4 font-medium">{t('modals.metric')}</th>
                      <th className="text-right py-2 px-3 font-medium">{t('modals.target')}</th>
                      <th className="text-right py-2 px-3 font-medium">{t('modals.actual')}</th>
                      <th className="text-right py-2 pl-3 font-medium">{t('modals.variance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const tgtHours = target.planned_hours;
                      const actHours = actual.actual_hours;

                      // Carton per-hour rate row (target is already per-hour; derive actual per-hour)
                      const cartonPerHourActual = actHours && actHours > 0
                        ? Math.round((actual.carton / actHours) * 100) / 100
                        : null;

                      const rows: { label: string; tgt: number | null | undefined; act: number | null | undefined; decimals?: number }[] = [
                        // Per-hour rate comparison (carton = primary output metric)
                        { label: t('modals.cartonPerHour'), tgt: target.carton, act: cartonPerHourActual, decimals: 2 },
                        // Total comparisons: target per-hour × planned_hours vs actual day total
                        ...PROCESS_ITEMS.map(item => {
                          const tgtPerHour = target[item.key as keyof FinishingTargetData] as number;
                          const tgtTotal = tgtHours != null && tgtHours > 0
                            ? Math.round(tgtPerHour * tgtHours)
                            : null;
                          return {
                            label: `${t('modals.' + item.label)} (${t('modals.total')})`,
                            tgt: tgtTotal,
                            act: actual[item.key as keyof FinishingActualData] as number,
                          };
                        }),
                        { label: t('modals.hours'), tgt: tgtHours, act: actHours },
                      ];

                      // Add OT rows conditionally
                      if (target.ot_hours_planned != null || actual.ot_hours_actual != null) {
                        rows.push({ label: t('modals.otHours'), tgt: target.ot_hours_planned, act: actual.ot_hours_actual });
                      }
                      if (target.ot_manpower_planned != null || actual.ot_manpower_actual != null) {
                        rows.push({ label: t('modals.otManpower'), tgt: target.ot_manpower_planned, act: actual.ot_manpower_actual });
                      }

                      return rows.map(({ label, tgt, act, decimals }) => (
                        <tr key={label} className="border-b border-muted/50 last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">{label}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {tgt != null ? `${decimals != null ? Number(tgt).toFixed(decimals) : tgt.toLocaleString()}` : "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {act != null ? `${decimals != null ? Number(act).toFixed(decimals) : act.toLocaleString()}` : "—"}
                          </td>
                          <td className="py-2 pl-3 text-right">
                            {tgt != null && act != null
                              ? <VarianceIndicator actual={act} target={tgt} decimals={decimals} />
                              : <span className="text-muted-foreground text-xs">—</span>
                            }
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
