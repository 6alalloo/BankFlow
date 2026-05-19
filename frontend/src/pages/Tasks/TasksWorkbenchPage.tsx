import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiBriefcase, FiCheckCircle, FiClock, FiRefreshCw, FiUserCheck } from "react-icons/fi";
import { claimTask, fetchTasks, processOverdueWork, type TasksQuery } from "../../api/tasks";
import type { CaseTask } from "../../api/cases";
import { Badge, Button, type BadgeVariant } from "../../components/ui";

const filters: Array<{ key: string; label: string; query: TasksQuery }> = [
  { key: "active", label: "Active", query: {} },
  { key: "claimable", label: "Claimable", query: { claimable: true } },
  { key: "overdue", label: "Overdue", query: { overdue: true } },
  { key: "completed", label: "Completed", query: { status: "completed" } },
];

const statusVariant = (status: string): BadgeVariant => {
  if (status === "completed") return "success";
  if (status === "overdue") return "danger";
  if (["claimed", "assigned", "pending"].includes(status)) return "future";
  return "secondary";
};

const formatDate = (value?: string | null) => {
  if (!value) return "No due date";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Invalid date" : parsed.toLocaleString();
};

function formatLabel(raw: string): string {
  if (!raw) return "";
  const spaced = raw.replace(/[_\-.]+/g, " ");
  const camelSpaced = spaced.replace(/([a-z])([A-Z])/g, "$1 $2");
  return camelSpaced
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const TasksWorkbenchPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("active");
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const currentFilter = useMemo(() => filters.find((filter) => filter.key === activeFilter) ?? filters[0], [activeFilter]);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const query = currentFilter.key === "active" ? {} : currentFilter.query;
      const rows = await fetchTasks(query);
      setTasks(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [currentFilter]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleClaim = async (task: CaseTask) => {
    try {
      setBusy(`claim-${task.id}`);
      await claimTask(task.id);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim task");
    } finally {
      setBusy(null);
    }
  };

  const handleSlaSweep = async () => {
    try {
      setBusy("sla");
      await processOverdueWork();
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process overdue work");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 text-[#8f8f8f]">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-medium text-[#0f1012] tracking-tight">My Tasks</h1>
          <p className="text-sm text-[#8f8f8f]">Assigned, claimable, and overdue operational work.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleSlaSweep} disabled={busy === "sla"}>
          <FiRefreshCw className={`size-3.5 ${busy === "sla" ? "animate-spin" : ""}`} strokeWidth={1.5} />
          {busy === "sla" ? "Checking..." : "Process SLA"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-[10px] border border-[#b71c1c]/15 bg-[#ffebee] p-4 text-sm text-[#b71c1c]">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setActiveFilter(filter.key)}
            className={`rounded-[10px] px-3.5 py-1.5 text-xs font-normal transition-all ${
              activeFilter === filter.key
                ? "bg-[#0f1012] text-white"
                : "border border-[#0f1012]/[0.08] bg-[#0f1012]/[0.03] text-[#8f8f8f] hover:border-[#0f1012]/[0.14] hover:text-[#0f1012] hover:bg-[#0f1012]/[0.05]"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-[10px] border border-[#0f1012]/[0.06] bg-[#fdfdfd] p-6 text-sm shadow-card">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-[10px] border border-[#0f1012]/[0.06] bg-[#fdfdfd] p-8 text-center shadow-card">
          <FiCheckCircle className="mx-auto mb-3 text-[#1b5e20]" size={24} strokeWidth={1.5} />
          <div className="text-sm font-medium text-[#0f1012]">No tasks in this queue</div>
          <div className="mt-1 text-xs text-[#868788]">Switch filters or process SLA to refresh overdue work.</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-[#0f1012]/[0.06] bg-[#fdfdfd] shadow-card">
          <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr] gap-3 border-b border-[#0f1012]/[0.06] px-5 py-3 text-[10px] uppercase tracking-widest text-[#868788]">
            <span>Task</span>
            <span>Case</span>
            <span>Due</span>
            <span className="text-right">Action</span>
          </div>
          {tasks.map((task) => (
            <div
              key={task.id}
              data-testid={`task-row-${task.id}`}
              className="grid grid-cols-1 gap-3 border-b border-[#0f1012]/[0.04] px-5 py-4 last:border-b-0 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr] md:items-center hover:bg-[#0f1012]/[0.01] transition-colors"
            >
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(task.status)}>{formatLabel(task.status)}</Badge>
                  <span className="text-[10px] uppercase tracking-wider text-[#868788]">{task.task_type}</span>
                </div>
                <div className="truncate text-sm font-medium text-[#0f1012]">{task.title}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[#868788]">
                  <FiUserCheck strokeWidth={1.5} />
                  {task.assigned_user?.full_name || task.assigned_team?.name || "Unassigned claim queue"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/cases/${task.case_id}`)}
                className="flex min-w-0 items-center gap-2 text-left text-xs text-[#8f8f8f] hover:text-[#0f1012] transition-colors"
              >
                <FiBriefcase className="shrink-0 text-[#868788]" strokeWidth={1.5} />
                <span className="truncate tabular-nums">{task.case?.case_reference || `Case #${task.case_id}`}</span>
              </button>
              <div className="flex items-center gap-2 text-xs text-[#8f8f8f]">
                {task.status === "overdue" ? <FiAlertTriangle className="text-[#b71c1c]" strokeWidth={1.5} /> : <FiClock className="text-[#868788]" strokeWidth={1.5} />}
                {formatDate(task.due_at)}
              </div>
              <div className="flex justify-start gap-2 md:justify-end">
                {["pending", "assigned"].includes(task.status) && task.claim_policy === "claim_required" && (
                  <Button variant="secondary" size="sm" onClick={() => handleClaim(task)} disabled={busy === `claim-${task.id}`}>
                    Claim
                  </Button>
                )}
                <Button variant="primary" size="sm" onClick={() => navigate(`/cases/${task.case_id}`)}>
                  Open Case
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TasksWorkbenchPage;
