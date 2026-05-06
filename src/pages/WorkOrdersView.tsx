import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Receipt, Search, Loader2, SlidersHorizontal, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePOControlRoom } from "@/components/po-control-room/usePOControlRoom";
import { POControlRoomKPIs } from "@/components/po-control-room/POControlRoomKPIs";
import { POWorkflowTabs } from "@/components/po-control-room/POWorkflowTabs";
import { POClusterSection } from "@/components/po-control-room/POClusterSection";
import { POTable } from "@/components/po-control-room/POTable";
import { StyleOrderTable } from "@/components/po-control-room/StyleOrderTable";
import { POViewSwitcher, type POViewMode } from "@/components/po-control-room/POViewSwitcher";
import { POFilterDrawer } from "@/components/po-control-room/POFilterDrawer";
import { POFilterChips } from "@/components/po-control-room/POFilterChips";
import { ExtrasLedgerModal } from "@/components/ExtrasLedgerModal";
import { ExtrasOverviewModal } from "@/components/ExtrasOverviewModal";
import {
  EMPTY_FILTERS,
  countActiveFilters,
  filtersFromParams,
  filtersToParams,
  type POFilters,
} from "@/components/po-control-room/po-filters";
import type { POControlRoomData } from "@/components/po-control-room/types";

export default function WorkOrdersView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAdminOrHigher } = useAuth();

  // ── Filter state (URL-persisted) ──────────────────────────────────────────
  const [filters, setFilters] = useState<POFilters>(() =>
    filtersFromParams(searchParams)
  );
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const handleFiltersChange = useCallback(
    (next: POFilters) => {
      setFilters(next);
      setSearchParams(
        (prev) => {
          // Preserve non-filter params (e.g., tab)
          const merged = new URLSearchParams(prev);
          // Clear existing filter keys
          ["buyer", "po", "style", "so", "line", "unit", "floor", "health", "ex", "updated"].forEach(
            (k) => merged.delete(k)
          );
          // Set new filter params
          Object.entries(filtersToParams(next)).forEach(([k, v]) =>
            merged.set(k, v)
          );
          return merged;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const activeFilterCount = countActiveFilters(filters);

  // ── View mode (Style Orders | PO Details) — URL-persisted ───────────────
  const view: POViewMode = (searchParams.get("view") === "po" ? "po" : "style");
  const setView = useCallback((next: POViewMode) => {
    setSearchParams(
      (prev) => {
        const merged = new URLSearchParams(prev);
        if (next === "po") merged.set("view", "po");
        else merged.delete("view");
        return merged;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  // ── Hook ─────────────────────────────────────────────────────────────────
  const {
    loading,
    today,
    workOrders,
    filteredOrders,
    kpis,
    tabCounts,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    expandedId,
    detailData,
    detailLoading,
    toggleExpand,
    clusteredRunning,
    filterOptions,
    refetch,
    filteredStyleOrders,
    styleOrderTabCounts,
  } = usePOControlRoom(filters);

  // Navigate from a PO inside the Style Orders dialog to that PO's row
  // in the PO Details view: switch view, set right tab, expand row, scroll.
  const handleViewPO = useCallback(
    (poId: string) => {
      const po = workOrders.find((w) => w.id === poId);
      if (!po) return;

      // Pick the most informative tab so the PO is visible
      let nextTab: typeof activeTab = "running";
      if (po.health.status === "at_risk" || po.health.status === "deadline_passed") {
        nextTab = "at_risk";
      } else if (po.workflowState === "completed") {
        nextTab = "completed";
      } else if (po.workflowState === "running") {
        nextTab = "running";
      } else {
        nextTab = "not_started";
      }
      setActiveTab(nextTab);
      setView("po");

      // Defer expand + scroll until after the view + tab switch render
      requestAnimationFrame(() => {
        if (expandedId !== poId) toggleExpand(poId);
        setTimeout(() => {
          document
            .getElementById(`po-row-${poId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
      });
    },
    [workOrders, setActiveTab, setView, toggleExpand, expandedId]
  );

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
    <div className="py-3 md:py-4 lg:py-6 space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold">Work Orders</h1>
              <span className="text-xs font-medium bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-full px-2 py-0.5">
                {kpis.activeOrders} active
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Track health, pipeline, and production progress</p>
          </div>
        </div>

        {isAdminOrHigher && (
          <Button
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => navigate("/setup/work-orders?create=1")}
          >
            <Plus className="h-4 w-4" />
            Add Work Order
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <POControlRoomKPIs kpis={kpis} onViewLeftovers={() => setShowExtrasOverview(true)} view={view} />

      {/* View switcher (Style Orders | PO Details) */}
      <div className="flex items-center justify-between gap-3">
        <POViewSwitcher
          value={view}
          onChange={setView}
          styleOrdersCount={kpis.activeStyleOrders}
          poCount={kpis.activeOrders}
        />
      </div>

      {/* Search + Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={view === "style" ? "Search by buyer, style, or PO..." : "Search by PO, buyer, or style..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters button */}
        <Button
          variant="outline"
          size="default"
          className="gap-2 shrink-0"
          onClick={() => setFilterDrawerOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 min-w-[20px] px-1.5 text-[11px] font-semibold"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <POFilterChips filters={filters} onChange={handleFiltersChange} options={filterOptions} />
      )}

      {/* Workflow Tabs — counts switch with view */}
      <POWorkflowTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={view === "style" ? styleOrderTabCounts : tabCounts}
      />

      {view === "style" ? (
        /* Style Orders view: parent rows, expandable to child POs */
        <StyleOrderTable
          styleOrders={filteredStyleOrders}
          loading={false}
          today={today}
          onViewPO={handleViewPO}
          unassignedPoCount={workOrders.filter(
            (po) => !po.order_number || !po.order_number.trim()
          ).length}
          canManageWorkOrders={isAdminOrHigher}
        />
      ) : activeTab === "running" ? (
        /* PO Details view, running tab: cluster sections */
        <div className="space-y-4">
          {clusteredRunning.size === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No running work orders{activeFilterCount > 0 ? " matching the current filters" : ""}
            </div>
          ) : (
            Array.from(clusteredRunning.entries()).map(([cluster, pos]) => (
              <POClusterSection
                key={cluster}
                cluster={cluster}
                pos={pos}
                expandedId={expandedId}
                detailData={detailData}
                detailLoading={detailLoading}
                onToggleExpand={toggleExpand}
                onViewExtras={handleViewLedger}
              />
            ))
          )}
        </div>
      ) : (
        /* PO Details view, other tabs: flat table with a colored band that
           matches the active tab's status — mirrors the Running tab's
           cluster-section vocabulary so the page never feels bland. */
        <POTable
          orders={filteredOrders}
          loading={false}
          expandedId={expandedId}
          detailData={detailData}
          detailLoading={detailLoading}
          onToggleExpand={toggleExpand}
          onViewExtras={handleViewLedger}
          header={
            activeTab === "not_started"
              ? {
                  label: "Not Started",
                  description: "Awaiting first day of production",
                  colorClass: "bg-slate-500 text-white border-slate-600",
                }
              : activeTab === "at_risk"
                ? {
                    label: "At Risk",
                    description: "Behind schedule, blocked, or past deadline",
                    colorClass: "bg-amber-500 text-white border-amber-600",
                  }
                : activeTab === "completed"
                  ? {
                      label: "Completed",
                      description: "Order fulfilled",
                      colorClass: "bg-green-600 text-white border-green-700",
                    }
                  : undefined
          }
        />
      )}

      {/* Filter drawer */}
      <POFilterDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        filters={filters}
        onChange={handleFiltersChange}
        options={filterOptions}
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
