// frontend/src/api/dashboard.ts
import { apiGet } from "./apiClient";

export interface DashboardStats {
  totalUsers: number;
  activeFlows: number;
  openCases: number;
  totalCases: number;
  overdueTasks?: number;
  pendingApprovals?: number;
  activeEscalations?: number;
  avgDurationMs: number;
  casesByStatus: Record<string, number | undefined>;
}

export interface ActivityByHour {
  hour: string;
  count: number;
}

export interface VolumeByDay {
  date?: string;
  day: string;
  count: number;
}

export interface ChartData {
  activityByHour: ActivityByHour[];
  volumeByDay: VolumeByDay[];
  statusBreakdown: { name: string; value: number; color: string }[];
}

/**
 * Fetch dashboard statistics
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>("/dashboard/stats");
}

/**
 * Fetch dashboard chart data
 */
export async function fetchDashboardCharts(): Promise<ChartData> {
  return apiGet<ChartData>("/dashboard/charts");
}
