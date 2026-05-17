import React, { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiBriefcase, FiCheckSquare, FiClock, FiRefreshCw, FiShield, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { createCase, fetchCases, type CaseSummary } from "../../api/cases";
import { fetchTasks, processOverdueWork, type TasksQuery } from "../../api/tasks";
import { fetchApprovals } from "../../api/approvals";
import type { CaseApproval, CaseTask } from "../../api/cases";
import { fetchFlows, type FlowApi } from "../../api/flows";
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, type BadgeVariant } from "../../components/ui";
import { buildObjectFromFields, getCaseFields } from "../../utils/caseForms";

const queueFilters: Array<{ key: string; label: string; query: { status?: string } }> = [
  { key: "all", label: "All Cases", query: {} },
  { key: "pending_action", label: "Pending Action", query: { status: "pending_action" } },
  { key: "pending_approval", label: "Pending Approval", query: { status: "pending_approval" } },
  { key: "escalated", label: "Escalated", query: { status: "escalated" } },
  { key: "resolved", label: "Resolved", query: { status: "resolved" } },
];

const statusBadgeVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'resolved':
    case 'closed':
      return 'mint';
    case 'escalated':
      return 'ember';
    case 'pending_approval':
      return 'sky';
    default:
      return 'secondary';
  }
};

