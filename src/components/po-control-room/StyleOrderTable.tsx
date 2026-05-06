import { useState } from "react";
import { Loader2, Layers, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StyleOrderCard } from "./StyleOrderCard";
import { StyleOrderDetailDrawer } from "./StyleOrderDetailDrawer";
import type { StyleOrderRollup } from "./types";

interface Props {
  styleOrders: StyleOrderRollup[];
  loading: boolean;
  today: string; // YYYY-MM-DD, used by detail drawer for ex-factory delta
  onViewPO?: (poId: string) => void; // jump to PO Details view + expand row
  /** Number of POs that exist but don't yet have an order_number set.
   *  Drives the "add order numbers" empty-state message. */
  unassignedPoCount?: number;
  /** Whether the user can edit work orders (admin+). Hides the CTA otherwise. */
  canManageWorkOrders?: boolean;
}

// Renders Style Orders as a grid of clickable square cards. Click → drawer.
// (File name kept for backward compat with existing imports; layout is grid not table.)
export function StyleOrderTable({
  styleOrders,
  loading,
  today,
  onViewPO,
  unassignedPoCount = 0,
  canManageWorkOrders = false,
}: Props) {
  const navigate = useNavigate();
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
    // Targeted empty state: POs exist but none have an order_number yet
    // (typical right after the Order Number feature was added).
    if (unassignedPoCount > 0) {
      return (
        <div className="rounded-xl border border-border/60 bg-card/60 py-12 px-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
            <Layers className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-base font-semibold mb-1.5">No orders yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            You have <span className="font-semibold text-foreground">{unassignedPoCount}</span>{" "}
            {unassignedPoCount === 1 ? "work order" : "work orders"} without an order number.
            Add an order number to your work orders to see them grouped here. POs sharing the
            same order number will appear together as one Order.
          </p>
          {canManageWorkOrders && (
            <Button
              size="sm"
              className="gap-2 mt-5"
              onClick={() => navigate("/setup/work-orders")}
            >
              Manage Work Orders
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      );
    }

    // Generic empty state: no work orders at all.
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 py-14 text-center text-muted-foreground text-sm">
        No orders found
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
