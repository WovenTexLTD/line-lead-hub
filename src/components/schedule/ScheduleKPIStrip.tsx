import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, AlertTriangle, Activity, Pause, ShieldAlert } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type { ScheduleKPIs } from "@/hooks/useProductionSchedule";

interface Props {
  kpis: ScheduleKPIs;
}

const cards = [
  {
    key: "scheduledCount" as const,
    label: "Scheduled POs",
    icon: CalendarCheck,
    gradient: "from-blue-50 via-white to-blue-50/30",
    iconBg: "bg-gradient-to-br from-blue-100 to-blue-50",
    iconColor: "text-blue-600",
    accentColor: "from-blue-200/30",
  },
  {
    key: "unscheduledCount" as const,
    label: "Unscheduled POs",
    icon: AlertTriangle,
    gradient: "from-amber-50 via-white to-amber-50/30",
    iconBg: "bg-gradient-to-br from-amber-100 to-amber-50",
    iconColor: "text-amber-600",
    accentColor: "from-amber-200/30",
  },
  {
    key: "linesInUse" as const,
    label: "Lines in Use",
    icon: Activity,
    gradient: "from-emerald-50 via-white to-emerald-50/30",
    iconBg: "bg-gradient-to-br from-emerald-100 to-emerald-50",
    iconColor: "text-emerald-600",
    accentColor: "from-emerald-200/30",
  },
  {
    key: "idleLines" as const,
    label: "Idle Lines",
    icon: Pause,
    gradient: "from-slate-50 via-white to-slate-50/30",
    iconBg: "bg-gradient-to-br from-slate-100 to-slate-50",
    iconColor: "text-slate-500",
    accentColor: "from-slate-200/30",
  },
  {
    key: "exFactoryRisks" as const,
    label: "Ex-Factory Risks",
    icon: ShieldAlert,
    gradient: "from-red-50 via-white to-red-50/30",
    iconBg: "bg-gradient-to-br from-red-100 to-red-50",
    iconColor: "text-red-600",
    accentColor: "from-red-200/30",
  },
];

export function ScheduleKPIStrip({ kpis }: Props) {
  return (
    <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        const value = kpis[card.key];
        return (
          <Card
            key={card.key}
            className={`relative overflow-hidden bg-gradient-to-br ${card.gradient}
              border-slate-200/60 hover:shadow-xl hover:-translate-y-1
              transition-all duration-300 animate-fade-in`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Decorative blobs */}
            <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${card.accentColor} to-transparent`} />
            <div className={`absolute -bottom-6 -left-6 w-16 h-16 rounded-full bg-gradient-to-tr ${card.accentColor} to-transparent`} />

            <CardContent className="pt-5 pb-4 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{card.label}</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">
                    <AnimatedNumber value={value} />
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
