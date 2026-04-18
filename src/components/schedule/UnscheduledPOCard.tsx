import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import type { UnscheduledPO } from "@/hooks/useProductionSchedule";

interface Props {
  po: UnscheduledPO;
  onSchedule: (po: UnscheduledPO) => void;
}

export function UnscheduledPOCard({ po, onSchedule }: Props) {
  const exColor = po.urgency === "at_risk" ? "text-red-600" : po.urgency === "upcoming" ? "text-amber-600" : "text-slate-500";

  return (
    <div className="flex items-start justify-between gap-2 p-3 rounded-lg border border-slate-150 bg-white hover:shadow-sm transition-shadow">
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{po.po_number}</p>
        <p className="text-[11px] text-slate-500 truncate">{po.buyer} – {po.style}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-slate-400">{po.order_qty?.toLocaleString()} pcs</span>
          {po.planned_ex_factory && (
            <span className={`text-[10px] font-medium ${exColor}`}>
              Ex: {format(parseISO(po.planned_ex_factory), "d MMM")}
              {po.daysToExFactory !== null && (
                <span className="ml-1">
                  ({po.daysToExFactory <= 0 ? "overdue" : `${po.daysToExFactory}d`})
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs shrink-0" onClick={() => onSchedule(po)}>
        Schedule
      </Button>
    </div>
  );
}
