import { useState } from "react";
import { Loader2 } from "lucide-react";
import { StyleOrderCard } from "./StyleOrderCard";
import { StyleOrderDetailDrawer } from "./StyleOrderDetailDrawer";
import type { StyleOrderRollup } from "./types";

interface Props {
  styleOrders: StyleOrderRollup[];
  loading: boolean;
  today: string; // YYYY-MM-DD, used by detail drawer for ex-factory delta
  onViewPO?: (poId: string) => void; // jump to PO Details view + expand row
}

// Renders Style Orders as a grid of clickable square cards. Click → drawer.
// (File name kept for backward compat with existing imports; layout is grid not table.)
export function StyleOrderTable({ styleOrders, loading, today, onViewPO }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null);

  const detailStyleOrder = detailId
    ? styleOrders.find((s) => s.id === detailId) ?? null
    : null;

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (styleOrders.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 py-14 text-center text-muted-foreground text-sm">
        No style orders found
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-5">
        {styleOrders.map((so, i) => (
          <StyleOrderCard
            key={so.id}
            so={so}
            index={i}
            onClick={() => setDetailId(so.id)}
          />
        ))}
      </div>

      <StyleOrderDetailDrawer
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
        styleOrder={detailStyleOrder}
        today={today}
        onViewPO={(poId) => {
          setDetailId(null); // close dialog before navigation
          onViewPO?.(poId);
        }}
      />
    </>
  );
}
