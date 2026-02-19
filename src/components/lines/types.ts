export type TimeRange = "daily" | "7" | "14" | "21" | "30";

export type AnomalyFlag = "no-output" | "critically-low" | "unusually-high" | null;

export interface POBreakdown {
  workOrderId: string;
  poNumber: string;
  buyer: string;
  style: string;
  item: string;
  isActive: boolean;
  target: number;
  output: number;
  achievementPct: number;
  targetContributionPct: number;
  outputContributionPct: number;
}

export interface LinePerformanceData {
  id: string;
  lineId: string;
  name: string | null;
  unitName: string | null;
  floorName: string | null;
  isActive: boolean;

  totalTarget: number;
  totalOutput: number;
  achievementPct: number;
  variance: number;
  avgManpower: number;
  totalBlockers: number;

  targetSubmitted: boolean;
  eodSubmitted: boolean;
  anomaly: AnomalyFlag;

  poBreakdown: POBreakdown[];
}

export interface DailyTrendPoint {
  date: string;
  displayDate: string;
  target: number;
  output: number;
  achievementPct: number;
  manpower: number;
  blockers: number;
}

export interface LineTrendData {
  daily: DailyTrendPoint[];
  poDaily: Record<string, { poNumber: string; points: DailyTrendPoint[] }>;
}

export interface LineFilters {
  searchTerm: string;
  unitFilter: string | null;
  floorFilter: string | null;
}

export interface FactorySummary {
  totalTarget: number;
  totalOutput: number;
  overallAchievement: number;
  linesOnTarget: number;
  linesBelowTarget: number;
  bestLine: { name: string; pct: number } | null;
  worstLine: { name: string; pct: number } | null;
}
