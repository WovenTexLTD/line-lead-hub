import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { Search, Package, Download, X } from "lucide-react";
import { TableSkeleton, StatsCardsSkeleton } from "@/components/ui/table-skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StorageBinCardDetailModal } from "@/components/StorageBinCardDetailModal";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";
import { useSortableTable } from "@/hooks/useSortableTable";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

interface BinCard {
  id: string;
  work_order_id: string;
  buyer: string | null;
  style: string | null;
  supplier_name: string | null;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  work_orders: {
    po_number: string;
    buyer: string;
    style: string;
    item: string | null;
  };
  latestBalance?: number;
  totalReceived?: number;
  totalIssued?: number;
}

interface StorageSubmissionsTableProps {
  factoryId: string;
  dateRange: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  lowStockThreshold?: number;
}

export function StorageSubmissionsTable({
  factoryId,
  dateRange,
  searchTerm,
  onSearchChange,
  lowStockThreshold = 10,
}: StorageSubmissionsTableProps) {
  const [loading, setLoading] = useState(true);
  const [binCards, setBinCards] = useState<BinCard[]>([]);
  const [selectedBinCard, setSelectedBinCard] = useState<any>(null);
  const [binCardTransactions, setBinCardTransactions] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    fetchData();
  }, [factoryId, dateRange]);

  async function fetchData() {
    setLoading(true);
    const endDate = new Date();
    const startDate = subDays(endDate, parseInt(dateRange));

    try {
      const { data: cardsData, error } = await supabase
        .from("storage_bin_cards")
        .select(`
          id,
          work_order_id,
          buyer,
          style,
          supplier_name,
          description,
          color,
          created_at,
          updated_at,
          work_orders!inner (
            po_number,
            buyer,
            style,
            item
          )
        `)
        .eq("factory_id", factoryId)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const cardIds = (cardsData || []).map(c => c.id);
      const latestByCard = new Map<string, { balance: number; received: number; issued: number }>();

      if (cardIds.length > 0) {
        const { data: allTxns } = await supabase
          .from("storage_bin_card_transactions")
          .select("bin_card_id, balance_qty, receive_qty, issue_qty, transaction_date, created_at")
          .eq("factory_id", factoryId)
          .in("bin_card_id", cardIds)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false });

        const txnTotals = new Map<string, { received: number; issued: number }>();
        
        (allTxns || []).forEach(txn => {
          if (!latestByCard.has(txn.bin_card_id)) {
            latestByCard.set(txn.bin_card_id, { balance: txn.balance_qty, received: 0, issued: 0 });
          }
          
          const current = txnTotals.get(txn.bin_card_id) || { received: 0, issued: 0 };
          current.received += txn.receive_qty || 0;
          current.issued += txn.issue_qty || 0;
          txnTotals.set(txn.bin_card_id, current);
        });

        txnTotals.forEach((totals, cardId) => {
          const entry = latestByCard.get(cardId);
          if (entry) {
            entry.received = totals.received;
            entry.issued = totals.issued;
          }
        });
      }

      const cardsWithBalance = (cardsData || []).map(card => ({
        ...card,
        latestBalance: latestByCard.get(card.id)?.balance,
        totalReceived: latestByCard.get(card.id)?.received || 0,
        totalIssued: latestByCard.get(card.id)?.issued || 0,
      })) as BinCard[];

      setBinCards(cardsWithBalance);
    } catch (error) {
      console.error("Error fetching storage data:", error);
      toast.error("Failed to load storage data");
    } finally {
      setLoading(false);
    }
  }

  const filteredCards = useMemo(() => {
    if (!searchTerm) return binCards;
    const term = searchTerm.toLowerCase();
    return binCards.filter(card =>
      card.work_orders.po_number.toLowerCase().includes(term) ||
      card.work_orders.buyer.toLowerCase().includes(term) ||
      card.work_orders.style.toLowerCase().includes(term) ||
      (card.description?.toLowerCase().includes(term))
    );
  }, [binCards, searchTerm]);

  const { sortedData, sortConfig, requestSort } = useSortableTable(filteredCards);

  const {
    currentPage,
    totalPages,
    paginatedData,
    setCurrentPage,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
    canGoNext,
    canGoPrevious,
    startIndex,
    endIndex,
  } = usePagination(sortedData, { pageSize });

  const stats = useMemo(() => {
    const totalBalance = binCards.reduce((sum, c) => sum + (c.latestBalance || 0), 0);
    const lowStock = binCards.filter(c => c.latestBalance !== undefined && c.latestBalance <= lowStockThreshold).length;
    const totalReceived = binCards.reduce((sum, c) => sum + (c.totalReceived || 0), 0);
    const totalIssued = binCards.reduce((sum, c) => sum + (c.totalIssued || 0), 0);
    return { total: binCards.length, totalBalance, lowStock, totalReceived, totalIssued };
  }, [binCards, lowStockThreshold]);

  const handleCardClick = async (card: BinCard) => {
    setModalLoading(true);
    setModalOpen(true);

    try {
      // Fetch full bin card details
      const { data: binCardData, error: binCardError } = await supabase
        .from('storage_bin_cards')
        .select('*, work_orders(po_number)')
        .eq('id', card.id)
        .single();

      if (binCardError) throw binCardError;

      // Fetch all transactions for this bin card
      const { data: txnData, error: txnError } = await supabase
        .from('storage_bin_card_transactions')
        .select('*')
        .eq('bin_card_id', card.id)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (txnError) throw txnError;

      setSelectedBinCard({
        id: binCardData.id,
        buyer: binCardData.buyer,
        style: binCardData.style,
        po_number: binCardData.work_orders?.po_number || null,
        supplier_name: binCardData.supplier_name,
        description: binCardData.description,
        construction: binCardData.construction,
        color: binCardData.color,
        width: binCardData.width,
        package_qty: binCardData.package_qty,
        prepared_by: binCardData.prepared_by,
      });
      setBinCardTransactions(txnData || []);
    } catch (error) {
      console.error('Error fetching bin card details:', error);
      setModalOpen(false);
      toast.error("Failed to load bin card details");
    } finally {
      setModalLoading(false);
    }
  };

  const allPageSelected = paginatedData.length > 0 && paginatedData.every(c => selectedIds.has(c.id));
  const somePageSelected = paginatedData.some(c => selectedIds.has(c.id));

  function toggleSelectAll() {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginatedData.forEach(c => next.delete(c.id));
      } else {
        paginatedData.forEach(c => next.add(c.id));
      }
      return next;
    });
  }

  function toggleSelectRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportSelectedCsv() {
    const rows = sortedData.filter(c => selectedIds.has(c.id));
    const headers = ["Created", "PO Number", "Buyer", "Style", "Description", "Received", "Issued", "Balance"];
    const csvRows = [headers.join(",")];
    rows.forEach(c => {
      csvRows.push([
        format(new Date(c.created_at), "yyyy-MM-dd"),
        `"${c.work_orders.po_number}"`,
        `"${c.work_orders.buyer}"`,
        `"${c.work_orders.style}"`,
        `"${c.description || ""}"`,
        c.totalReceived ?? 0,
        c.totalIssued ?? 0,
        c.latestBalance ?? "",
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storage-bin-cards-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <StatsCardsSkeleton count={4} />
        <TableSkeleton columns={7} rows={6} headers={["Created", "PO Number", "Buyer", "Style", "Received", "Issued", "Balance"]} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Bin Cards</p>
            <p className="text-xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Total Balance</p>
            <p className="text-xl font-bold">{stats.totalBalance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Total Received</p>
            <p className="text-xl font-bold">{stats.totalReceived.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Low Stock</p>
            <p className="text-xl font-bold">{stats.lowStock}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by PO, buyer, style..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Bin Cards
            <Badge variant="secondary" className="ml-2">{filteredCards.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-b">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button variant="outline" size="sm" onClick={exportSelectedCsv}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Export CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                      {...(somePageSelected && !allPageSelected ? { "data-state": "indeterminate" } : {})}
                    />
                  </TableHead>
                  <SortableTableHead column="created_at" sortConfig={sortConfig} onSort={requestSort}>Created</SortableTableHead>
                  <SortableTableHead column="work_orders.po_number" sortConfig={sortConfig} onSort={requestSort}>PO Number</SortableTableHead>
                  <SortableTableHead column="work_orders.buyer" sortConfig={sortConfig} onSort={requestSort}>Buyer</SortableTableHead>
                  <SortableTableHead column="work_orders.style" sortConfig={sortConfig} onSort={requestSort}>Style</SortableTableHead>
                  <SortableTableHead column="totalReceived" sortConfig={sortConfig} onSort={requestSort} className="text-right">Received</SortableTableHead>
                  <SortableTableHead column="totalIssued" sortConfig={sortConfig} onSort={requestSort} className="text-right">Issued</SortableTableHead>
                  <SortableTableHead column="latestBalance" sortConfig={sortConfig} onSort={requestSort} className="text-right">Balance</SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No bin cards found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((card) => (
                    <TableRow
                      key={card.id}
                      className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(card.id) ? "bg-primary/5" : ""}`}
                      onClick={() => handleCardClick(card)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(card.id)}
                          onCheckedChange={() => toggleSelectRow(card.id)}
                          aria-label={`Select row`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(card.created_at), "MMM d")}
                      </TableCell>
                      <TableCell className="font-medium">{card.work_orders.po_number}</TableCell>
                      <TableCell>{card.work_orders.buyer}</TableCell>
                      <TableCell>{card.work_orders.style}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {card.totalReceived?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right text-blue-600 font-medium">
                        {card.totalIssued?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {card.latestBalance !== undefined ? (
                          <Badge variant={card.latestBalance <= lowStockThreshold ? "destructive" : "secondary"}>
                            {card.latestBalance.toLocaleString()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={filteredCards.length}
            onPageChange={setCurrentPage}
            onFirstPage={goToFirstPage}
            onLastPage={goToLastPage}
            onNextPage={goToNextPage}
            onPreviousPage={goToPreviousPage}
            canGoNext={canGoNext}
            canGoPrevious={canGoPrevious}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* Storage Bin Card Detail Modal */}
      <StorageBinCardDetailModal
        binCard={selectedBinCard}
        transactions={binCardTransactions}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
