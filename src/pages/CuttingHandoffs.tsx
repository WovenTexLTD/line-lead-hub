import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Scissors, Check, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, subDays } from "date-fns";

interface CuttingHandoff {
  id: string;
  production_date: string;
  submitted_at: string | null;
  buyer: string | null;
  style: string | null;
  po_no: string | null;
  colour: string | null;
  order_qty: number | null;
  day_cutting: number;
  day_input: number;
  total_cutting: number | null;
  total_input: number | null;
  balance: number | null;
  transfer_to_line_id: string | null;
  acknowledged: boolean | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  transfer_line: {
    line_id: string;
    name: string | null;
  } | null;
  source_line: {
    line_id: string;
    name: string | null;
  } | null;
}

type DateFilter = "today" | "7days" | "30days" | "all";

export default function CuttingHandoffs() {
  const { user, profile, isAdminOrHigher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [handoffs, setHandoffs] = useState<CuttingHandoff[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [selectedHandoff, setSelectedHandoff] = useState<CuttingHandoff | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [userLineIds, setUserLineIds] = useState<string[]>([]);

  useEffect(() => {
    if (profile?.factory_id && user?.id) {
      fetchUserLineAssignments();
    }
  }, [profile?.factory_id, user?.id]);

  useEffect(() => {
    if (profile?.factory_id && (isAdminOrHigher() || userLineIds.length > 0)) {
      fetchHandoffs();
    }
  }, [profile?.factory_id, dateFilter, userLineIds, isAdminOrHigher]);

  async function fetchUserLineAssignments() {
    if (!user?.id || !profile?.factory_id) return;

    try {
      const { data, error } = await supabase
        .from("user_line_assignments")
        .select("line_id")
        .eq("user_id", user.id)
        .eq("factory_id", profile.factory_id);

      if (error) throw error;
      const lineIds = (data || []).map(a => a.line_id);
      setUserLineIds(lineIds);
      // Only stop loading here if user has no line assignments and is not admin
      // (fetchHandoffs won't be called, so we need to stop loading ourselves)
      if (!isAdminOrHigher() && lineIds.length === 0) {
        setLoading(false);
      }
      // Otherwise, loading stays true until fetchHandoffs completes
    } catch (error) {
      console.error("Error fetching user line assignments:", error);
      setLoading(false);
    }
  }

  async function fetchHandoffs() {
    if (!profile?.factory_id) return;
    setLoading(true);

    try {
      let dateFrom = format(new Date(), "yyyy-MM-dd");
      
      if (dateFilter === "7days") {
        dateFrom = format(subDays(new Date(), 7), "yyyy-MM-dd");
      } else if (dateFilter === "30days") {
        dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");
      } else if (dateFilter === "all") {
        dateFrom = "2000-01-01";
      }

      let query = supabase
        .from("cutting_actuals")
        .select(`
          id,
          production_date,
          submitted_at,
          buyer,
          style,
          po_no,
          colour,
          order_qty,
          day_cutting,
          day_input,
          total_cutting,
          total_input,
          balance,
          transfer_to_line_id,
          acknowledged,
          acknowledged_by,
          acknowledged_at,
          transfer_line:lines!cutting_actuals_transfer_to_line_id_fkey(line_id, name),
          source_line:lines!cutting_actuals_line_id_fkey(line_id, name)
        `)
        .eq("factory_id", profile.factory_id)
        .not("transfer_to_line_id", "is", null)
        .gte("production_date", dateFrom)
        .order("production_date", { ascending: false })
        .order("submitted_at", { ascending: false });

      // For non-admin users, filter by their assigned lines
      if (!isAdminOrHigher() && userLineIds.length > 0) {
        query = query.in("transfer_to_line_id", userLineIds);
      }

      const { data, error } = await query;

      if (error) throw error;
      setHandoffs((data as unknown as CuttingHandoff[]) || []);
    } catch (error) {
      console.error("Error fetching cutting handoffs:", error);
      toast.error("Failed to load cutting handoffs");
    } finally {
      setLoading(false);
    }
  }

  async function acknowledgeHandoff(handoff: CuttingHandoff) {
    if (!user?.id) return;
    setAcknowledging(true);

    try {
      const { error } = await supabase
        .from("cutting_actuals")
        .update({
          acknowledged: true,
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", handoff.id);

      if (error) throw error;

      toast.success("Handoff acknowledged successfully");
      setSelectedHandoff(null);
      fetchHandoffs();
    } catch (error) {
      console.error("Error acknowledging handoff:", error);
      toast.error("Failed to acknowledge handoff");
    } finally {
      setAcknowledging(false);
    }
  }

  const stats = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayHandoffs = handoffs.filter(h => h.production_date === today);
    const unacknowledged = handoffs.filter(h => !h.acknowledged);
    const totalCutting = todayHandoffs.reduce((sum, h) => sum + (h.day_cutting || 0), 0);
    const totalInput = todayHandoffs.reduce((sum, h) => sum + (h.day_input || 0), 0);

    return {
      todayCount: todayHandoffs.length,
      unacknowledgedCount: unacknowledged.length,
      totalCutting,
      totalInput,
    };
  }, [handoffs]);

  if (loading && handoffs.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile?.factory_id) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <p className="text-muted-foreground">No factory assigned</p>
      </div>
    );
  }

  if (!isAdminOrHigher() && userLineIds.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <div className="text-center">
          <Scissors className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Lines Assigned</h2>
          <p className="text-muted-foreground">
            You don't have any sewing lines assigned. Contact your supervisor to get line assignments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4 px-4 space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Scissors className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Cutting Handoffs</h1>
            <p className="text-sm text-muted-foreground">
              Cut bundles/panels transferred to your sewing lines
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchHandoffs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            {isAdminOrHigher() && <SelectItem value="all">All Time</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Today's Handoffs</p>
            <p className="text-2xl font-bold">{stats.todayCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Unacknowledged</p>
            <p className="text-2xl font-bold text-amber-500">{stats.unacknowledgedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cutting Today</p>
            <p className="text-2xl font-bold">{stats.totalCutting.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Input Today</p>
            <p className="text-2xl font-bold">{stats.totalInput.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cutting Submissions for Your Lines</CardTitle>
        </CardHeader>
        <CardContent>
          {handoffs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Scissors className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No cutting handoffs found for the selected period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>PO / Style</TableHead>
                    <TableHead>Colour</TableHead>
                    <TableHead className="text-right">Day Cutting</TableHead>
                    <TableHead className="text-right">Day Input</TableHead>
                    <TableHead>To Line</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {handoffs.map((handoff) => (
                    <TableRow 
                      key={handoff.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedHandoff(handoff)}
                    >
                      <TableCell className="font-medium">
                        {format(new Date(handoff.production_date), "dd MMM")}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">{handoff.po_no || "-"}</p>
                          <p className="text-xs text-muted-foreground">{handoff.style || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>{handoff.colour || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {handoff.day_cutting?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {handoff.day_input?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell>
                        {handoff.transfer_line?.name || handoff.transfer_line?.line_id || "-"}
                      </TableCell>
                      <TableCell>
                        {handoff.acknowledged ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <Check className="h-3 w-3 mr-1" />
                            Received
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedHandoff} onOpenChange={() => setSelectedHandoff(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cutting Handoff Details</DialogTitle>
            <DialogDescription>
              {selectedHandoff?.po_no} - {selectedHandoff?.buyer}
            </DialogDescription>
          </DialogHeader>
          
          {selectedHandoff && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(selectedHandoff.production_date), "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">PO Number</p>
                  <p className="font-medium">{selectedHandoff.po_no || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Buyer</p>
                  <p className="font-medium">{selectedHandoff.buyer || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Style</p>
                  <p className="font-medium">{selectedHandoff.style || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Colour</p>
                  <p className="font-medium">{selectedHandoff.colour || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Order Qty</p>
                  <p className="font-medium">{selectedHandoff.order_qty?.toLocaleString() || "-"}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Production Data</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">DAY CUTTING</p>
                    <p className="text-xl font-bold">{selectedHandoff.day_cutting?.toLocaleString() || 0}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">DAY INPUT</p>
                    <p className="text-xl font-bold">{selectedHandoff.day_input?.toLocaleString() || 0}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">TOTAL CUTTING</p>
                    <p className="text-lg font-bold">{selectedHandoff.total_cutting?.toLocaleString() || 0}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">TOTAL INPUT</p>
                    <p className="text-lg font-bold">{selectedHandoff.total_input?.toLocaleString() || 0}</p>
                  </div>
                </div>
                <div className={`mt-3 p-3 rounded-lg text-center ${(selectedHandoff.balance ?? 0) < 0 ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                  <p className="text-xs text-muted-foreground">BALANCE</p>
                  <p className={`text-xl font-bold ${(selectedHandoff.balance ?? 0) < 0 ? 'text-destructive' : ''}`}>
                    {selectedHandoff.balance?.toLocaleString() || 0}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Transfer Info</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">From</p>
                    <p className="font-medium">Cutting</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">To</p>
                    <p className="font-medium">
                      {selectedHandoff.transfer_line?.name || selectedHandoff.transfer_line?.line_id || "-"}
                    </p>
                  </div>
                  {selectedHandoff.submitted_at && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Submitted At</p>
                      <p className="font-medium">
                        {format(new Date(selectedHandoff.submitted_at), "dd MMM yyyy, hh:mm a")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Acknowledgement Section */}
              <div className="border-t pt-4">
                {selectedHandoff.acknowledged ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Check className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Received</p>
                      {selectedHandoff.acknowledged_at && (
                        <p className="text-xs text-green-600">
                          Acknowledged on {format(new Date(selectedHandoff.acknowledged_at), "dd MMM yyyy, hh:mm a")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Button 
                    className="w-full"
                    onClick={() => acknowledgeHandoff(selectedHandoff)}
                    disabled={acknowledging}
                  >
                    {acknowledging ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Acknowledging...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Acknowledge Received
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
