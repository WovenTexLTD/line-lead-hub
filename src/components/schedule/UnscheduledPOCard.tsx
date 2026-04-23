import { format, parseISO } from "date-fns";
import type { UnscheduledPO } from "@/hooks/useProductionSchedule";

interface Props {
  po: UnscheduledPO;
  onSchedule: (po: UnscheduledPO) => void;
}

export function UnscheduledPOCard({ po, onSchedule }: Props) {
  const isRisk = po.urgency === "at_risk";
  const isUpcoming = po.urgency === "upcoming";

  return (
    <button
      onClick={() => onSchedule(po)}
      className={`w-full text-left relative rounded-lg border bg-white overflow-hidden transition-all duration-150 hover:shadow-md
        ${isRisk ? "border-red-200/60 hover:border-red-300" : "border-slate-200/80 hover:border-slate-300"}
      `}
    >
      {/* Left accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
        isRisk ? "bg-red-500" : isUpcoming ? "bg-amber-400" : "bg-slate-200"
      }`} />

      <div className="pl-4 pr-3 py-2">
        {/* Row 1: PO + Buyer */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-slate-800 tracking-tight">{po.po_number}</span>
          <span className="text-[10px] text-slate-400 truncate">{po.buyer}</span>
        </div>

        {/* Row 2: Qty + Ex-factory */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-[10px] text-slate-400 tabular-nums">{po.order_qty?.toLocaleString()} pcs</span>
          {po.planned_ex_factory && (
            <span className={`text-[10px] font-medium tabular-nums ${
              isRisk ? "text-red-500" : isUpcoming ? "text-amber-500" : "text-slate-400"
            }`}>
              {format(parseISO(po.planned_ex_factory), "d MMM")}
              {po.daysToExFactory !== null && (
                <span className="ml-0.5">· {po.daysToExFactory <= 0 ? "overdue" : `${po.daysToExFactory}d`}</span>
              )}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
