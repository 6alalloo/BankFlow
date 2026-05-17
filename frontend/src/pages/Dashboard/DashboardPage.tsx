import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { apiGet } from "../../api/apiClient";
import { fetchDashboardStats, fetchDashboardCharts, type DashboardStats, type ChartData } from "../../api/dashboard";
import { fetchCases, type CaseSummary, type CaseApproval, type CaseTask } from "../../api/cases";
import { fetchApprovals } from "../../api/approvals";
import { fetchTasks, processOverdueWork } from "../../api/tasks";
import { Badge } from "../../components/ui";
import { Sparkline } from "../../components/Dashboard/DashboardCharts";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronRight,
  FiFilter,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiSidebar,
  FiX,
  FiXCircle,
  FiZap,
} from "react-icons/fi";

interface ApiAuditLog {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
}

function formatTimeAgo(dateString: string | Date) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatAge(dateString: string | Date) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

const statusSeverity: Record<string, number> = {
  escalated: 0,
  pending_action: 1,
  pending_approval: 2,
  in_review: 3,
  intake: 4,
  resolved: 5,
  closed: 6,
  cancelled: 7,
};

const prioritySeverity: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "resolved":
    case "closed":
      return "mint" as const;
    case "escalated":
      return "ember" as const;
    case "pending_approval":
      return "sky" as const;
    default:
      return "secondary" as const;
  }
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role?.name === "Admin";

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeFlows: 0,
    openCases: 0,
    totalCases: 0,
    avgDurationMs: 0,
    casesByStatus: {
      resolved: 0,
      closed: 0,
      escalated: 0,
      pending_action: 0,
      pending_approval: 0,
    },
  });

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [approvals, setApprovals] = useState<CaseApproval[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [auditLogs, setAuditLogs] = useState<ApiAuditLog[]>([]);

  const [chartData, setChartData] = useState<ChartData>({
    activityByHour: [],
    volumeByDay: [],
    statusBreakdown: [],
  });

  const [activeQueue, setActiveQueue] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [railOpen, setRailOpen] = useState(true);
  const [refreshingSla, setRefreshingSla] = useState(false);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Data fetch
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const [dashboardStats, charts, caseRows, approvalRows, taskRows] = await Promise.all([
          fetchDashboardStats(),
          fetchDashboardCharts(),
          fetchCases(),
          fetchApprovals({ status: "requested" }),
          fetchTasks({ overdue: true }),
        ]);
        setStats(dashboardStats);
        setChartData(charts);
        setCases(caseRows);
        setApprovals(approvalRows);
        setTasks(taskRows);

        if (isAdmin) {
          const res = await apiGet<{ data: ApiAuditLog[] }>("/audit?limit=8");
          setAuditLogs(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      load();
      const interval = setInterval(() => load(), 300000);
      return () => clearInterval(interval);
    }
  }, [user, isAdmin]);

  // Derived queues from actual case types
  const queues = useMemo(() => {
    const types = new Set(cases.map((c) => c.case_type).filter(Boolean));
    return ["all", ...Array.from(types).sort()];
  }, [cases]);

  // Filtered + sorted cases
  const filteredCases = useMemo(() => {
    let rows = [...cases];

    if (activeQueue !== "all") {
      rows = rows.filter((c) => c.case_type === activeQueue);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.case_reference?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q) ||
          c.case_type?.toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      const sevA = statusSeverity[a.status] ?? 99;
      const sevB = statusSeverity[b.status] ?? 99;
      if (sevA !== sevB) return sevA - sevB;

      const priA = prioritySeverity[a.priority] ?? 99;
      const priB = prioritySeverity[b.priority] ?? 99;
      if (priA !== priB) return priA - priB;

      return new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime();
    });

    return rows;
  }, [cases, activeQueue, searchQuery]);

  const escalatedCount = stats.casesByStatus.escalated ?? cases.filter((c) => c.status === "escalated").length;
  const resolvedCount = stats.casesByStatus.resolved ?? 0;
  const closedCount = stats.casesByStatus.closed ?? 0;
  const pendingApprovalCount = approvals.length;
  const slaBreaches = tasks.length;

  const handleProcessOverdue = async () => {
    try {
      setRefreshingSla(true);
      await processOverdueWork();
      const [caseRows, taskRows] = await Promise.all([
        fetchCases(),
        fetchTasks({ overdue: true }),
      ]);
      setCases(caseRows);
      setTasks(taskRows);
    } catch (err) {
      console.error("Failed to process overdue work", err);
    } finally {
      setRefreshingSla(false);
    }
  };

  const feedItems = isAdmin
    ? auditLogs.map((log) => ({
        id: log.id,
        label: log.action.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        meta: log.entity_type ? `${log.entity_type} #${log.entity_id}` : "System",
        time: formatTimeAgo(log.created_at),
        type: "system" as const,
      }))
    : cases.slice(0, 8).map((item) => ({
        id: item.id,
        label: item.status,
        meta: item.case_reference,
        time: formatTimeAgo(item.opened_at),
        type: "case" as const,
        status: item.status,
      }));

  return (
    <div className="h-full flex flex-col bg-[#040506] text-white font-sans overflow-hidden">
      {/* ── Top Ticker ── */}
      <div className="shrink-0 border-b border-white/[0.08] bg-[#07080a] px-6 py-2 flex items-center gap-6 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[#9c9c9d]" />
          <span className="text-[10px] text-[#6a6b6c] font-mono uppercase tracking-wider">Open</span>
          <span className="text-xs font-mono text-white font-semibold">{stats.openCases}</span>
        </div>
        <div className="w-px h-3 bg-white/[0.08]" />
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[#ff6363]" />
          <span className="text-[10px] text-[#6a6b6c] font-mono uppercase tracking-wider">Escalated</span>
          <span className="text-xs font-mono text-[#ff6363] font-semibold">{escalatedCount}</span>
        </div>
        <div className="w-px h-3 bg-white/[0.08]" />
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[#56c2ff]" />
          <span className="text-[10px] text-[#6a6b6c] font-mono uppercase tracking-wider">Pending Approval</span>
          <span className="text-xs font-mono text-[#56c2ff] font-semibold">{pendingApprovalCount}</span>
        </div>
        <div className="w-px h-3 bg-white/[0.08]" />
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[#ff6363] animate-pulse" />
          <span className="text-[10px] text-[#6a6b6c] font-mono uppercase tracking-wider">SLA Breach</span>
          <span className="text-xs font-mono text-[#ff6363] font-semibold">{slaBreaches}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] text-[#6a6b6c] font-mono uppercase tracking-widest">
            {currentTime.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" })}
          </span>
          <span className="text-xs font-mono text-white tracking-widest">
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>

      {/* ── Queue Tabs ── */}
      <div className="shrink-0 px-6 pt-4 pb-2 flex items-center gap-1 overflow-x-auto custom-scrollbar">
        {queues.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setActiveQueue(q)}
            className={`px-3 py-1 rounded-md text-[11px] font-medium font-mono uppercase tracking-wide transition-all whitespace-nowrap ${
              activeQueue === q
                ? "bg-white text-[#040506]"
                : "text-[#6a6b6c] hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            {q === "all" ? "All Queues" : q}
          </button>
        ))}
      </div>

      {/* ── Micro Cards + Sparkline ── */}
      <div className="shrink-0 px-6 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="p-3 bg-[#07080a] border border-white/[0.08] rounded-lg">
            <div className="text-lg font-semibold text-white font-mono">{stats.openCases}</div>
            <div className="text-[9px] text-[#6a6b6c] uppercase tracking-wider font-mono mt-0.5">Open Cases</div>
          </div>
          <div className="p-3 bg-[#07080a] border border-[#ff6363]/20 rounded-lg">
            <div className="text-lg font-semibold text-[#ff6363] font-mono">{escalatedCount}</div>
            <div className="text-[9px] text-[#6a6b6c] uppercase tracking-wider font-mono mt-0.5">Escalated</div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/approvals")}
            className="p-3 bg-[#07080a] border border-[#56c2ff]/20 rounded-lg text-left hover:border-[#56c2ff]/40 transition-colors"
          >
            <div className="text-lg font-semibold text-[#56c2ff] font-mono">{pendingApprovalCount}</div>
            <div className="text-[9px] text-[#6a6b6c] uppercase tracking-wider font-mono mt-0.5">Pending Approval</div>
          </button>
          <button
            type="button"
            onClick={() => navigate("/tasks")}
            className="p-3 bg-[#07080a] border border-[#ff6363]/20 rounded-lg text-left hover:border-[#ff6363]/40 transition-colors"
          >
            <div className="text-lg font-semibold text-[#ff6363] font-mono">{slaBreaches}</div>
            <div className="text-[9px] text-[#6a6b6c] uppercase tracking-wider font-mono mt-0.5">SLA Breaches</div>
          </button>
          <div className="p-3 bg-[#07080a] border border-white/[0.08] rounded-lg">
            <div className="text-lg font-semibold text-white font-mono">{stats.avgDurationMs > 0 ? `${Math.round(stats.avgDurationMs / 3600000)}h` : "—"}</div>
            <div className="text-[9px] text-[#6a6b6c] uppercase tracking-wider font-mono mt-0.5">Avg Case Age</div>
            <div className="text-[9px] text-[#9c9c9d] font-mono mt-1">
              {resolvedCount} resolved // {closedCount} closed
            </div>
          </div>
        </div>

        {/* Quick Actions + Sparkline */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate("/cases")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e6e6e6] text-[#040506] text-[11px] font-semibold hover:bg-white transition-colors shadow-raycast-key"
            >
              <FiPlus size={12} />
              New Case
            </button>
            <button
              type="button"
              onClick={handleProcessOverdue}
              disabled={refreshingSla}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111214] border border-white/[0.08] text-[#9c9c9d] text-[11px] font-medium hover:text-white hover:border-white/[0.18] transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={refreshingSla ? "animate-spin" : ""} size={12} />
              Process SLA
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate("/admin/audit-logs")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111214] border border-white/[0.08] text-[#9c9c9d] text-[11px] font-medium hover:text-white hover:border-white/[0.18] transition-colors"
              >
                <FiZap size={12} />
                Audit Logs
              </button>
            )}
          </div>

          <div className="flex-1 flex items-center gap-3 min-w-0">
            <div className="flex-1 min-w-0">
              <Sparkline
                data={chartData.volumeByDay.map((d) => ({ name: d.day ?? d.date ?? "", value: d.count }))}
                color="#9c9c9d"
                height={32}
              />
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[9px] text-[#6a6b6c] font-mono uppercase tracking-wider">7-Day Intake Trend</div>
              <div className="text-[10px] text-[#9c9c9d] font-mono">
                {chartData.volumeByDay.reduce((a, b) => a + b.count, 0)} total
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main + Right Rail ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Cases Table */}
        <div className="flex-1 overflow-auto custom-scrollbar px-6 pb-6">
          {/* Search + Count */}
          <div className="flex items-center gap-3 mb-3 sticky top-0 bg-[#040506] z-10 py-2">
            <div className="relative flex-1 max-w-xs">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6a6b6c]" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by reference, title..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#111214] border border-white/[0.08] rounded-lg text-xs text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] font-mono transition-all"
              />
            </div>
            <span className="text-[10px] text-[#6a6b6c] font-mono uppercase tracking-wider">
              {filteredCases.length} items
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-[10px] text-[#6a6b6c] hover:text-white font-mono transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-[#6a6b6c] gap-3">
              <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="font-mono text-xs uppercase tracking-widest">Loading Queue...</span>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#6a6b6c]">
              <FiFilter className="text-3xl mb-3 opacity-30" />
              <p className="font-mono text-xs uppercase tracking-widest">No Cases in Queue</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="pb-2 pt-1 text-[10px] font-mono text-[#6a6b6c] uppercase tracking-wider font-medium">Reference</th>
                  <th className="pb-2 pt-1 text-[10px] font-mono text-[#6a6b6c] uppercase tracking-wider font-medium pl-3">Type</th>
                  <th className="pb-2 pt-1 text-[10px] font-mono text-[#6a6b6c] uppercase tracking-wider font-medium pl-3">Status</th>
                  <th className="pb-2 pt-1 text-[10px] font-mono text-[#6a6b6c] uppercase tracking-wider font-medium pl-3">Priority</th>
                  <th className="pb-2 pt-1 text-[10px] font-mono text-[#6a6b6c] uppercase tracking-wider font-medium pl-3">Age</th>
                  <th className="pb-2 pt-1 text-[10px] font-mono text-[#6a6b6c] uppercase tracking-wider font-medium pl-3">Assigned</th>
                  <th className="pb-2 pt-1 text-[10px] font-mono text-[#6a6b6c] uppercase tracking-wider font-medium pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-1.5 rounded-full shrink-0 ${
                            c.status === "escalated"
                              ? "bg-[#ff6363]"
                              : c.status === "pending_action"
                              ? "bg-[#ff6363]/60"
                              : c.status === "pending_approval"
                              ? "bg-[#56c2ff]"
                              : c.status === "resolved" || c.status === "closed"
                              ? "bg-[#59d499]"
                              : "bg-[#6a6b6c]"
                          }`}
                        />
                        <span className="text-xs font-mono text-white tracking-wide">{c.case_reference}</span>
                      </div>
                      <div className="text-[10px] text-[#6a6b6c] truncate max-w-[200px] pl-3.5">{c.title || c.case_type}</div>
                    </td>
                    <td className="py-2.5 pl-3">
                      <span className="text-[11px] text-[#9c9c9d]">{c.case_type}</span>
                    </td>
                    <td className="py-2.5 pl-3">
                      <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>
                    </td>
                    <td className="py-2.5 pl-3">
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider ${
                          c.priority === "critical"
                            ? "text-[#ff6363]"
                            : c.priority === "high"
                            ? "text-[#9c9c9d]"
                            : "text-[#6a6b6c]"
                        }`}
                      >
                        {c.priority}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3">
                      <span className="text-[11px] font-mono text-[#9c9c9d]">{formatAge(c.opened_at)}</span>
                    </td>
                    <td className="py-2.5 pl-3">
                      <span className="text-[11px] text-[#9c9c9d]">
                        {c.assignee_user?.full_name || c.assignee_team?.name || (
                          <span className="text-[#6a6b6c]">—</span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <FiChevronRight className="inline-block text-[#363739] group-hover:text-[#9c9c9d] transition-colors" size={14} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Right Rail ── */}
        <div
          className={`shrink-0 border-l border-white/[0.08] bg-[#07080a] flex flex-col transition-all duration-300 ${
            railOpen ? "w-[300px]" : "w-0 overflow-hidden border-l-0"
          }`}
        >
          {/* Rail Toggle (visible when rail open) */}
          {railOpen && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08]">
              <span className="text-[10px] font-mono text-[#6a6b6c] uppercase tracking-widest">Operations Rail</span>
              <button
                type="button"
                onClick={() => setRailOpen(false)}
                className="p-1 text-[#6a6b6c] hover:text-white transition-colors"
                title="Collapse rail"
              >
                <FiX size={14} />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Pending Approvals */}
            {approvals.length > 0 && (
              <div className="p-4 border-b border-white/[0.08]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-mono text-[#6a6b6c] uppercase tracking-widest font-medium flex items-center gap-1.5">
                    <FiShield size={12} />
                    Pending Approvals
                  </h3>
                  <span className="text-[10px] font-mono text-[#56c2ff]">{approvals.length}</span>
                </div>
                <div className="space-y-2">
                  {approvals.slice(0, 5).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => navigate(`/cases/${a.case_id}`)}
                      className="w-full text-left p-2 rounded-md bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-white font-mono">Approval #{a.id}</span>
                        <FiChevronRight size={12} className="text-[#363739] group-hover:text-[#9c9c9d]" />
                      </div>
                      <div className="text-[10px] text-[#6a6b6c] mt-0.5 truncate">
                        {a.flow_node_key || "approval"} // Case #{a.case_id}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SLA Breaches */}
            {tasks.length > 0 && (
              <div className="p-4 border-b border-white/[0.08]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-mono text-[#6a6b6c] uppercase tracking-widest font-medium flex items-center gap-1.5">
                    <FiAlertTriangle size={12} className="text-[#ff6363]" />
                    SLA Breaches
                  </h3>
                  <span className="text-[10px] font-mono text-[#ff6363]">{tasks.length}</span>
                </div>
                <div className="space-y-2">
                  {tasks.slice(0, 5).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => navigate(`/cases/${t.case_id}`)}
                      className="w-full text-left p-2 rounded-md bg-[#452324]/20 border border-[#ff6363]/10 hover:border-[#ff6363]/25 transition-all group"
                    >
                      <div className="text-[11px] text-white truncate">{t.title}</div>
                      <div className="text-[10px] text-[#ff6363]/70 font-mono mt-0.5">
                        Due {t.due_at ? new Date(t.due_at).toLocaleDateString() : "overdue"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live Feed */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-mono text-[#6a6b6c] uppercase tracking-widest font-medium flex items-center gap-1.5">
                  <FiActivity size={12} />
                  Live Feed
                </h3>
                <span className="flex items-center gap-1">
                  <span className="size-1 rounded-full bg-[#59d499] animate-pulse" />
                  <span className="text-[9px] font-mono text-[#59d499]">LIVE</span>
                </span>
              </div>
              <div className="space-y-2">
                {feedItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 group">
                    <div className="shrink-0 mt-0.5">
                      {item.type === "system" ? (
                        <FiShield size={10} className="text-[#6a6b6c]" />
                      ) : item.status === "resolved" || item.status === "closed" ? (
                        <FiCheckCircle size={10} className="text-[#59d499]" />
                      ) : item.status === "escalated" ? (
                        <FiXCircle size={10} className="text-[#ff6363]" />
                      ) : (
                        <div className="size-1.5 rounded-full bg-[#6a6b6c] mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[#9c9c9d] truncate group-hover:text-white transition-colors">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-[#6a6b6c] font-mono truncate">{item.meta}</p>
                    </div>
                    <span className="text-[9px] text-[#6a6b6c] font-mono whitespace-nowrap mt-0.5">{item.time}</span>
                  </div>
                ))}
                {feedItems.length === 0 && (
                  <div className="text-[10px] text-[#6a6b6c] font-mono text-center py-4">No recent activity</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating rail toggle (when collapsed) */}
      {!railOpen && (
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          className="fixed right-4 bottom-4 z-30 p-2.5 bg-[#111214] border border-white/[0.08] rounded-lg shadow-raycast-ring text-[#9c9c9d] hover:text-white transition-colors"
          title="Open operations rail"
        >
          <FiSidebar size={16} />
        </button>
      )}
    </div>
  );
}
