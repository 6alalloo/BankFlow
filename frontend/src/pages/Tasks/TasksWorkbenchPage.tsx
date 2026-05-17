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
  if (status === "completed") return "mint";
  if (status === "overdue") return "ember";
  if (["claimed", "assigned", "pending"].includes(status)) return "sky";
  return "secondary";
};

const formatDate = (value?: string | null) => {
  if (!value) return "No due date";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Invalid date" : parsed.toLocaleString();
};

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
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#040506] p-6 text-[#9c9c9d]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-white">My Tasks</h1>
          <p className="text-sm text-[#9c9c9d]">Assigned, claimable, and overdue operational work.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleSlaSweep} disabled={busy === "sla"}>
          <FiRefreshCw className={`size-3.5 ${busy === "sla" ? "animate-spin" : ""}`} />
          {busy === "sla" ? "Checking..." : "Process SLA"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[#ff6363]/20 bg-[#452324]/40 p-4 text-sm text-[#ff6363]">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setActiveFilter(filter.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeFilter === filter.key
                ? "bg-white text-[#040506]"
                : "border border-white/[0.08] bg-[#111214] text-[#9c9c9d] hover:border-white/[0.18] hover:text-white"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#07080a] p-6 text-sm">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#07080a] p-8 text-center">
          <FiCheckCircle className="mx-auto mb-3 text-[#59d499]" size={24} />
          <div className="text-sm font-medium text-white">No tasks in this queue</div>
          <div className="mt-1 text-xs text-[#6a6b6c]">Switch filters or process SLA to refresh overdue work.</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07080a]">
          <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr] gap-3 border-b border-white/[0.08] px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-[#6a6b6c]">
            <span>Task</span>
            <span>Case</span>
            <span>Due</span>
            <span className="text-right">Action</span>
          </div>
          {tasks.map((task) => (
            <div
              key={task.id}
              data-testid={`task-row-${task.id}`}
              className="grid grid-cols-1 gap-3 border-b border-white/[0.04] px-4 py-4 last:border-b-0 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr] md:items-center"
            >
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(task.status)}>{task.status.replace(/_/g, " ")}</Badge>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#6a6b6c]">{task.task_type}</span>
                </div>
                <div className="truncate text-sm font-medium text-white">{task.title}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[#6a6b6c]">
                  <FiUserCheck />
                  {task.assigned_user?.full_name || task.assigned_team?.name || "Unassigned claim queue"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/cases/${task.case_id}`)}
                className="flex min-w-0 items-center gap-2 text-left text-xs text-[#9c9c9d] hover:text-white"
              >
                <FiBriefcase className="shrink-0 text-[#6a6b6c]" />
                <span className="truncate font-mono">{task.case?.case_reference || `Case #${task.case_id}`}</span>
              </button>
              <div className="flex items-center gap-2 text-xs text-[#9c9c9d]">
                {task.status === "overdue" ? <FiAlertTriangle className="text-[#ff6363]" /> : <FiClock className="text-[#6a6b6c]" />}
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
