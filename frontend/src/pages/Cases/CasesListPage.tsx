import React, { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiBriefcase, FiCheckSquare, FiClock, FiRefreshCw, FiSearch, FiShield, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { createCase, fetchCases, type CaseSummary } from "../../api/cases";
import { fetchTasks, processOverdueWork, type TasksQuery } from "../../api/tasks";
import { fetchApprovals } from "../../api/approvals";
import type { CaseApproval, CaseTask } from "../../api/cases";
import { fetchFlows, type FlowApi } from "../../api/flows";
import { Badge, type BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { buildObjectFromFields, getCaseFields } from "../../utils/caseForms";

const terminalStatuses = new Set(["resolved", "closed", "cancelled"]);

const queueFilters: Array<{ key: string; label: string; query: { status?: string }; clientFilter?: (caseItem: CaseSummary) => boolean }> = [
  { key: "active", label: "Open Work", query: {}, clientFilter: (caseItem) => !terminalStatuses.has(caseItem.status) },
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
      return 'success';
    case 'escalated':
      return 'danger';
    case 'pending_approval':
      return 'future';
    default:
      return 'secondary';
  }
};

const priorityBadgeVariant = (priority: string): BadgeVariant => {
  switch (priority) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'outline';
    default:
      return 'secondary';
  }
};

const formatCaseDateTime = (value: string) => new Date(value).toLocaleString();

