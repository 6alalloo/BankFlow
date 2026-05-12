import React, { useEffect, useState } from "react";
import { FiAlertTriangle, FiBriefcase, FiCheckSquare, FiClock, FiRefreshCw, FiShield, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { createCase, fetchCases, type CaseSummary } from "../../api/cases";
import { fetchTasks, processOverdueWork, type TasksQuery } from "../../api/tasks";
import { fetchApprovals } from "../../api/approvals";
import type { CaseApproval, CaseTask } from "../../api/cases";
import { fetchFlows, type FlowApi } from "../../api/flows";

const queueFilters: Array<{ key: string; label: string; query: { status?: string } }> = [
  { key: "all", label: "All Cases", query: {} },
  { key: "pending_action", label: "Pending Action", query: { status: "pending_action" } },
  { key: "pending_approval", label: "Pending Approval", query: { status: "pending_approval" } },
  { key: "escalated", label: "Escalated", query: { status: "escalated" } },
  { key: "resolved", label: "Resolved", query: { status: "resolved" } },
];

const formatCaseDateTime = (value: string) => new Date(value).toLocaleString();

const CasesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [approvals, setApprovals] = useState<CaseApproval[]>([]);
  const [flows, setFlows] = useState<FlowApi[]>([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingSla, setRefreshingSla] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createFlowId, setCreateFlowId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createPriority, setCreatePriority] = useState<"low" | "normal" | "high" | "critical">("normal");
  const [createData, setCreateData] = useState("{\n  \n}");
  const [creatingCase, setCreatingCase] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const filter = queueFilters.find((item) => item.key === activeFilter);
        const taskQuery: TasksQuery = activeFilter === "all" ? { overdue: true } : { overdue: true };
        const [caseRows, taskRows, approvalRows, flowRows] = await Promise.all([
          fetchCases(filter?.query ?? {}),
          fetchTasks(taskQuery),
          fetchApprovals({ status: "requested" }),
          fetchFlows(),
        ]);
        setCases(caseRows);
        setTasks(taskRows);
        setApprovals(approvalRows);
        setFlows(flowRows.filter((flow) => flow.status === "published" && Boolean(flow.current_published_version)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cases");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [activeFilter]);

  const handleProcessOverdue = async () => {
    try {
      setRefreshingSla(true);
      await processOverdueWork();
      const [taskRows, caseRows] = await Promise.all([
        fetchTasks({ overdue: true }),
        fetchCases(queueFilters.find((item) => item.key === activeFilter)?.query ?? {}),
      ]);
      setTasks(taskRows);
      setCases(caseRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process overdue work");
    } finally {
      setRefreshingSla(false);
    }
  };

  const handleCreateCase = async () => {
    try {
      setCreatingCase(true);
      setError(null);
      const flowId = Number(createFlowId);
      if (!Number.isInteger(flowId)) throw new Error("Choose a published flow.");

      const trimmed = createData.trim();
      let caseData: Record<string, unknown> | undefined;
      if (trimmed && trimmed !== "{}") {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Case data must be a JSON object.");
        }
        caseData = parsed as Record<string, unknown>;
      }

      const created = await createCase({
        flowId,
        title: createTitle.trim() || undefined,
        priority: createPriority,
        intakeSource: "manual",
        caseData,
      });
      setIsCreateOpen(false);
      setCreateFlowId("");
      setCreateTitle("");
      setCreatePriority("normal");
      setCreateData("{\n  \n}");
      navigate(`/cases/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setCreatingCase(false);
    }
  };

  return (
    <div className="p-4 p-md-5">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h3 text-white mb-1">Cases</h1>
          <p className="text-zinc-400 mb-0">Live BankFlow case records and operational status.</p>
        </div>
        <button
          type="button"
          onClick={handleProcessOverdue}
          disabled={refreshingSla}
          className="btn btn-outline-warning btn-sm d-flex align-items-center gap-2"
        >
          <FiRefreshCw /> {refreshingSla ? "Checking?" : "Process SLA"}
        </button>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="btn btn-info btn-sm d-flex align-items-center gap-2"
        >
          <FiBriefcase /> New Case
        </button>
      </div>

      {loading && <div className="text-zinc-400">Loading cases?</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && (
        <>
        <div className="row g-3 mb-4">
          <div className="col-lg-6">
            <div className="border border-white/10 rounded-xl p-3 bg-white/[0.02] h-100">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h2 className="h6 text-white mb-0 d-flex align-items-center gap-2"><FiAlertTriangle /> Overdue Work</h2>
                <span className="badge bg-warning text-dark">{tasks.length}</span>
              </div>
              <div className="d-grid gap-2">
                {tasks.slice(0, 4).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => navigate(`/cases/${task.case_id}`)}
                    className="border border-white/10 rounded p-2 bg-zinc-950/20 text-start text-zinc-300 hover:border-warning/50"
                  >
                    <div className="fw-semibold text-white">{task.title}</div>
                    <div className="text-zinc-500 text-sm">{task.status} // due {task.due_at ? formatCaseDateTime(task.due_at) : "not set"}</div>
                  </button>
                ))}
                {tasks.length === 0 && <div className="text-zinc-500 text-sm">No overdue tasks.</div>}
              </div>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="border border-white/10 rounded-xl p-3 bg-white/[0.02] h-100">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h2 className="h6 text-white mb-0 d-flex align-items-center gap-2"><FiShield /> Pending Approvals</h2>
                <span className="badge bg-info text-dark">{approvals.length}</span>
              </div>
              <div className="d-grid gap-2">
                {approvals.slice(0, 4).map((approval) => (
                  <button
                    key={approval.id}
                    type="button"
                    onClick={() => navigate(`/cases/${approval.case_id}`)}
                    className="border border-white/10 rounded p-2 bg-zinc-950/20 text-start text-zinc-300 hover:border-info/50"
                  >
                    <div className="fw-semibold text-white">Approval #{approval.id}</div>
                    <div className="text-zinc-500 text-sm">{approval.flow_node_key || "approval"} // requested {formatCaseDateTime(approval.requested_at)}</div>
                  </button>
                ))}
                {approvals.length === 0 && <div className="text-zinc-500 text-sm">No pending approvals.</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mb-3">
          {queueFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`btn btn-sm ${activeFilter === filter.key ? "btn-info" : "btn-outline-secondary"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="d-grid gap-3">
          {cases.length === 0 ? (
            <div className="border border-white/10 rounded-xl p-4 text-zinc-400 bg-white/[0.02]">
              No cases have been created yet.
            </div>
          ) : (
            cases.map((caseItem) => (
              <button
                key={caseItem.id}
                type="button"
                onClick={() => navigate(`/cases/${caseItem.id}`)}
                className="border border-white/10 rounded-xl p-4 bg-white/[0.02] text-start hover:border-cyan-500/40 hover:bg-white/[0.04] transition-colors"
              >
                <div className="d-flex align-items-start justify-content-between gap-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 text-cyan-300 fw-semibold">
                    <FiBriefcase />
                    {caseItem.case_reference}
                  </div>
                    <div className="text-white mt-1">{caseItem.title || caseItem.case_type}</div>
                    <div className="text-zinc-500 text-sm mt-1">{caseItem.case_type}</div>
                  </div>
                  <div className="text-end">
                    <div className="badge bg-info text-dark text-uppercase">{caseItem.status}</div>
                    <div className="text-zinc-500 text-sm mt-2 text-uppercase">{caseItem.priority}</div>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-3 mt-3 text-zinc-400 text-sm">
                  <span className="d-flex align-items-center gap-1">
                    <FiUser />
                    {caseItem.assignee_user?.full_name || caseItem.assignee_team?.name || "Unassigned"}
                  </span>
                  <span className="d-flex align-items-center gap-1">
                    <FiClock />
                    {formatCaseDateTime(caseItem.opened_at)}
                  </span>
                  <span className="d-flex align-items-center gap-1">
                    <FiCheckSquare />
                    {caseItem.flow?.name || caseItem.case_type}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
        </>
      )}
      {isCreateOpen && (
        <>
          <button type="button" aria-label="Close case dialog" className="position-fixed top-0 start-0 w-100 h-100 bg-zinc-950 opacity-75 border-0 z-40" onClick={() => setIsCreateOpen(false)} />
          <div className="position-fixed top-50 start-50 translate-middle w-100 z-50" style={{ maxWidth: 620 }}>
            <div className="bg-[#0f172a] border border-zinc-800 rounded p-4 shadow-lg">
              <h2 className="h5 text-white mb-1">New Case</h2>
              <p className="text-zinc-400 text-sm mb-4">Start a live case from a published flow.</p>
              <div className="d-grid gap-3">
                <label>
                  <span className="text-zinc-500 text-xs text-uppercase font-mono">Published Flow</span>
                  <select
                    value={createFlowId}
                    onChange={(event) => setCreateFlowId(event.target.value)}
                    className="form-select bg-zinc-950 text-white border-secondary mt-1"
                  >
                    <option value="">Choose flow</option>
                    {flows.map((flow) => (
                      <option key={flow.id} value={flow.id}>{flow.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-zinc-500 text-xs text-uppercase font-mono">Title</span>
                  <input
                    value={createTitle}
                    onChange={(event) => setCreateTitle(event.target.value)}
                    className="form-control bg-zinc-950 text-white border-secondary mt-1"
                    placeholder="Optional case title"
                  />
                </label>
                <label>
                  <span className="text-zinc-500 text-xs text-uppercase font-mono">Priority</span>
                  <select
                    value={createPriority}
                    onChange={(event) => setCreatePriority(event.target.value as typeof createPriority)}
                    className="form-select bg-zinc-950 text-white border-secondary mt-1"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
                <label>
                  <span className="text-zinc-500 text-xs text-uppercase font-mono">Case Data JSON</span>
                  <textarea
                    value={createData}
                    onChange={(event) => setCreateData(event.target.value)}
                    rows={6}
                    className="form-control bg-zinc-950 text-white border-secondary mt-1 font-mono"
                  />
                </label>
              </div>
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setIsCreateOpen(false)} disabled={creatingCase}>
                  Cancel
                </button>
                <button type="button" className="btn btn-info" onClick={handleCreateCase} disabled={creatingCase}>
                  {creatingCase ? "Creating?" : "Create Case"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CasesListPage;
