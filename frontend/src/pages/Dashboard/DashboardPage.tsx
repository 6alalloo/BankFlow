import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchDashboardStats, fetchDashboardCharts, type DashboardStats, type ChartData } from "../../api/dashboard";
import { fetchCases, type CaseSummary, type CaseApproval, type CaseTask } from "../../api/cases";
import { fetchApprovals } from "../../api/approvals";
import { fetchTasks, processOverdueWork } from "../../api/tasks";
import {
  FiAlertTriangle,
  FiChevronRight,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiZap,
} from "react-icons/fi";

/* ── Mini Sparkline ── */
function Sparkline({ data, color = "#10b981", height = 50 }: { data: { value: number }[]; color?: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (d.value / max) * 80 - 10;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div style={{ height }} className="w-full">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon fill={`url(#grad-${color.replace("#", "")})`} points={`${points} 100,100 0,100`} />
        <polyline fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
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
  return `${days}d`;
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

const statusLabel: Record<string, string> = {
  resolved: "Resolved",
  closed: "Closed",
  escalated: "Escalated",
  pending_action: "Pending Action",
  pending_approval: "Pending Approval",
  in_review: "In Review",
  intake: "Intake",
  cancelled: "Cancelled",
};

function formatLabel(raw: string): string {
  if (!raw) return "";
  // Replace underscores, hyphens, and dots with spaces
  const spaced = raw.replace(/[_\-.]+/g, " ");
  // Handle camelCase by inserting space before capital letters
  const camelSpaced = spaced.replace(/([a-z])([A-Z])/g, "$1 $2");
  // Title case each word
  return camelSpaced
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const EXCLUDED_QUEUES = ["aml_alert", "payment_exception"];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role?.name === "Admin";

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0, activeFlows: 0, openCases: 0, totalCases: 0, avgDurationMs: 0,
    casesByStatus: { resolved: 0, closed: 0, escalated: 0, pending_action: 0, pending_approval: 0 },
  });
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [approvals, setApprovals] = useState<CaseApproval[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [chartData, setChartData] = useState<ChartData>({ activityByHour: [], volumeByDay: [], statusBreakdown: [] });
  const [activeQueue, setActiveQueue] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshingSla, setRefreshingSla] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setIsLoading(true);
        const [dashboardStats, charts, caseRows, approvalRows, taskRows] = await Promise.all([
          fetchDashboardStats(), fetchDashboardCharts(), fetchCases(),
          fetchApprovals({ status: "requested" }), fetchTasks({ overdue: true }),
        ]);
        if (!active) return;
        setStats(dashboardStats);
        setChartData(charts);
        setCases(caseRows);
        setApprovals(approvalRows);
        setTasks(taskRows);
      } catch (err) {
        if (active) console.warn("Failed to fetch dashboard data", err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    if (user) {
      load();
      const interval = setInterval(() => load(), 300000);
      return () => { active = false; clearInterval(interval); };
    }
  }, [user]);

  const queues = useMemo(() => {
    const types = new Set(cases.map((c) => c.case_type).filter(Boolean));
    const filtered = Array.from(types).filter((t) => !EXCLUDED_QUEUES.includes(t.toLowerCase()));
    return ["all", ...filtered.sort()];
  }, [cases]);

  const filteredCases = useMemo(() => {
    let rows = [...cases];
    if (activeQueue !== "all") rows = rows.filter((c) => c.case_type === activeQueue);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((c) => c.case_reference?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q) || c.case_type?.toLowerCase().includes(q));
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

  const pendingApprovalCount = approvals.length;
  const slaBreaches = tasks.length;

  const handleProcessOverdue = async () => {
    try {
      setRefreshingSla(true);
      await processOverdueWork();
      const [caseRows, taskRows] = await Promise.all([fetchCases(), fetchTasks({ overdue: true })]);
      setCases(caseRows);
      setTasks(taskRows);
    } catch (err) {
      console.error("Failed to process overdue work", err);
    } finally {
      setRefreshingSla(false);
    }
  };

  const volumeChartData = useMemo(() => chartData.volumeByDay.map((d) => ({ value: d.count })), [chartData.volumeByDay]);

  return (
    <div className="min-h-full bg-[#f3f4f6] overflow-auto custom-scrollbar">
      <div className="max-w-[1280px] mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm text-gray-500 mb-1">
              {currentTime.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Welcome back, {user?.email?.split("@")[0] || "there"}
            </h1>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          {/* Hero: Open Cases */}
          <div className="lg:col-span-1 rounded-2xl bg-white p-6 shadow-sm border border-gray-200/60">
            <div className="mb-1">
              <p className="text-sm text-gray-500 font-medium">Open Cases</p>
              <p className="text-4xl font-bold text-gray-900 tabular-nums tracking-tight mt-1">{stats.openCases}</p>
            </div>
            <div className="mt-4 mb-5">
              <Sparkline data={volumeChartData} color="#10b981" height={55} />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/cases")}
                className="flex-1 text-center py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
              >
                View Queue
              </button>
              <button
                type="button"
                onClick={handleProcessOverdue}
                disabled={refreshingSla}
                className="flex-1 text-center py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FiRefreshCw className={refreshingSla ? "animate-spin" : ""} size={14} />
                Process SLA
              </button>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-200/60 flex flex-col items-center justify-center text-center">
            <div className="p-3 rounded-xl bg-blue-50 mb-3">
              <FiShield className="text-blue-600" size={28} strokeWidth={1.5} />
            </div>
            <p className="text-base text-gray-500 font-medium">Pending Approvals</p>
            <p className="text-4xl font-bold text-gray-900 tabular-nums tracking-tight mt-1">{pendingApprovalCount}</p>
            <button
              type="button"
              onClick={() => navigate("/approvals")}
              className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Review <FiChevronRight size={14} />
            </button>
          </div>

          {/* SLA Breaches */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-200/60 flex flex-col items-center justify-center text-center">
            <div className="p-3 rounded-xl bg-red-50 mb-3">
              <FiAlertTriangle className="text-red-500" size={28} strokeWidth={1.5} />
            </div>
            <p className="text-base text-gray-500 font-medium">SLA Breaches</p>
            <p className="text-4xl font-bold text-gray-900 tabular-nums tracking-tight mt-1">{slaBreaches}</p>
            <button
              type="button"
              onClick={() => navigate("/tasks")}
              className="mt-4 text-sm font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              Resolve <FiChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* ── Quick Actions Bar ── */}
        <div className="flex items-center gap-3 mb-5 overflow-x-auto custom-scrollbar pb-1">
          <button
            onClick={() => navigate("/cases")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm shrink-0"
          >
            <FiPlus size={16} strokeWidth={2.5} />
            New Case
          </button>
          <button
            onClick={() => navigate("/flows")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-medium hover:bg-gray-50 transition-colors border border-gray-200/60 shadow-sm shrink-0"
          >
            <FiZap size={16} />
            Manage Flows
          </button>
          <button
            onClick={() => navigate("/approvals")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-medium hover:bg-gray-50 transition-colors border border-gray-200/60 shadow-sm shrink-0"
          >
            <FiShield size={16} />
            Approvals
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate("/admin/audit-logs")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-medium hover:bg-gray-50 transition-colors border border-gray-200/60 shadow-sm shrink-0"
            >
              <FiShield size={16} />
              Audit Logs
            </button>
          )}
        </div>

        {/* ── Main Content: Table ── */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-200/60 overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Case Queue</h2>
              <p className="text-sm text-gray-500 mt-0.5">{filteredCases.length} cases require attention</p>
            </div>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cases..."
                className="pl-10 pr-4 py-2 bg-gray-100 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 w-48"
              />
            </div>
          </div>

          {/* Queue Filter Pills */}
          <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 overflow-x-auto custom-scrollbar">
            {queues.map((q) => (
              <button
                key={q}
                onClick={() => setActiveQueue(q)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  activeQueue === q
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                  {q === "all" ? "All Queues" : formatLabel(q)}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
                <div className="size-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                <span className="text-sm font-medium">Loading cases...</span>
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <p className="text-sm font-medium">No cases match your filters</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Case</th>
                    <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Priority</th>
                    <th className="px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Age</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCases.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/cases/${c.id}`)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{c.case_reference}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[240px]">{c.title || c.case_type}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600">{formatLabel(c.case_type)}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-700 capitalize">{statusLabel[c.status] || c.status}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${
                          c.priority === "critical" ? "text-red-600" :
                          c.priority === "high" ? "text-amber-600" :
                          "text-gray-400"
                        }`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm text-gray-500 tabular-nums">{formatAge(c.opened_at)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <FiChevronRight className="inline-block text-gray-300 group-hover:text-gray-500 transition-colors" size={18} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