function formatLabel(raw: string): string {
  if (!raw) return "";
  const spaced = raw.replace(/[_\-.]+/g, " ");
  const camelSpaced = spaced.replace(/([a-z])([A-Z])/g, "$1 $2");
  return camelSpaced
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const CasesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [approvals, setApprovals] = useState<CaseApproval[]>([]);
  const [flows, setFlows] = useState<FlowApi[]>([]);
  const [activeFilter, setActiveFilter] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingSla, setRefreshingSla] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createFlowId, setCreateFlowId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createPriority, setCreatePriority] = useState<"low" | "normal" | "high" | "critical">("normal");
  const [createFieldValues, setCreateFieldValues] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingCase, setCreatingCase] = useState(false);

  const selectedFlow = useMemo(
    () => flows.find((flow) => flow.id === Number(createFlowId)),
    [flows, createFlowId]
  );
  const caseFields = useMemo(() => getCaseFields(selectedFlow?.case_type), [selectedFlow?.case_type]);

  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.case_reference.toLowerCase().includes(q) ||
        (c.title?.toLowerCase().includes(q)) ||
        c.case_type.toLowerCase().includes(q)
    );
  }, [cases, searchQuery]);

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
        setCases(filter?.clientFilter ? caseRows.filter(filter.clientFilter) : caseRows);
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
      const filter = queueFilters.find((item) => item.key === activeFilter);
      setCases(filter?.clientFilter ? caseRows.filter(filter.clientFilter) : caseRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process overdue work");
    } finally {
      setRefreshingSla(false);
    }
  };

  const handleCreateCase = async () => {
    try {
      setCreatingCase(true);
      setCreateError(null);
      if (!createFlowId) throw new Error("Choose a published flow.");
      const flowId = Number(createFlowId);
      if (!Number.isInteger(flowId) || flowId <= 0) throw new Error("Choose a published flow.");

      const caseData = buildObjectFromFields(caseFields, createFieldValues);

      const created = await createCase({
        flowId,
        title: createTitle.trim() || undefined,
        priority: createPriority,
        intakeSource: "manual",
        caseData: Object.keys(caseData).length > 0 ? caseData : undefined,
      });
      setIsCreateOpen(false);
      setCreateFlowId("");
      setCreateTitle("");
      setCreatePriority("normal");
      setCreateFieldValues({});
      setCreateError(null);
      navigate(`/cases/${created.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setCreatingCase(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-[#0f1012] tracking-tight mb-1">Cases</h1>
          <p className="text-[#8f8f8f] text-sm">Live BankFlow case records and operational status.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleProcessOverdue}
            disabled={refreshingSla}
          >
            <FiRefreshCw className={`size-3.5 ${refreshingSla ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            {refreshingSla ? "Checking\u2026" : "Process SLA"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isCreateOpen}
            onClick={() => {
              setCreateError(null);
              setIsCreateOpen(true);
            }}
          >
            <FiBriefcase className="size-3.5" strokeWidth={1.5} />
            New Case
          </Button>
        </div>
      </div>

      {loading && <div className="text-[#8f8f8f] text-sm">Loading cases&hellip;</div>}
      {error && (
        <div className="mb-4 p-4 rounded-[10px] bg-[#ffebee] border border-[#b71c1c]/15 text-[#b71c1c] text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FiAlertTriangle className="text-[#b71c1c]" strokeWidth={1.5} />
                Overdue Work
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => navigate("/tasks")}
                  className="mb-2 text-left text-xs font-normal text-[#8f8f8f] hover:text-[#0f1012] transition-colors"
                >
                  Open My Tasks
                </button>
                {tasks.slice(0, 4).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => navigate(`/cases/${task.case_id}`)}
                    className="w-full border border-[#0f1012]/[0.06] rounded-[10px] p-3 bg-[#0f1012]/[0.02] text-left text-[#8f8f8f] hover:border-[#0f1012]/[0.14] hover:bg-[#0f1012]/[0.04] transition-all"
                  >
                    <div className="font-medium text-[#0f1012] text-sm">{task.title}</div>
                    <div className="text-[#868788] text-xs mt-0.5">{formatLabel(task.status)} <span className="text-[#0f1012]/20">//</span> due {task.due_at ? formatCaseDateTime(task.due_at) : "not set"}</div>
                  </button>
                ))}
                {tasks.length === 0 && <div className="text-[#868788] text-sm">No overdue tasks.</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FiShield className="text-[#8f8f8f]" strokeWidth={1.5} />
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => navigate("/approvals")}
                  className="mb-2 text-left text-xs font-normal text-[#8f8f8f] hover:text-[#0f1012] transition-colors"
                >
                  Open Approvals Inbox
                </button>
                {approvals.slice(0, 4).map((approval) => (
                  <button
                    key={approval.id}
                    type="button"
                    onClick={() => navigate(`/cases/${approval.case_id}`)}
                    className="w-full border border-[#0f1012]/[0.06] rounded-[10px] p-3 bg-[#0f1012]/[0.02] text-left text-[#8f8f8f] hover:border-[#0f1012]/[0.14] hover:bg-[#0f1012]/[0.04] transition-all"
                  >
                    <div className="font-medium text-[#0f1012] text-sm">Approval #{approval.id}</div>
                    <div className="text-[#868788] text-xs mt-0.5">{approval.flow_node_key || "approval"} <span className="text-[#0f1012]/20">//</span> requested {formatCaseDateTime(approval.requested_at)}</div>
                  </button>
                ))}
                {approvals.length === 0 && <div className="text-[#868788] text-sm">No pending approvals.</div>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {queueFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`px-3.5 py-1.5 rounded-[10px] text-xs font-normal transition-all ${
                activeFilter === filter.key
                  ? "bg-[#0f1012] text-white"
                  : "border border-[#0f1012]/[0.08] bg-[#0f1012]/[0.03] text-[#8f8f8f] hover:border-[#0f1012]/[0.14] hover:text-[#0f1012] hover:bg-[#0f1012]/[0.05]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868788] size-4" strokeWidth={1.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by reference, title, or type…"
              className="w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] pl-9 pr-3 py-2.5 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredCases.length === 0 ? (
            <div className="border border-[#0f1012]/[0.06] rounded-[10px] p-6 text-[#8f8f8f] bg-[#fdfdfd] shadow-card">
              {cases.length === 0 ? "No cases have been created yet." : "No cases match your search."}
            </div>
          ) : (
            filteredCases.map((caseItem) => (
              <button
                key={caseItem.id}
                type="button"
                onClick={() => navigate(`/cases/${caseItem.id}`)}
                className="w-full border border-[#0f1012]/[0.06] rounded-[10px] p-5 bg-[#fdfdfd] text-left hover:border-[#0f1012]/[0.14] hover:bg-[#f2f2f4] transition-all shadow-card hover:shadow-elevated group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[#0f1012] font-medium mb-1">
                      <FiBriefcase className="shrink-0" strokeWidth={1.5} />
                      <span className="text-sm tabular-nums">{caseItem.case_reference}</span>
                    </div>
                    <div className="text-[#0f1012] text-sm">{caseItem.title || formatLabel(caseItem.case_type)}</div>
                    <div className="text-[#868788] text-xs mt-0.5">{formatLabel(caseItem.case_type)}</div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <Badge variant={statusBadgeVariant(caseItem.status)}>
                      {formatLabel(caseItem.status)}
                    </Badge>
                    <Badge variant={priorityBadgeVariant(caseItem.priority)}>
                      {formatLabel(caseItem.priority)}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-4 text-[#8f8f8f] text-xs">
                  <span className="flex items-center gap-1.5">
                    <FiUser className="text-[#868788]" strokeWidth={1.5} />
                    {caseItem.assignee_user?.full_name || caseItem.assignee_team?.name || "Unassigned"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FiClock className="text-[#868788]" strokeWidth={1.5} />
                    {formatCaseDateTime(caseItem.opened_at)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FiCheckSquare className="text-[#868788]" strokeWidth={1.5} />
                    {caseItem.flow?.name || formatLabel(caseItem.case_type)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
        </>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="new-case-title">
          <button type="button" aria-label="Close case dialog" className="absolute inset-0 bg-[#0f1012]/20 backdrop-blur-sm" onClick={() => setIsCreateOpen(false)} />
          <div className="relative z-10 w-full max-w-lg">
            <div className="max-h-[calc(100dvh-3rem)] overflow-y-auto custom-scrollbar rounded-[10px] bg-[#fdfdfd] border border-[#0f1012]/[0.08] shadow-elevated p-6">
              <h2 id="new-case-title" className="text-lg font-medium text-[#0f1012] mb-1">New Case</h2>
              <p className="text-[#8f8f8f] text-sm mb-6">Start a live case from a published flow.</p>
              {createError && (
                <div className="mb-4 rounded-[10px] border border-[#b71c1c]/15 bg-[#ffebee] p-3 text-sm text-[#b71c1c]">
                  {createError}
                </div>
              )}
              <div className="space-y-4">
                <label>
                  <span className="text-[#868788] text-[10px] uppercase tracking-wider">
                    Published Flow
                    <span className="ml-0.5 text-[#b71c1c]">*</span>
                  </span>
                  <select
                    value={createFlowId}
                    onChange={(event) => {
                      setCreateFlowId(event.target.value);
                      setCreateFieldValues({});
                    }}
                    className="mt-1.5 w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#020201] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                  >
                    <option value="">Choose flow</option>
                    {flows.map((flow) => (
                      <option key={flow.id} value={flow.id}>{flow.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-[#868788] text-[10px] uppercase tracking-wider">Title</span>
                  <input
                    value={createTitle}
                    onChange={(event) => setCreateTitle(event.target.value)}
                    className="mt-1.5 w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                    placeholder="Optional case title"
                  />
                </label>
                <label>
                  <span className="text-[#868788] text-[10px] uppercase tracking-wider">Priority</span>
                  <select
                    value={createPriority}
                    onChange={(event) => setCreatePriority(event.target.value as typeof createPriority)}
                    className="mt-1.5 w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#020201] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
                <div>
                  <span className="text-[#868788] text-[10px] uppercase tracking-wider">Case Fields</span>
                  <div className="mt-1.5 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {caseFields.map((field) => (
                      <label key={field.key}>
                        <span className="mb-1 block text-xs text-[#8f8f8f]">
                          {field.label}
                          <span className="ml-0.5 text-[#b71c1c]">*</span>
                        </span>
                        <input
                          value={createFieldValues[field.key] ?? ""}
                          onChange={(event) => setCreateFieldValues((current) => ({ ...current, [field.key]: event.target.value }))}
                          type={field.type === "number" ? "number" : "text"}
                          className="w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                          placeholder={field.placeholder}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={creatingCase}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleCreateCase} disabled={creatingCase}>
                  {creatingCase ? "Creating\u2026" : "Create Case"}
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
