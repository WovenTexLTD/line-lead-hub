import { KPICard } from "@/components/ui/kpi-card";
import { ClipboardList, Hash, Scissors, Package, TrendingUp } from "lucide-react";
import type { POKPIs } from "./types";

interface Props {
  kpis: POKPIs;
}

export function POControlRoomKPIs({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <KPICard
        title="Active Orders"
        value={kpis.activeOrders}
        icon={ClipboardList}
      />
      <KPICard
        title="Total Order Qty"
        value={kpis.totalQty.toLocaleString()}
        icon={Hash}
      />
      <KPICard
        title="Sewing Output"
        value={kpis.sewingOutput.toLocaleString()}
        icon={Scissors}
        variant="positive"
      />
      <KPICard
        title="Finished Output"
        value={kpis.finishedOutput.toLocaleString()}
        icon={Package}
        variant="positive"
      />
      <KPICard
        title="Total Extras"
        value={kpis.totalExtras.toLocaleString()}
        icon={TrendingUp}
        variant="warning"
      />
    </div>
  );
}
