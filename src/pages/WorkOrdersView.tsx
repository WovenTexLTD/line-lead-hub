import { useState } from "react";
import { Radar, Search, Archive, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePOControlRoom } from "@/components/po-control-room/usePOControlRoom";
import { POControlRoomKPIs } from "@/components/po-control-room/POControlRoomKPIs";
import { NeedsActionSection } from "@/components/po-control-room/NeedsActionSection";
import { POFilterTabs } from "@/components/po-control-room/POFilterTabs";
import { POTable } from "@/components/po-control-room/POTable";
import { ExtrasLedgerModal } from "@/components/ExtrasLedgerModal";
import { ExtrasOverviewModal } from "@/components/ExtrasOverviewModal";
import type { POControlRoomData } from "@/components/po-control-room/types";

export default function WorkOrdersView() {
  const {
    loading,
    filteredOrders,
    kpis,
    tabCounts,
    needsActionCards,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    expandedId,
    detailData,
    detailLoading,
    toggleExpand,
    refetch,
  } = usePOControlRoom();

  // Extras ledger modal state
  const [ledgerPO, setLedgerPO] = useState<POControlRoomData | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showExtrasOverview, setShowExtrasOverview] = useState(false);

  const handleViewLedger = (po: POControlRoomData) => {
    setLedgerPO(po);
    setShowLedger(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-4 lg:py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Radar className="h-6 w-6" />
          PO Control Room
        </h1>
        <p className="text-muted-foreground">
          Track active work orders, health, and production pipeline
        </p>
      </div>

      {/* KPI Cards */}
      <POControlRoomKPIs kpis={kpis} />

      {/* Needs Action Today */}
      <NeedsActionSection
        cards={needsActionCards}
        onViewTab={setActiveTab}
      />

      {/* Extras Overview + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Button
          variant="default"
          onClick={() => setShowExtrasOverview(true)}
          className="gap-2"
          size="lg"
        >
          <Archive className="h-5 w-5" />
          View All Leftovers
        </Button>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by PO, buyer, or style..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <POFilterTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
      />

      {/* Table */}
      <POTable
        orders={filteredOrders}
        loading={false}
        expandedId={expandedId}
        detailData={detailData}
        detailLoading={detailLoading}
        onToggleExpand={toggleExpand}
        onViewExtras={handleViewLedger}
      />

      {/* Extras Ledger Modal */}
      {ledgerPO && (
        <ExtrasLedgerModal
          open={showLedger}
          onOpenChange={setShowLedger}
          workOrderId={ledgerPO.id}
          poNumber={ledgerPO.po_number}
          extrasAvailable={
            Math.max(ledgerPO.finishedOutput - ledgerPO.order_qty, 0) -
            ledgerPO.extrasConsumed
          }
          onLedgerChange={refetch}
        />
      )}

      {/* Extras Overview Modal */}
      <ExtrasOverviewModal
        open={showExtrasOverview}
        onOpenChange={setShowExtrasOverview}
      />
    </div>
  );
}
