import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Factory, Package, Search, Download, RefreshCw, FileText, Calendar, Target, ClipboardCheck, Scissors, TrendingUp, AlertTriangle } from "lucide-react";
import { TableSkeleton, StatsCardsSkeleton } from "@/components/ui/table-skeleton";
import { SubmissionDetailModal } from "@/components/SubmissionDetailModal";
import { TargetDetailModal } from "@/components/TargetDetailModal";
import { ExportSubmissionsDialog } from "@/components/ExportSubmissionsDialog";
import { CuttingSubmissionsTable } from "@/components/submissions/CuttingSubmissionsTable";
import { FinishingDailySheetsTable } from "@/components/submissions/FinishingDailySheetsTable";
import { StorageSubmissionsTable } from "@/components/submissions/StorageSubmissionsTable";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";
import { useSortableTable } from "@/hooks/useSortableTable";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { toast } from "sonner";
import { formatShortDate, formatTime } from "@/lib/date-utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// Types for targets
interface SewingTarget {
  id: string;
  line_id: string;
  per_hour_target: number;
  manpower_planned: number;
  ot_hours_planned: number;
  planned_stage_progress: number;
  next_milestone: string | null;
  remarks: string | null;
  submitted_at: string;
  production_date: string;
  is_late: boolean | null;
  stages: { name: string } | null;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string; order_qty: number } | null;
}

interface FinishingTarget {
  id: string;
  line_id: string;
  per_hour_target: number;
  m_power_planned: number;
  day_hour_planned: number;
  day_over_time_planned: number;
  remarks: string | null;
  submitted_at: string;
  production_date: string;
  is_late: boolean | null;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string; order_qty: number } | null;
}

// Types for actuals/end of day
interface SewingActual {
  id: string;
  line_id: string;
  good_today: number;
  reject_today: number;
  rework_today: number;
  cumulative_good_total: number;
  manpower_actual: number;
  ot_hours_actual: number;
  actual_stage_progress: number;
  has_blocker: boolean;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  remarks: string | null;
  submitted_at: string;
  production_date: string;
  stages: { name: string } | null;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string; order_qty: number } | null;
}

interface FinishingActual {
  id: string;
  line_id: string;
  day_qc_pass: number;
  total_qc_pass: number;
  day_poly: number;
  total_poly: number;
  day_carton: number;
  total_carton: number;
  m_power_actual: number;
  day_hour_actual: number;
  day_over_time_actual: number;
  average_production: number | null;
  has_blocker: boolean;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  remarks: string | null;
  submitted_at: string;
  production_date: string;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string; order_qty: number } | null;
}

type CategoryType = 'targets' | 'actuals';
type DepartmentType = 'sewing' | 'finishing' | 'cutting' | 'storage';

