import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Rows3, Search, CheckCircle2, XCircle, Clock } from "lucide-react";

interface LineWorkOrder {
  id: string;
  po_number: string;
  is_active: boolean;
  created_at: string | null;
}

interface Line {
  id: string;
  line_id: string;
  name: string | null;
  unit_name: string | null;
  floor_name: string | null;
  is_active: boolean;
  targetSubmitted: boolean;
  eodSubmitted: boolean;
  sewingOutput: number;
  finishingOutput: number;
  workOrders: LineWorkOrder[];
  selectedWoId: string | null;
}

interface RawData {
  lines: any[];
  sewingTargets: any[];
  sewingActuals: any[];
  finishingLogs: any[];
  workOrders: any[];
}

// Extract number from line_id for proper numerical sorting
function extractLineNumber(lineId: string): number {
  const match = lineId.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function loadSelectedPOs(factoryId: string): Record<string, string> {
  try {
    const stored = localStorage.getItem(`lines-po-selection-${factoryId}`);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export default function Lines() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<RawData | null>(null);
  const [selectedPOs, setSelectedPOs] = useState<Record<string, string>>(() =>
    profile?.factory_id ? loadSelectedPOs(profile.factory_id) : {}
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Reload saved selections when factory_id becomes available
  useEffect(() => {
    if (profile?.factory_id) {
      setSelectedPOs(loadSelectedPOs(profile.factory_id));
    }
  }, [profile?.factory_id]);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchLines();
    }
  }, [profile?.factory_id]);

  async function fetchLines() {
    if (!profile?.factory_id) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      const [linesRes, sewingTargetsRes, sewingActualsRes, finishingLogsRes, workOrdersRes] = await Promise.all([
        supabase
          .from('lines')
          .select('*, units(name), floors(name)')
          .eq('factory_id', profile.factory_id)
          .order('line_id'),
        supabase
          .from('sewing_targets')
          .select('line_id, work_order_id')
          .eq('factory_id', profile.factory_id)
          .eq('production_date', today),
        supabase
          .from('sewing_actuals')
          .select('line_id, work_order_id, good_today')
          .eq('factory_id', profile.factory_id)
          .eq('production_date', today),
        supabase
          .from('finishing_daily_logs')
          .select('line_id, work_order_id, log_type, poly, carton')
          .eq('factory_id', profile.factory_id)
          .eq('production_date', today),
        supabase
          .from('work_orders')
          .select('id, line_id, po_number, is_active, created_at')
          .eq('factory_id', profile.factory_id)
          .not('line_id', 'is', null),
      ]);

      setRawData({
        lines: linesRes.data || [],
        sewingTargets: sewingTargetsRes.data || [],
        sewingActuals: sewingActualsRes.data || [],
        finishingLogs: finishingLogsRes.data || [],
        workOrders: workOrdersRes.data || [],
      });
    } catch (error) {
      console.error('Error fetching lines:', error);
    } finally {
      setLoading(false);
    }
  }

  // Derive display lines from raw data + selected POs
  const lines = useMemo(() => {
    if (!rawData) return [];

    const { lines: linesData, sewingTargets, sewingActuals, finishingLogs, workOrders } = rawData;

    // Group work orders by line_id, sorted: active first, then most recent
    const lineWoMap = new Map<string, LineWorkOrder[]>();
    workOrders.forEach((wo: any) => {
      if (!wo.line_id) return;
      const list = lineWoMap.get(wo.line_id) || [];
      list.push({
        id: wo.id,
        po_number: wo.po_number,
        is_active: wo.is_active ?? false,
        created_at: wo.created_at,
      });
      lineWoMap.set(wo.line_id, list);
    });

    // Sort each group: active first, then by created_at descending
    lineWoMap.forEach((woList) => {
      woList.sort((a, b) => {
        if (a.is_active && !b.is_active) return -1;
        if (!a.is_active && b.is_active) return 1;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
    });

    // For each line, determine selected WO
    const lineSelectedWo = new Map<string, string>();
    lineWoMap.forEach((woList, lineId) => {
      const savedWoId = selectedPOs[lineId];
      if (savedWoId && woList.some(wo => wo.id === savedWoId)) {
        lineSelectedWo.set(lineId, savedWoId);
      } else if (woList.length > 0) {
        lineSelectedWo.set(lineId, woList[0].id); // default: active or most recent
      }
    });

    // Helper: check if a record matches the line's selected PO
    const matchesSelectedPO = (lineId: string, woId: string | null) => {
      const selectedWoId = lineSelectedWo.get(lineId);
      if (!selectedWoId) return true; // no WOs for this line — include all
      return woId === selectedWoId;
    };

    // Build target submitted set (PO-scoped)
    const targetSubmittedSet = new Set<string>();
    sewingTargets.forEach((t: any) => {
      if (matchesSelectedPO(t.line_id, t.work_order_id)) {
        targetSubmittedSet.add(t.line_id);
      }
    });
    finishingLogs.filter((l: any) => l.log_type === 'TARGET').forEach((t: any) => {
      if (matchesSelectedPO(t.line_id, t.work_order_id)) {
        targetSubmittedSet.add(t.line_id);
      }
    });

    // Build sewing EOD map (PO-scoped)
    const sewingEodMap = new Map<string, { submitted: boolean; output: number }>();
    sewingActuals.forEach((u: any) => {
      if (matchesSelectedPO(u.line_id, u.work_order_id)) {
        const existing = sewingEodMap.get(u.line_id) || { submitted: false, output: 0 };
        sewingEodMap.set(u.line_id, {
          submitted: true,
          output: existing.output + (u.good_today || 0),
        });
      }
    });

    // Build finishing EOD map (PO-scoped)
    const finishingEodMap = new Map<string, { submitted: boolean; output: number }>();
    finishingLogs.filter((l: any) => l.log_type === 'OUTPUT').forEach((u: any) => {
      if (matchesSelectedPO(u.line_id, u.work_order_id)) {
        const existing = finishingEodMap.get(u.line_id) || { submitted: false, output: 0 };
        finishingEodMap.set(u.line_id, {
          submitted: true,
          output: existing.output + (u.poly || 0) + (u.carton || 0),
        });
      }
    });

    const formattedLines: Line[] = linesData.map((line: any) => {
      const sewingEod = sewingEodMap.get(line.id);
      const finishingEod = finishingEodMap.get(line.id);
      const woList = lineWoMap.get(line.id) || [];
      return {
        id: line.id,
        line_id: line.line_id,
        name: line.name,
        unit_name: line.units?.name || null,
        floor_name: line.floors?.name || null,
        is_active: line.is_active,
        targetSubmitted: targetSubmittedSet.has(line.id),
        eodSubmitted: !!(sewingEod?.submitted || finishingEod?.submitted),
        sewingOutput: sewingEod?.output || 0,
        finishingOutput: finishingEod?.output || 0,
        workOrders: woList,
        selectedWoId: lineSelectedWo.get(line.id) || null,
      };
    });

    formattedLines.sort((a, b) => extractLineNumber(a.line_id) - extractLineNumber(b.line_id));
    return formattedLines;
  }, [rawData, selectedPOs]);

  function handlePOChange(lineId: string, woId: string) {
    setSelectedPOs(prev => {
      const next = { ...prev, [lineId]: woId };
      if (profile?.factory_id) {
        localStorage.setItem(`lines-po-selection-${profile.factory_id}`, JSON.stringify(next));
      }
      return next;
    });
  }

  const filteredLines = lines.filter(line =>
    (line.name || line.line_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (line.unit_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (line.floor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeLines = lines.filter(l => l.is_active);
  const targetsSubmitted = activeLines.filter(l => l.targetSubmitted).length;
  const eodSubmitted = activeLines.filter(l => l.eodSubmitted).length;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Rows3 className="h-6 w-6" />
          Production Lines
        </h1>
        <p className="text-muted-foreground">View line status and today's submissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{activeLines.length}</p>
            <p className="text-sm text-muted-foreground">Active Lines</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{targetsSubmitted}</p>
            <p className="text-sm text-muted-foreground">Targets Submitted</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-success">{eodSubmitted}</p>
            <p className="text-sm text-muted-foreground">EOD Submitted</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search lines..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lines Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Current PO</TableHead>
                  <TableHead className="text-center">Target Status</TableHead>
                  <TableHead className="text-center">EOD Status</TableHead>
                  <TableHead className="text-right">Sewing</TableHead>
                  <TableHead className="text-right">Finishing</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLines.map((line) => (
                  <TableRow key={line.id} className={!line.is_active ? 'opacity-50' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{line.name || line.line_id}</p>
                        {line.name && <p className="text-xs text-muted-foreground">{line.line_id}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{line.unit_name || '-'}</TableCell>
                    <TableCell>{line.floor_name || '-'}</TableCell>
                    <TableCell>
                      {line.workOrders.length > 1 ? (
                        <Select
                          value={line.selectedWoId || undefined}
                          onValueChange={(v) => handlePOChange(line.id, v)}
                        >
                          <SelectTrigger className="h-8 w-[140px] font-mono text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {line.workOrders.map(wo => (
                              <SelectItem key={wo.id} value={wo.id}>
                                <span className="font-mono">
                                  {wo.po_number}
                                  {wo.is_active && (
                                    <span className="ml-1 text-success">●</span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : line.workOrders.length === 1 ? (
                        <span className="font-mono text-sm">{line.workOrders[0].po_number}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {line.is_active ? (
                        line.targetSubmitted ? (
                          <StatusBadge variant="success" size="sm">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Submitted
                          </StatusBadge>
                        ) : (
                          <StatusBadge variant="warning" size="sm">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </StatusBadge>
                        )
                      ) : (
                        <StatusBadge variant="default" size="sm">-</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {line.is_active ? (
                        line.eodSubmitted ? (
                          <StatusBadge variant="success" size="sm">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Submitted
                          </StatusBadge>
                        ) : (
                          <StatusBadge variant="warning" size="sm">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </StatusBadge>
                        )
                      ) : (
                        <StatusBadge variant="default" size="sm">-</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {line.sewingOutput > 0 ? line.sewingOutput.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {line.finishingOutput > 0 ? line.finishingOutput.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {line.is_active ? (
                        <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No lines found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
