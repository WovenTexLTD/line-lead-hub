import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { UnscheduledPOCard } from "./UnscheduledPOCard";
import type { UnscheduledPO, UrgencyGroup } from "@/hooks/useProductionSchedule";

interface Props {
  unscheduledPOs: UnscheduledPO[];
  onSchedule: (po: UnscheduledPO) => void;
}

const groupConfig: Record<UrgencyGroup, { label: string; color: string }> = {
  at_risk: { label: "At Risk", color: "text-red-600" },
  upcoming: { label: "Upcoming", color: "text-amber-600" },
  later: { label: "Later", color: "text-slate-500" },
};

export function UnscheduledSidebar({ unscheduledPOs, onSchedule }: Props) {
  const groups = (["at_risk", "upcoming", "later"] as const).map((key) => ({
    key,
    ...groupConfig[key],
    items: unscheduledPOs.filter((po) => po.urgency === key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="w-full lg:w-[320px] shrink-0 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
      <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-sm font-semibold text-slate-800">Unscheduled Orders</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 h-5">{unscheduledPOs.length}</Badge>
        </div>

        <div className="p-3 space-y-4">
          {unscheduledPOs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2" />
              <p className="text-sm font-medium text-slate-600">All orders scheduled</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Every active PO has been assigned to a line</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${group.color}`}>
                  {group.label} ({group.items.length})
                </p>
                <div className="space-y-2">
                  {group.items.map((po) => (
                    <UnscheduledPOCard key={po.id} po={po} onSchedule={onSchedule} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