export default function AllSubmissions() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  
  // Initialize state from URL params or defaults
  const initialDepartment = (searchParams.get('department') as DepartmentType) || 'sewing';
  const initialCategory = (searchParams.get('category') as CategoryType) || 'targets';
  
  const [category, setCategory] = useState<CategoryType>(initialCategory);
  const [department, setDepartment] = useState<DepartmentType>(initialDepartment);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("7");

  // Target data
  const [sewingTargets, setSewingTargets] = useState<SewingTarget[]>([]);
  const [finishingTargets, setFinishingTargets] = useState<FinishingTarget[]>([]);

  // Actual data
  const [sewingActuals, setSewingActuals] = useState<SewingActual[]>([]);
  const [finishingActuals, setFinishingActuals] = useState<FinishingActual[]>([]);

  // Cutting and Storage data for export
  const [cuttingTargets, setCuttingTargets] = useState<any[]>([]);
  const [cuttingActuals, setCuttingActuals] = useState<any[]>([]);
  const [storageBinCards, setStorageBinCards] = useState<any[]>([]);

  // Finishing log counts (reported by FinishingDailySheetsTable)
  const [finishingLogCounts, setFinishingLogCounts] = useState({ targets: 0, outputs: 0 });

  // Modal state
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [selectedActual, setSelectedActual] = useState<any>(null);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [actualModalOpen, setActualModalOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    if (profile?.factory_id) {
      fetchSubmissions();
    }
  }, [profile?.factory_id, dateRange]);

  async function fetchSubmissions() {
    if (!profile?.factory_id) return;
    setLoading(true);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(dateRange));

    try {
      const [
        sewingTargetsRes,
        finishingTargetsRes,
        sewingActualsRes,
        finishingActualsRes,
        cuttingTargetsRes,
        cuttingActualsRes,
        storageBinCardsRes,
      ] = await Promise.all([
        supabase
          .from('sewing_targets')
          .select('*, stages:planned_stage_id(name), lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('finishing_targets')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('sewing_actuals')
          .select('*, stages:actual_stage_id(name), lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('finishing_actuals')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('cutting_targets')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('cutting_actuals')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('storage_bin_cards')
          .select('*, work_orders(po_number, buyer, style)')
          .eq('factory_id', profile.factory_id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false }),
      ]);

      setSewingTargets(sewingTargetsRes.data || []);
      setFinishingTargets(finishingTargetsRes.data || []);
      setSewingActuals(sewingActualsRes.data || []);
      setFinishingActuals(finishingActualsRes.data || []);
      setCuttingTargets(cuttingTargetsRes.data || []);
      setCuttingActuals(cuttingActualsRes.data || []);
      setStorageBinCards(storageBinCardsRes.data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }

  // Filter functions
  const filterBySearch = <T extends { lines?: { line_id: string; name: string | null } | null; work_orders?: { po_number: string; buyer?: string } | null }>(items: T[]) => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item =>
      (item.lines?.name || item.lines?.line_id || '').toLowerCase().includes(term) ||
      (item.work_orders?.po_number || '').toLowerCase().includes(term) ||
      (item.work_orders?.buyer || '').toLowerCase().includes(term)
    );
  };

  // Get current sewing data based on category
  const sewingData = useMemo(() => {
    if (category === 'targets') {
      return filterBySearch(sewingTargets);
    } else {
      return filterBySearch(sewingActuals);
    }
  }, [category, sewingTargets, sewingActuals, searchTerm]);

  // Sort and paginate sewing targets
  const { sortedData: sortedSewingTargets, sortConfig: sewingTargetsSortConfig, requestSort: requestSewingTargetsSort } = useSortableTable(filterBySearch(sewingTargets), { column: "production_date", direction: "desc" });
  const { sortedData: sortedSewingActuals, sortConfig: sewingActualsSortConfig, requestSort: requestSewingActualsSort } = useSortableTable(filterBySearch(sewingActuals), { column: "production_date", direction: "desc" });
  const sewingTargetsPagination = usePagination(sortedSewingTargets, { pageSize });
  const sewingActualsPagination = usePagination(sortedSewingActuals, { pageSize });

  // Use the appropriate pagination based on category
  const pagination = category === 'targets' ? sewingTargetsPagination : sewingActualsPagination;
  const { currentPage, totalPages, setCurrentPage, goToFirstPage, goToLastPage, goToNextPage, goToPreviousPage, canGoNext, canGoPrevious, startIndex, endIndex } = pagination;

  // Summary stats
  const getCounts = () => ({
    sewingTargets: sewingTargets.length,
    finishingTargets: finishingTargets.length,
    sewingActuals: sewingActuals.length,
    finishingActuals: finishingActuals.length,
  });

  const counts = getCounts();

  // Sewing KPI stats
  const sewingKpiStats = useMemo(() => {
    if (category === 'targets') {
      const targets = sewingTargets as SewingTarget[];
      const totalManpower = targets.reduce((s, t) => s + (t.manpower_planned || 0), 0);
      const avgTarget = targets.length > 0
        ? Math.round(targets.reduce((s, t) => s + t.per_hour_target, 0) / targets.length)
        : 0;
      const uniqueLines = new Set(targets.map(t => t.lines?.name || t.lines?.line_id)).size;
      return { count: targets.length, metric1: avgTarget, metric1Label: 'Avg Target/hr', metric2: totalManpower, metric2Label: 'Total Manpower', metric3: uniqueLines, metric3Label: 'Lines' };
    } else {
      const actuals = sewingActuals as SewingActual[];
      const totalOutput = actuals.reduce((s, a) => s + (a.good_today || 0), 0);
      const totalRejects = actuals.reduce((s, a) => s + (a.reject_today || 0), 0);
      const avgOutput = actuals.length > 0 ? Math.round(totalOutput / actuals.length) : 0;
      return { count: actuals.length, metric1: avgOutput, metric1Label: 'Avg Output', metric2: totalOutput, metric2Label: 'Total Output', metric3: totalRejects, metric3Label: 'Total Rejects' };
    }
  }, [category, sewingTargets, sewingActuals]);

  // Build daily output trend from sewing actuals
  const sewingDailyTrend = useMemo(() => {
    if (sewingActuals.length === 0) return [];
    const byDate: Record<string, { output: number; rejects: number }> = {};
    for (const a of sewingActuals) {
      const d = a.production_date;
      if (!byDate[d]) byDate[d] = { output: 0, rejects: 0 };
      byDate[d].output += a.good_today || 0;
      byDate[d].rejects += a.reject_today || 0;
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date,
        displayDate: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        output: vals.output,
        rejects: vals.rejects,
      }));
  }, [sewingActuals]);

  const handleTargetClick = (target: SewingTarget | FinishingTarget) => {
    setSelectedTarget({
      ...target,
      type: department,
      stage_name: 'stages' in target ? target.stages?.name || null : null,
    });
    setTargetModalOpen(true);
  };

  const handleActualClick = (actual: SewingActual | FinishingActual) => {
    setSelectedActual({
      id: actual.id,
      type: department,
      line_name: actual.lines?.name || actual.lines?.line_id || 'Unknown',
      po_number: actual.work_orders?.po_number || null,
      buyer: actual.work_orders?.buyer,
      style: actual.work_orders?.style,
      has_blocker: actual.has_blocker,
      blocker_description: actual.blocker_description,
      blocker_impact: actual.blocker_impact,
      blocker_owner: actual.blocker_owner,
      blocker_status: null,
      submitted_at: actual.submitted_at,
      production_date: actual.production_date,
      remarks: actual.remarks,
      ...(department === 'sewing' && {
        output_qty: (actual as SewingActual).good_today,
        reject_qty: (actual as SewingActual).reject_today,
        rework_qty: (actual as SewingActual).rework_today,
        manpower: (actual as SewingActual).manpower_actual,
        stage_name: (actual as SewingActual).stages?.name || null,
        stage_progress: (actual as SewingActual).actual_stage_progress,
        next_milestone: null,
        ot_hours: (actual as SewingActual).ot_hours_actual,
      }),
      ...(department === 'finishing' && {
        day_qc_pass: (actual as FinishingActual).day_qc_pass,
        total_qc_pass: (actual as FinishingActual).total_qc_pass,
        day_poly: (actual as FinishingActual).day_poly,
        total_poly: (actual as FinishingActual).total_poly,
        day_carton: (actual as FinishingActual).day_carton,
        total_carton: (actual as FinishingActual).total_carton,
        m_power: (actual as FinishingActual).m_power_actual,
        average_production: (actual as FinishingActual).average_production,
      }),
    });
    setActualModalOpen(true);
  };

  const getExportData = () => ({
    sewingTargets: filterBySearch(sewingTargets),
    finishingTargets: filterBySearch(finishingTargets),
    sewingActuals: filterBySearch(sewingActuals),
    finishingActuals: filterBySearch(finishingActuals),
    cuttingTargets,
    cuttingActuals,
    storageBinCards,
  });

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            All Submissions
          </h1>
          <p className="text-muted-foreground">
            View and export historical targets and end of day data
          </p>
        </div>
        <StatsCardsSkeleton count={4} />
        <TableSkeleton columns={9} rows={8} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            All Submissions
          </h1>
          <p className="text-muted-foreground">
            View and export historical targets and end of day data
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="21">Last 21 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchSubmissions}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setExportDialogOpen(true)}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Department Selection - Primary Tabs */}
      <div className="grid grid-cols-4 gap-3">
        <Button
          variant={department === 'storage' ? 'default' : 'outline'}
          className="h-14 flex flex-col gap-0.5"
          onClick={() => setDepartment('storage')}
        >
          <Package className="h-4 w-4" />
          <span className="font-semibold text-sm">Storage</span>
        </Button>
        <Button
          variant={department === 'cutting' ? 'default' : 'outline'}
          className="h-14 flex flex-col gap-0.5"
          onClick={() => setDepartment('cutting')}
        >
          <Scissors className="h-4 w-4" />
          <span className="font-semibold text-sm">Cutting</span>
        </Button>
        <Button
          variant={department === 'sewing' ? 'default' : 'outline'}
          className="h-14 flex flex-col gap-0.5"
          onClick={() => setDepartment('sewing')}
        >
          <Factory className="h-4 w-4" />
          <span className="font-semibold text-sm">Sewing</span>
        </Button>
        <Button
          variant={department === 'finishing' ? 'default' : 'outline'}
          className="h-14 flex flex-col gap-0.5"
          onClick={() => setDepartment('finishing')}
        >
          <Package className="h-4 w-4" />
          <span className="font-semibold text-sm">Finishing</span>
        </Button>
      </div>

      {/* Category Selection - For Sewing and Finishing */}
      {(department === 'sewing' || department === 'finishing') && (
        <div className="flex justify-center gap-2">
          <Button
            variant={category === 'targets' ? 'default' : 'outline'}
            onClick={() => setCategory('targets')}
            size="sm"
            className={`gap-1.5 ${
              category === 'targets'
                ? 'shadow-md'
                : 'hover:bg-primary/10 hover:border-primary/50'
            }`}
          >
            <Target className="h-4 w-4" />
            <span className="font-medium">Morning Targets</span>
            <Badge
              variant={category === 'targets' ? 'secondary' : 'outline'}
              className={`ml-0.5 text-xs ${category === 'targets' ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
            >
              {department === 'sewing' ? counts.sewingTargets : finishingLogCounts.targets}
            </Badge>
          </Button>
          <Button
            variant={category === 'actuals' ? 'default' : 'outline'}
            onClick={() => setCategory('actuals')}
            size="sm"
            className={`gap-1.5 ${
              category === 'actuals'
                ? 'shadow-md'
                : 'hover:bg-primary/10 hover:border-primary/50'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            <span className="font-medium">End of Day</span>
            <Badge
              variant={category === 'actuals' ? 'secondary' : 'outline'}
              className={`ml-0.5 text-xs ${category === 'actuals' ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
            >
              {department === 'sewing' ? counts.sewingActuals : finishingLogCounts.outputs}
            </Badge>
          </Button>
        </div>
      )}

      {/* Finishing daily logs (targets + outputs from finishing_daily_logs table) */}
      {department === 'finishing' && profile?.factory_id && (
        <FinishingDailySheetsTable
          factoryId={profile.factory_id}
          dateRange={dateRange}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeTab={category === 'targets' ? 'targets' : 'outputs'}
          onCountsChange={setFinishingLogCounts}
        />
      )}

      {/* Cutting submissions */}
      {department === 'cutting' && profile?.factory_id && (
        <CuttingSubmissionsTable
          factoryId={profile.factory_id}
          dateRange={dateRange}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      )}

      {/* Storage bin cards */}
      {department === 'storage' && profile?.factory_id && (
        <StorageSubmissionsTable
          factoryId={profile.factory_id}
          dateRange={dateRange}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      )}

      {/* Sewing uses existing view */}
      {department === 'sewing' && (
        <>
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by line, PO, or buyer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Submissions</p>
                </div>
                <div className="text-2xl font-bold text-primary">{sewingKpiStats.count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{sewingKpiStats.metric1Label}</p>
                </div>
                <div className="text-2xl font-bold text-primary">{sewingKpiStats.metric1.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{sewingKpiStats.metric2Label}</p>
                </div>
                <div className="text-2xl font-bold text-primary">{sewingKpiStats.metric2.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  {category === 'actuals' ? (
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Factory className="h-4 w-4 text-muted-foreground" />
                  )}
                  <p className="text-xs text-muted-foreground">{sewingKpiStats.metric3Label}</p>
                </div>
                <div className={`text-2xl font-bold ${category === 'actuals' && sewingKpiStats.metric3 > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {sewingKpiStats.metric3.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Output Trend Chart */}
          {sewingDailyTrend.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Daily Output Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={sewingDailyTrend}>
                    <defs>
                      <linearGradient id="colorSewingOutput" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="displayDate" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={40} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="output"
                      name="Output"
                      stroke="hsl(var(--primary))"
                      fill="url(#colorSewingOutput)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="rejects"
                      name="Rejects"
                      stroke="hsl(var(--destructive))"
                      fill="hsl(var(--destructive))"
                      fillOpacity={0.1}
                      strokeWidth={1.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Data Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {category === 'targets' ? (
                  <Target className="h-4 w-4 text-primary" />
                ) : (
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                )}
                Sewing {category === 'targets' ? 'Targets' : 'End of Day'}
                <Badge variant="secondary" className="ml-2">{sewingData.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {category === 'targets' && (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <SortableTableHead column="production_date" sortConfig={sewingTargetsSortConfig} onSort={requestSewingTargetsSort}>Date</SortableTableHead>
                        <TableHead>Time</TableHead>
                        <SortableTableHead column="lines.name" sortConfig={sewingTargetsSortConfig} onSort={requestSewingTargetsSort}>Line</SortableTableHead>
                        <TableHead>PO</TableHead>
                        <SortableTableHead column="work_orders.buyer" sortConfig={sewingTargetsSortConfig} onSort={requestSewingTargetsSort}>Buyer</SortableTableHead>
                        <SortableTableHead column="per_hour_target" sortConfig={sewingTargetsSortConfig} onSort={requestSewingTargetsSort} className="text-right">Target/hr</SortableTableHead>
                        <SortableTableHead column="manpower_planned" sortConfig={sewingTargetsSortConfig} onSort={requestSewingTargetsSort} className="text-right">Manpower</SortableTableHead>
                        <SortableTableHead column="planned_stage_progress" sortConfig={sewingTargetsSortConfig} onSort={requestSewingTargetsSort} className="text-right">Progress</SortableTableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sewingTargetsPagination.paginatedData.map((target) => (
                        <TableRow
                          key={target.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleTargetClick(target)}
                        >
                          <TableCell className="font-mono text-sm">{formatShortDate(target.production_date)}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{formatTime(target.submitted_at)}</TableCell>
                          <TableCell className="font-medium">{target.lines?.name || target.lines?.line_id}</TableCell>
                          <TableCell>{target.work_orders?.po_number || '-'}</TableCell>
                          <TableCell>{target.work_orders?.buyer || '-'}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{target.per_hour_target}</TableCell>
                          <TableCell className="text-right">{target.manpower_planned}</TableCell>
                          <TableCell className="text-right">{target.planned_stage_progress}%</TableCell>
                          <TableCell>
                            {target.is_late ? (
                              <StatusBadge variant="warning" size="sm">Late</StatusBadge>
                            ) : (
                              <StatusBadge variant="success" size="sm">On Time</StatusBadge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {sewingTargetsPagination.paginatedData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No sewing targets found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}

                {category === 'actuals' && (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <SortableTableHead column="production_date" sortConfig={sewingActualsSortConfig} onSort={requestSewingActualsSort}>Date</SortableTableHead>
                        <TableHead>Time</TableHead>
                        <SortableTableHead column="lines.name" sortConfig={sewingActualsSortConfig} onSort={requestSewingActualsSort}>Line</SortableTableHead>
                        <TableHead>PO</TableHead>
                        <SortableTableHead column="work_orders.buyer" sortConfig={sewingActualsSortConfig} onSort={requestSewingActualsSort}>Buyer</SortableTableHead>
                        <SortableTableHead column="good_today" sortConfig={sewingActualsSortConfig} onSort={requestSewingActualsSort} className="text-right">Good Today</SortableTableHead>
                        <SortableTableHead column="cumulative_good_total" sortConfig={sewingActualsSortConfig} onSort={requestSewingActualsSort} className="text-right">Cumulative</SortableTableHead>
                        <SortableTableHead column="manpower_actual" sortConfig={sewingActualsSortConfig} onSort={requestSewingActualsSort} className="text-right">Manpower</SortableTableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sewingActualsPagination.paginatedData.map((actual) => (
                        <TableRow
                          key={actual.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleActualClick(actual)}
                        >
                          <TableCell className="font-mono text-sm">{formatShortDate(actual.production_date)}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{formatTime(actual.submitted_at)}</TableCell>
                          <TableCell className="font-medium">{actual.lines?.name || actual.lines?.line_id}</TableCell>
                          <TableCell>{actual.work_orders?.po_number || '-'}</TableCell>
                          <TableCell>{actual.work_orders?.buyer || '-'}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{actual.good_today.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{actual.cumulative_good_total.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{actual.manpower_actual}</TableCell>
                          <TableCell>
                            {actual.has_blocker ? (
                              <StatusBadge variant="danger" size="sm">Blocker</StatusBadge>
                            ) : (
                              <StatusBadge variant="success" size="sm">OK</StatusBadge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {sewingActualsPagination.paginatedData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No sewing end of day data found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={sewingData.length}
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
        </>
      )}

      {/* Target Detail Modal */}
      <TargetDetailModal
        target={selectedTarget}
        open={targetModalOpen}
        onOpenChange={setTargetModalOpen}
      />

      {/* Actual Detail Modal */}
      <SubmissionDetailModal
        submission={selectedActual}
        open={actualModalOpen}
        onOpenChange={setActualModalOpen}
        onDeleted={fetchSubmissions}
        onUpdated={fetchSubmissions}
      />

      {/* Export Dialog */}
      <ExportSubmissionsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        data={getExportData()}
        dateRange={dateRange}
      />
    </div>
  );
}
