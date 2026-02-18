import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Search, FileText, AlertTriangle, CalendarIcon, X, Layers } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface BinCardWithWorkOrder {
  id: string;
  work_order_id: string;
  buyer: string | null;
  style: string | null;
  supplier_name: string | null;
  description: string | null;
  prepared_by: string | null;
  prepared_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  bin_group_id: string | null;
  group_name: string | null;
  work_orders: {
    po_number: string;
    buyer: string;
    style: string;
    item: string | null;
  };
}

interface DisplayRow {
  type: "single" | "group";
  key: string;
  cards: BinCardWithWorkOrder[];
  poNumbers: string[];
  groupName: string | null;
  buyer: string;
  style: string;
  description: string;
  preparedBy: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  transaction_date: string;
  receive_qty: number;
  issue_qty: number;
  ttl_receive: number;
  balance_qty: number;
  remarks: string | null;
  created_at: string | null;
  submitted_by?: string | null;
}


export default function StorageHistory() {
  const { profile, isStorageUser, isAdminOrHigher } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [binCards, setBinCards] = useState<BinCardWithWorkOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCard, setSelectedCard] = useState<BinCardWithWorkOrder | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTxn, setLoadingTxn] = useState(false);
  
  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const canAccess = isStorageUser() || isAdminOrHigher();

  useEffect(() => {
    if (profile?.factory_id && canAccess) {
      fetchBinCards();
    } else {
      setLoading(false);
    }
  }, [profile?.factory_id, canAccess]);

  async function fetchBinCards() {
    try {
      const { data, error } = await supabase
        .from("storage_bin_cards")
        .select(`
          id,
          work_order_id,
          buyer,
          style,
          supplier_name,
          description,
          prepared_by,
          prepared_by_user_id,
          created_at,
          updated_at,
          bin_group_id,
          group_name,
          work_orders!inner (
            po_number,
            buyer,
            style,
            item
          )
        `)
        .eq("factory_id", profile!.factory_id!)
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      setBinCards((data || []) as BinCardWithWorkOrder[]);
    } catch (error) {
      console.error("Error fetching bin cards:", error);
    } finally {
      setLoading(false);
    }
  }

  // Build a map of bin_group_id -> all PO numbers in that group (for cross-PO search)
  const groupPoMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const card of binCards) {
      if (card.bin_group_id) {
        const existing = map.get(card.bin_group_id);
        if (existing) {
          if (!existing.includes(card.work_orders.po_number)) {
            existing.push(card.work_orders.po_number);
          }
        } else {
          map.set(card.bin_group_id, [card.work_orders.po_number]);
        }
      }
    }
    return map;
  }, [binCards]);

  const filteredCards = binCards.filter(card => {
    // Text search — also match any PO in the same group + group_name
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      let matchesSearch = (
        card.work_orders.po_number.toLowerCase().includes(term) ||
        card.work_orders.buyer.toLowerCase().includes(term) ||
        card.work_orders.style.toLowerCase().includes(term) ||
        (card.work_orders.item?.toLowerCase().includes(term)) ||
        (card.description?.toLowerCase().includes(term)) ||
        (card.group_name?.toLowerCase().includes(term))
      );
      // Also check sibling POs in the same group
      if (!matchesSearch && card.bin_group_id) {
        const groupPos = groupPoMap.get(card.bin_group_id) || [];
        matchesSearch = groupPos.some(po => po.toLowerCase().includes(term));
      }
      if (!matchesSearch) return false;
    }

    // Date from filter
    if (dateFrom) {
      const cardDate = new Date(card.created_at);
      cardDate.setHours(0, 0, 0, 0);
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (cardDate < fromDate) return false;
    }

    // Date to filter
    if (dateTo) {
      const cardDate = new Date(card.created_at);
      cardDate.setHours(23, 59, 59, 999);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (cardDate > toDate) return false;
    }

    return true;
  });

  function clearFilters() {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchTerm("");
  }

  const hasActiveFilters = dateFrom || dateTo || searchTerm;

  // Group filtered cards by bin_group_id for display
  const displayRows: DisplayRow[] = useMemo(() => {
    const rows: DisplayRow[] = [];
    const groupMap = new Map<string, BinCardWithWorkOrder[]>();
    const ungrouped: BinCardWithWorkOrder[] = [];

    for (const card of filteredCards) {
      if (card.bin_group_id) {
        const existing = groupMap.get(card.bin_group_id);
        if (existing) {
          existing.push(card);
        } else {
          groupMap.set(card.bin_group_id, [card]);
        }
      } else {
        ungrouped.push(card);
      }
    }

    // Add grouped rows
    for (const [groupId, cards] of groupMap) {
      const first = cards[0];
      rows.push({
        type: cards.length > 1 ? "group" : "single",
        key: groupId,
        cards,
        poNumbers: cards.map(c => c.work_orders.po_number),
        groupName: first.group_name || null,
        buyer: first.work_orders.buyer,
        style: [...new Set(cards.map(c => c.work_orders.style))].join(", "),
        description: first.description || first.work_orders.item || "-",
        preparedBy: first.prepared_by || "-",
        createdAt: first.created_at,
      });
    }

    // Add ungrouped rows
    for (const card of ungrouped) {
      rows.push({
        type: "single",
        key: card.id,
        cards: [card],
        poNumbers: [card.work_orders.po_number],
        groupName: null,
        buyer: card.work_orders.buyer,
        style: card.work_orders.style,
        description: card.description || card.work_orders.item || "-",
        preparedBy: card.prepared_by || "-",
        createdAt: card.created_at,
      });
    }

    // Sort by most recent created_at
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return rows;
  }, [filteredCards]);

  async function openCardDetail(card: BinCardWithWorkOrder) {
    setSelectedCard(card);
    setLoadingTxn(true);

    try {
      const { data, error } = await supabase
        .from("storage_bin_card_transactions")
        .select("*")
        .eq("bin_card_id", card.id)
        .order("transaction_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setLoadingTxn(false);
    }
  }

  // Open detail for a group: load transactions for all cards in the group
  const [selectedGroup, setSelectedGroup] = useState<DisplayRow | null>(null);
  const [groupTransactions, setGroupTransactions] = useState<Record<string, { po: string; txns: Transaction[] }>>({});

  async function openGroupDetail(row: DisplayRow) {
    setSelectedGroup(row);
    setSelectedCard(null);
    setLoadingTxn(true);

    try {
      const result: Record<string, { po: string; txns: Transaction[] }> = {};
      for (const card of row.cards) {
        const { data, error } = await supabase
          .from("storage_bin_card_transactions")
          .select("*")
          .eq("bin_card_id", card.id)
          .order("transaction_date", { ascending: true })
          .order("created_at", { ascending: true });

        if (error) throw error;
        result[card.id] = { po: card.work_orders.po_number, txns: data || [] };
      }
      setGroupTransactions(result);
    } catch (error) {
      console.error("Error loading group transactions:", error);
    } finally {
      setLoadingTxn(false);
    }
  }

  if (!canAccess) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Access Denied"
        description="You need the Storage role to access this page."
        iconClassName="text-warning"
      />
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">All Bin Cards</h1>
          <p className="text-sm text-muted-foreground">View all bin card records</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4">
            {/* Search row */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by PO, buyer, style..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date From */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[150px] justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Date To */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[150px] justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Clear filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Cards list */}
      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bin Cards ({displayRows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {displayRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="mx-auto h-12 w-12 mb-2" />
                <p>No bin cards found</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Prepared By</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRows.map(row => (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">
                          <div className="flex flex-wrap items-center gap-1">
                            {row.type === "group" && (
                              <Layers className="h-3.5 w-3.5 text-primary shrink-0 mr-1" />
                            )}
                            {row.poNumbers.length === 1 ? (
                              row.poNumbers[0]
                            ) : (
                              row.poNumbers.map(po => (
                                <Badge key={po} variant="secondary" className="text-xs font-medium">
                                  {po}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate">
                          {row.groupName ? (
                            <Badge variant="outline" className="text-xs font-normal">
                              {row.groupName}
                            </Badge>
                          ) : row.type === "group" ? (
                            <span className="text-xs text-muted-foreground">{row.poNumbers.length} POs</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{row.buyer}</TableCell>
                        <TableCell>{row.style}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{row.description}</TableCell>
                        <TableCell>{row.preparedBy}</TableCell>
                        <TableCell>{format(new Date(row.createdAt), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          {row.type === "group" ? (
                            <Button variant="ghost" size="sm" onClick={() => openGroupDetail(row)}>
                              View Ledger
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => openCardDetail(row.cards[0])}>
                              View Ledger
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Single Card Detail Modal */}
      <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8 break-words">
              Bin Card Ledger - {selectedCard?.work_orders.po_number}
            </DialogTitle>
          </DialogHeader>

          {selectedCard && (
            <div className="space-y-4">
              {/* Header info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Buyer:</span>
                  <p className="font-medium">{selectedCard.buyer || selectedCard.work_orders.buyer}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Style:</span>
                  <p className="font-medium">{selectedCard.style || selectedCard.work_orders.style}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Supplier:</span>
                  <p className="font-medium">{selectedCard.supplier_name || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Prepared By:</span>
                  <p className="font-medium">{selectedCard.prepared_by || "-"}</p>
                </div>
              </div>

              {/* Transactions */}
              {loadingTxn ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>DATE</TableHead>
                        <TableHead className="text-right">RECEIVE QTY</TableHead>
                        <TableHead className="text-right">TTL RECEIVE</TableHead>
                        <TableHead className="text-right">ISSUE QTY</TableHead>
                        <TableHead className="text-right">BALANCE QTY</TableHead>
                        <TableHead>REMARKS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No transactions recorded
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map(txn => (
                          <TableRow key={txn.id}>
                            <TableCell>{format(new Date(txn.transaction_date), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="text-right">{txn.receive_qty}</TableCell>
                            <TableCell className="text-right font-medium">{txn.ttl_receive}</TableCell>
                            <TableCell className="text-right">{txn.issue_qty}</TableCell>
                            <TableCell className={`text-right font-medium ${txn.balance_qty < 0 ? 'text-destructive' : ''}`}>
                              {txn.balance_qty}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{txn.remarks || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Group Detail Modal */}
      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8 break-words flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {selectedGroup?.groupName
                ? `${selectedGroup.groupName}`
                : `Bin Card Group — ${selectedGroup?.poNumbers.join(", ")}`}
            </DialogTitle>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-4">
              {/* Shared header info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">POs:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {selectedGroup.poNumbers.map(po => (
                      <Badge key={po} variant="secondary" className="text-xs">{po}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Buyer:</span>
                  <p className="font-medium">{selectedGroup.buyer}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Supplier:</span>
                  <p className="font-medium">{selectedGroup.cards[0].supplier_name || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Prepared By:</span>
                  <p className="font-medium">{selectedGroup.preparedBy}</p>
                </div>
              </div>

              {/* Per-PO transaction tables */}
              {loadingTxn ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                Object.entries(groupTransactions).map(([cardId, { po, txns }]) => (
                  <div key={cardId} className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {po}
                    </h4>
                    <div className="w-full overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>DATE</TableHead>
                            <TableHead className="text-right">RECEIVE QTY</TableHead>
                            <TableHead className="text-right">TTL RECEIVE</TableHead>
                            <TableHead className="text-right">ISSUE QTY</TableHead>
                            <TableHead className="text-right">BALANCE QTY</TableHead>
                            <TableHead>REMARKS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {txns.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                No transactions recorded
                              </TableCell>
                            </TableRow>
                          ) : (
                            txns.map(txn => (
                              <TableRow key={txn.id}>
                                <TableCell>{format(new Date(txn.transaction_date), "dd/MM/yyyy")}</TableCell>
                                <TableCell className="text-right">{txn.receive_qty}</TableCell>
                                <TableCell className="text-right font-medium">{txn.ttl_receive}</TableCell>
                                <TableCell className="text-right">{txn.issue_qty}</TableCell>
                                <TableCell className={`text-right font-medium ${txn.balance_qty < 0 ? 'text-destructive' : ''}`}>
                                  {txn.balance_qty}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">{txn.remarks || "-"}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
