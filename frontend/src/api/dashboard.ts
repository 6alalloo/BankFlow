// frontend/src/api/dashboard.ts
import { apiGet } from "./apiClient";

export interface DashboardStats {
  totalUsers: number;
  activeWorkflows: number;
  executions24h: number;
  totalExecutions: number;
  avgDurationMs: number;
  executionsByStatus: {
    completed: number;
    failed: number;
    running: number;
    engine_error: number;
  };
}

export interface ActivityByHour {
  hour: string;
  count: number;
}

export interface VolumeByDay {
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
