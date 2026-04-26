import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import type { UnscheduledPO } from "@/hooks/useProductionSchedule";

interface Props {
  po: UnscheduledPO;
  onSchedule: (po: UnscheduledPO) => void;
}

export function DraggableUnscheduledCard({ po, onSchedule }: Props) {
  const isRisk = po.urgency === "at_risk";
  const isUpcoming = po.urgency === "upcoming";

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unscheduled-${po.id}`,
    data: {
      type: "unscheduled-po",
      workOrder: po,
    },
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onSchedule(po); }}
      className={`w-full text-left relative rounded-lg border bg-white overflow-hidden transition-all duration-150
        ${isRisk ? "border-red-200/60 hover:border-red-300" : "border-slate-200/80 hover:border-slate-300"}
        ${isDragging ? "opacity-30 shadow-none" : "hover:shadow-md cursor-grab active:cursor-grabbing"}
      `}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
        isRisk ? "bg-red-500" : isUpcoming ? "bg-amber-400" : "bg-slate-200"
      }`} />

      <div className="pl-4 pr-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-slate-800 tracking-tight">{po.po_number}</span>
          <span className="text-[10px] text-slate-400 truncate">{po.buyer}</span>
        </div>
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