const priorityBadgeVariant = (priority: string): BadgeVariant => {
  switch (priority) {
    case 'critical':
      return 'ember';
    case 'high':
      return 'outline';
    default:
      return 'secondary';
  }
};

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
  const [createFieldValues, setCreateFieldValues] = useState<Record<string, string>>({});
  const [creatingCase, setCreatingCase] = useState(false);

  const selectedFlow = useMemo(
    () => flows.find((flow) => flow.id === Number(createFlowId)),
    [flows, createFlowId]
  );
  const caseFields = useMemo(() => getCaseFields(selectedFlow?.case_type), [selectedFlow?.case_type]);

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
      const guidedData = buildObjectFromFields(caseFields, createFieldValues);
      if (trimmed && trimmed !== "{}") {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Case data must be a JSON object.");
        }
        caseData = { ...guidedData, ...(parsed as Record<string, unknown>) };
      } else {
        caseData = Object.keys(guidedData).length > 0 ? guidedData : undefined;
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
      setCreateFieldValues({});
      navigate(`/cases/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setCreatingCase(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white mb-1">Cases</h1>
          <p className="text-[#9c9c9d] text-sm">Live BankFlow case records and operational status.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleProcessOverdue}
            disabled={refreshingSla}
          >
            <FiRefreshCw className={`size-3.5 ${refreshingSla ? 'animate-spin' : ''}`} />
            {refreshingSla ? "Checking..." : "Process SLA"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
          >
            <FiBriefcase className="size-3.5" />
            New Case
          </Button>
        </div>
      </div>

      {loading && <div className="text-[#9c9c9d] text-sm">Loading cases...</div>}
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-[#452324]/40 border border-[#ff6363]/20 text-[#ff6363] text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FiAlertTriangle className="text-[#ff6363]" />
                Overdue Work
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => navigate("/tasks")}
                  className="mb-2 text-left text-xs font-medium text-[#9c9c9d] hover:text-white"
                >
                  Open My Tasks
                </button>
                {tasks.slice(0, 4).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => navigate(`/cases/${task.case_id}`)}
                    className="w-full border border-white/[0.08] rounded-lg p-3 bg-white/[0.02] text-left text-[#9c9c9d] hover:border-white/[0.18] hover:bg-white/[0.04] transition-all"
                  >
                    <div className="font-medium text-white text-sm">{task.title}</div>
                    <div className="text-[#6a6b6c] text-xs font-mono mt-0.5">{task.status} // due {task.due_at ? formatCaseDateTime(task.due_at) : "not set"}</div>
                  </button>
                ))}
                {tasks.length === 0 && <div className="text-[#6a6b6c] text-sm">No overdue tasks.</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FiShield className="text-[#9c9c9d]" />
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => navigate("/approvals")}
                  className="mb-2 text-left text-xs font-medium text-[#9c9c9d] hover:text-white"
                >
                  Open Approvals Inbox
                </button>
                {approvals.slice(0, 4).map((approval) => (
                  <button
                    key={approval.id}
                    type="button"
                    onClick={() => navigate(`/cases/${approval.case_id}`)}
                    className="w-full border border-white/[0.08] rounded-lg p-3 bg-white/[0.02] text-left text-[#9c9c9d] hover:border-white/[0.18] hover:bg-white/[0.04] transition-all"
                  >
                    <div className="font-medium text-white text-sm">Approval #{approval.id}</div>
                    <div className="text-[#6a6b6c] text-xs font-mono mt-0.5">{approval.flow_node_key || "approval"} // requested {formatCaseDateTime(approval.requested_at)}</div>
                  </button>
                ))}
                {approvals.length === 0 && <div className="text-[#6a6b6c] text-sm">No pending approvals.</div>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {queueFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === filter.key
                  ? "bg-white text-[#040506]"
                  : "bg-[#111214] text-[#9c9c9d] border border-white/[0.08] hover:border-white/[0.18] hover:text-white"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {cases.length === 0 ? (
            <div className="border border-white/[0.08] rounded-2xl p-6 text-[#9c9c9d] bg-[#07080a]">
              No cases have been created yet.
            </div>
          ) : (
            cases.map((caseItem) => (
              <button
                key={caseItem.id}
                type="button"
                onClick={() => navigate(`/cases/${caseItem.id}`)}
                className="w-full border border-white/[0.08] rounded-2xl p-5 bg-[#07080a] text-left hover:border-white/[0.18] hover:bg-[#111214] transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-white font-medium mb-1">
                      <FiBriefcase className="shrink-0" />
                      <span className="font-mono text-sm">{caseItem.case_reference}</span>
                    </div>
                    <div className="text-white text-sm">{caseItem.title || caseItem.case_type}</div>
                    <div className="text-[#6a6b6c] text-xs mt-0.5">{caseItem.case_type}</div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <Badge variant={statusBadgeVariant(caseItem.status)}>
                      {caseItem.status}
                    </Badge>
                    <Badge variant={priorityBadgeVariant(caseItem.priority)}>
                      {caseItem.priority}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-4 text-[#9c9c9d] text-xs">
                  <span className="flex items-center gap-1.5">
                    <FiUser className="text-[#6a6b6c]" />
                    {caseItem.assignee_user?.full_name || caseItem.assignee_team?.name || "Unassigned"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FiClock className="text-[#6a6b6c]" />
                    {formatCaseDateTime(caseItem.opened_at)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FiCheckSquare className="text-[#6a6b6c]" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button type="button" aria-label="Close case dialog" className="absolute inset-0 bg-[#040506]/80 backdrop-blur-sm" onClick={() => setIsCreateOpen(false)} />
          <div className="relative z-10 w-full max-w-lg">
            <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-white mb-1">New Case</h2>
              <p className="text-[#9c9c9d] text-sm mb-6">Start a live case from a published flow.</p>
              <div className="space-y-4">
                <label>
                  <span className="text-[#6a6b6c] text-[10px] uppercase font-mono tracking-wider">Published Flow</span>
                  <select
                    value={createFlowId}
                    onChange={(event) => {
                      setCreateFlowId(event.target.value);
                      setCreateFieldValues({});
                    }}
                    className="mt-1.5 w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                  >
                    <option value="" className="bg-[#111214]">Choose flow</option>
                    {flows.map((flow) => (
                      <option key={flow.id} value={flow.id} className="bg-[#111214]">{flow.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-[#6a6b6c] text-[10px] uppercase font-mono tracking-wider">Title</span>
                  <input
                    value={createTitle}
                    onChange={(event) => setCreateTitle(event.target.value)}
                    className="mt-1.5 w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                    placeholder="Optional case title"
                  />
                </label>
                <label>
                  <span className="text-[#6a6b6c] text-[10px] uppercase font-mono tracking-wider">Priority</span>
                  <select
                    value={createPriority}
                    onChange={(event) => setCreatePriority(event.target.value as typeof createPriority)}
                    className="mt-1.5 w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                  >
                    <option value="low" className="bg-[#111214]">Low</option>
                    <option value="normal" className="bg-[#111214]">Normal</option>
                    <option value="high" className="bg-[#111214]">High</option>
                    <option value="critical" className="bg-[#111214]">Critical</option>
                  </select>
                </label>
                <div>
                  <span className="text-[#6a6b6c] text-[10px] uppercase font-mono tracking-wider">Case Fields</span>
                  <div className="mt-1.5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {caseFields.map((field) => (
                      <label key={field.key}>
                        <span className="mb-1 block text-xs text-[#9c9c9d]">{field.label}</span>
                        <input
                          value={createFieldValues[field.key] ?? ""}
                          onChange={(event) => setCreateFieldValues((current) => ({ ...current, [field.key]: event.target.value }))}
                          type={field.type === "number" ? "number" : "text"}
                          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                          placeholder={field.placeholder}
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <label>
                  <span className="text-[#6a6b6c] text-[10px] uppercase font-mono tracking-wider">Additional Case Data JSON</span>
                  <textarea
                    value={createData}
                    onChange={(event) => setCreateData(event.target.value)}
                    rows={6}
                    className="mt-1.5 w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all resize-none"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={creatingCase}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleCreateCase} disabled={creatingCase}>
                  {creatingCase ? "Creating..." : "Create Case"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CasesListPage;
