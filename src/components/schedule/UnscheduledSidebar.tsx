import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Clock, CalendarDays } from "lucide-react";
import { UnscheduledPOCard } from "./UnscheduledPOCard";
import type { UnscheduledPO, UrgencyGroup } from "@/hooks/useProductionSchedule";

interface Props {
  unscheduledPOs: UnscheduledPO[];
  onSchedule: (po: UnscheduledPO) => void;
}

const groupConfig: Record<UrgencyGroup, { label: string; textColor: string; icon: typeof AlertTriangle; borderColor: string }> = {
  at_risk: { label: "At Risk", textColor: "text-red-600", icon: AlertTriangle, borderColor: "border-red-200" },
  upcoming: { label: "Upcoming", textColor: "text-amber-600", icon: Clock, borderColor: "border-amber-200" },
  later: { label: "Later", textColor: "text-slate-400", icon: CalendarDays, borderColor: "border-slate-200" },
};

export function UnscheduledSidebar({ unscheduledPOs, onSchedule }: Props) {
  const groups = (["at_risk", "upcoming", "later"] as const).map((key) => ({
    key,
    ...groupConfig[key],
    items: unscheduledPOs.filter((po) => po.urgency === key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="w-full lg:w-[320px] shrink-0 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
      <div className="border border-slate-200 rounded-xl bg-white shadow-sm ring-1 ring-slate-900/[0.03] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <span className="text-[13px] font-bold text-slate-800 tracking-tight">Unscheduled Orders</span>
          <Badge variant="secondary" className="text-[10px] font-bold px-2 h-5 bg-slate-100 text-slate-600">
            {unscheduledPOs.length}
          </Badge>
        </div>

        {/* Content */}
        <div className="p-3">
          {unscheduledPOs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-[13px] font-semibold text-slate-700">All orders scheduled</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">Every active PO has been assigned to a production line</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.key}>
                    {/* Group header */}
                    <div className={`flex items-center gap-1.5 mb-2 pb-1.5 border-b ${group.borderColor}`}>
                      <Icon className={`h-3 w-3 ${group.textColor}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${group.textColor}`}>
                        {group.label}
                      </span>
                      <span className={`text-[10px] font-semibold ${group.textColor} opacity-60`}>
                        {group.items.length}
                      </span>
                    </div>
                    {/* Cards */}
                    <div className="space-y-1.5">
                      {group.items.map((po) => (
                        <UnscheduledPOCard key={po.id} po={po} onSchedule={onSchedule} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
