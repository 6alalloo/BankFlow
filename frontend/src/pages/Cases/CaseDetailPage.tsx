import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiDatabase,
  FiDownload,
  FiFileText,
  FiFolder,
  FiMessageSquare,
  FiUpload,
  FiX,
  FiZap,
} from "react-icons/fi";
import {
  addCaseNote,
  cancelCase,
  closeCase,
  createManualEscalation,
  fetchCaseById,
  resolveEscalation,
  type CaseDetail,
} from "../../api/cases";
import { approveApproval, rejectApproval } from "../../api/approvals";
import { claimTask, completeTask } from "../../api/tasks";
import { downloadCaseDocument, uploadCaseDocument } from "../../api/files";
import { fetchTeams, type Team, type TeamMemberUser } from "../../api/teams";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  buildObjectFromFields,
  formatDocumentType,
  getRequiredDocumentTypes,
  getTaskOutputFields,
} from "../../utils/caseForms";
import { useAuth } from "../../contexts/useAuth";
import { CaseHeader, CaseSummaryGrid } from "./CaseOverview";
import { formatDate, formatLabel, statusBadgeVariant } from "./caseDetailFormatters";

const terminalCaseStatuses = new Set(["resolved", "closed", "cancelled"]);

type TabKey = "tasks" | "documents" | "history" | "details";

function renderCaseDataValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-[#868788] italic">—</span>;
  }
  if (typeof value === "string") {
    return <span className="text-[#0f1012] break-words">{value}</span>;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return <span className="text-[#0f1012]">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[#868788] italic">Empty list</span>;
    return (
      <ul className="list-disc pl-4 space-y-1">
        {value.map((item, i) => (
          <li key={i}>{renderCaseDataValue(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-[#868788] italic">Empty</span>;
    return (
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="text-[#868788] text-[10px] uppercase tracking-wider mb-0.5">{k.replace(/[_-]/g, " ")}</div>
            <div className="text-[#0f1012]">{renderCaseDataValue(v)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-[#0f1012]">{String(value)}</span>;
}

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "tasks", label: "Tasks", icon: FiZap },
  { key: "documents", label: "Documents", icon: FiFolder },
  { key: "history", label: "History", icon: FiClock },
  { key: "details", label: "Details", icon: FiDatabase },
];

const CaseDetailPage: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const caseId = Number(id);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [taskDecisionById, setTaskDecisionById] = useState<Record<number, string>>({});
  const [taskOutputById, setTaskOutputById] = useState<Record<number, string>>({});
  const [taskFieldValuesById, setTaskFieldValuesById] = useState<Record<number, Record<string, string>>>({});
  const [approvalReasonById, setApprovalReasonById] = useState<Record<number, string>>({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [escalationTargetType, setEscalationTargetType] = useState<"team" | "user">("team");
  const [escalationTargetId, setEscalationTargetId] = useState("");
  const [escalationReason, setEscalationReason] = useState("");
  const [showEscalationForm, setShowEscalationForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const selectedFileRef = useRef<File | null>(null);

  const loadCase = useCallback(async () => {
    if (!Number.isInteger(caseId)) {
      setError("Invalid case id");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCaseById(caseId);
      setCaseDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load case");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  // Auto-expand the first actionable task
  useEffect(() => {
    if (!caseDetail) return;
    const firstActionable = caseDetail.tasks.find(
      (t) => ["pending", "assigned", "claimed", "overdue"].includes(t.status)
    );
    if (firstActionable) {
      setExpandedTaskId(firstActionable.id);
    }
  }, [caseDetail?.tasks.map((t) => t.id).join(",")]);

  const currentOwner = useMemo(() => {
    if (!caseDetail) return "Unassigned";
    return caseDetail.assignee_user?.full_name || caseDetail.assignee_team?.name || "Unassigned";
  }, [caseDetail]);
  const roleName = user?.role?.name;
  const isAuditor = roleName === "Auditor";
  const canManageCase = roleName === "Admin" || roleName === "Supervisor";

  useEffect(() => {
    if (isAuditor) return;
    let active = true;
    fetchTeams({ active: true })
      .then((rows) => {
        if (active) setTeams(rows);
      })
      .catch(() => {
        if (active) setTeams([]);
      });
    return () => {
      active = false;
    };
  }, [isAuditor]);

  const escalationUserOptions = useMemo(() => {
    const byId = new Map<number, TeamMemberUser>();
    teams.forEach((team) => {
      team.team_memberships?.forEach((membership) => {
        if (membership.users) byId.set(membership.users.id, membership.users);
      });
    });
    return Array.from(byId.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [teams]);

  const teamNameById = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const userNameById = useMemo(
    () => new Map(escalationUserOptions.map((member) => [member.id, member.full_name])),
    [escalationUserOptions]
  );

  const documentRequirementsByTaskId = useMemo(() => {
    const rows = new Map<number, { required: string[]; uploaded: string[]; missing: string[]; uploadedCount: number }>();
    if (!caseDetail) return rows;
    caseDetail.tasks.forEach((task) => {
      const required = getRequiredDocumentTypes(task.input_json);
      const taskDocuments = caseDetail.documents.filter((document) => document.task_id === task.id);
      const uploaded = taskDocuments
        .map((document) => document.document_type)
        .filter((documentType): documentType is string => Boolean(documentType));
      const uploadedSet = new Set(uploaded);
      rows.set(task.id, {
        required,
        uploaded,
        missing: required.filter((documentType) => !uploadedSet.has(documentType)),
        uploadedCount: taskDocuments.length,
      });
    });
    return rows;
  }, [caseDetail]);

  const selectedDocumentTaskId = selectedTaskId ? Number(selectedTaskId) : null;
  const selectedDocumentRequirements = selectedDocumentTaskId
    ? documentRequirementsByTaskId.get(selectedDocumentTaskId)
    : null;

  const refreshAfterAction = async (message: string) => {
    setActionSuccess(message);
    setActionError(null);
    await loadCase();
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    try {
      setBusyAction(key);
      setActionError(null);
      setActionSuccess(null);
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  };

  const handleCompleteTask = (taskId: number) => {
    void runAction(`task-${taskId}`, async () => {
      const rawOutput = taskOutputById[taskId]?.trim();
      const task = caseDetail?.tasks.find((item) => item.id === taskId);
      const outputFields = getTaskOutputFields(task?.task_type);
      let output: Record<string, unknown> = buildObjectFromFields(
        outputFields,
        taskFieldValuesById[taskId] ?? {}
      );
      if (rawOutput) {
        const parsed = JSON.parse(rawOutput) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Task output must be a valid object.");
        }
        output = { ...output, ...(parsed as Record<string, unknown>) };
      }
      await completeTask(taskId, {
        decision: taskDecisionById[taskId]?.trim() || undefined,
        output,
      });
      setExpandedTaskId(null);
      await refreshAfterAction("Task completed.");
    });
  };

  const handleUploadDocument = () => {
    void runAction("document-upload", async () => {
      const selectedFile = selectedFileRef.current;
      if (!selectedFile || !caseDetail) throw new Error("Choose a file before uploading.");
      await uploadCaseDocument({
        caseId: caseDetail.id,
        file: selectedFile,
        taskId: selectedTaskId ? Number(selectedTaskId) : null,
        documentType: documentType.trim() || null,
      });
      selectedFileRef.current = null;
      setDocumentType("");
      setSelectedTaskId("");
      await refreshAfterAction("Document uploaded.");
    });
  };

  const handleManualEscalation = () => {
    void runAction("manual-escalation", async () => {
      if (!caseDetail) throw new Error("Case detail is not loaded.");
      const reason = escalationReason.trim();
      if (!reason) throw new Error("Escalation reason is required.");
      const targetId = Number(escalationTargetId);
      if (!Number.isInteger(targetId) || targetId <= 0) {
        throw new Error("Choose an escalation target.");
      }
      await createManualEscalation(caseDetail.id, {
        reason,
        toTeamId: escalationTargetType === "team" ? targetId : null,
        toUserId: escalationTargetType === "user" ? targetId : null,
      });
      setEscalationReason("");
      setEscalationTargetId("");
      setEscalationTargetType("team");
      setShowEscalationForm(false);
      await refreshAfterAction("Case escalated.");
    });
  };

  if (loading) {
    return (
      <div className="p-6 text-[#8f8f8f]">
        <div className="animate-spin size-5 border-2 border-[#0f1012]/20 border-t-[#0071e3] rounded-full inline-block mr-2" />
        Loading case&hellip;
      </div>
    );
  }

  if (error || !caseDetail) {
    return (
      <div className="p-6">
        <Link to="/cases" className="text-[#8f8f8f] hover:text-[#0f1012] flex items-center gap-2 mb-4 transition-colors">
          <FiArrowLeft /> Cases
        </Link>
        <div className="p-4 rounded-[10px] bg-[#ffebee] border border-[#b71c1c]/20 text-[#b71c1c]">{error || "Case not found"}</div>
      </div>
    );
  }

  const canManualEscalate = !isAuditor && !terminalCaseStatuses.has(caseDetail.status);
  const escalationTargetOptions =
    escalationTargetType === "team"
      ? teams.map((team) => ({ id: team.id, label: team.name, meta: team.key }))
      : escalationUserOptions.map((member) => ({ id: member.id, label: member.full_name, meta: member.email }));

  const pendingApprovals = caseDetail.approvals.filter((a) => a.status === "requested");
  const activeEscalations = caseDetail.escalations.filter((e) => e.status === "triggered");

  // ─── Tasks Tab ───
  const renderTasksTab = () => {
    if (caseDetail.tasks.length === 0) {
      return (
        <div className="text-center py-16 text-[#868788]">
          <FiZap size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No tasks for this case yet.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {caseDetail.tasks.map((task) => {
          const documentRequirements = documentRequirementsByTaskId.get(task.id);
          const missingRequiredDocuments = documentRequirements?.missing ?? [];
          const isDocumentCollection = task.task_type === "document_collection";
          const isMissingAnyEvidence =
            isDocumentCollection &&
            (documentRequirements?.required.length
              ? missingRequiredDocuments.length > 0
              : (documentRequirements?.uploadedCount ?? 0) === 0);
          const isActionable =
            !isAuditor && ["pending", "assigned", "claimed", "overdue"].includes(task.status);
          const isExpanded = expandedTaskId === task.id;
          const isClaimable =
            !isAuditor &&
            ["pending", "assigned"].includes(task.status) &&
            task.claim_policy === "claim_required";

          return (
            <div
              key={task.id}
              className={`rounded-xl border transition-all ${
                isExpanded
                  ? "border-[#0071e3]/20 bg-white shadow-sm"
                  : "border-[#0f1012]/[0.06] bg-[#fdfdfd] hover:border-[#0f1012]/[0.1]"
              }`}
            >
              {/* Task Header */}
              <button
                onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                className="w-full text-left p-4 flex items-start gap-3"
              >
                <div className="mt-0.5 shrink-0">
                  {isExpanded ? (
                    <FiChevronDown size={16} className="text-[#868788]" />
                  ) : (
                    <FiChevronRight size={16} className="text-[#868788]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[#0f1012] font-medium text-sm">{task.title}</span>
                    <Badge variant={statusBadgeVariant(task.status)} className="text-[10px]">
                      {formatLabel(task.status)}
                    </Badge>
                    {task.due_at && new Date(task.due_at) < new Date() && !["completed", "cancelled"].includes(task.status) && (
                      <span className="text-[10px] text-[#b71c1c] font-medium">Overdue</span>
                    )}
                  </div>
                  <div className="text-[#868788] text-xs mt-0.5">
                    {task.task_type}
                    {task.flow_node_key ? ` · ${task.flow_node_key}` : ""} · Due {formatDate(task.due_at)}
                  </div>

                  {/* Evidence summary (always visible) */}
                  {isDocumentCollection && documentRequirements && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {documentRequirements.required.length > 0 ? (
                        documentRequirements.required.map((docType) => {
                          const uploaded = documentRequirements.uploaded.includes(docType);
                          return (
                            <span
                              key={docType}
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                                uploaded
                                  ? "bg-[#e8f5e9] text-[#1b5e20]"
                                  : "bg-[#ffebee] text-[#b71c1c]"
                              }`}
                            >
                              {uploaded ? <FiCheckCircle size={10} /> : <FiX size={10} />}
                              {formatDocumentType(docType)}
                            </span>
                          );
                        })
                      ) : documentRequirements.uploadedCount > 0 ? (
                        <span className="text-[10px] text-[#1b5e20] bg-[#e8f5e9] rounded-md px-1.5 py-0.5 font-medium inline-flex items-center gap-1">
                          <FiCheckCircle size={10} /> Evidence attached
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#868788]">No evidence required</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Claim button (if not expanded and claimable) */}
                {isClaimable && !isExpanded && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 mt-0.5"
                    disabled={busyAction === `claim-${task.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void runAction(`claim-${task.id}`, async () => {
                        await claimTask(task.id);
                        await refreshAfterAction("Task claimed.");
                      });
                    }}
                  >
                    {busyAction === `claim-${task.id}` ? "Claiming…" : "Claim"}
                  </Button>
                )}
              </button>

              {/* Expanded Action Area */}
              {isExpanded && isActionable && (
                <div className="px-4 pb-4 pt-0">
                  <div className="border-t border-[#0f1012]/[0.06] pt-4">
                    {isClaimable && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mb-3"
                        disabled={busyAction === `claim-${task.id}`}
                        onClick={() =>
                          void runAction(`claim-${task.id}`, async () => {
                            await claimTask(task.id);
                            await refreshAfterAction("Task claimed.");
                          })
                        }
                      >
                        {busyAction === `claim-${task.id}` ? "Claiming…" : "Claim Task"}
                      </Button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        value={taskDecisionById[task.id] ?? ""}
                        onChange={(event) =>
                          setTaskDecisionById((prev) => ({ ...prev, [task.id]: event.target.value }))
                        }
                        className="bg-[#0f1012]/[0.03] border border-[#0f1012]/[0.08] rounded-lg px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                        placeholder="Decision label, e.g. approved"
                      />
                      {getTaskOutputFields(task.task_type).map((field) => (
                        <input
                          key={field.key}
                          value={taskFieldValuesById[task.id]?.[field.key] ?? ""}
                          onChange={(event) =>
                            setTaskFieldValuesById((prev) => ({
                              ...prev,
                              [task.id]: {
                                ...(prev[task.id] ?? {}),
                                [field.key]: event.target.value,
                              },
                            }))
                          }
                          type={field.type === "number" ? "number" : "text"}
                          className="bg-[#0f1012]/[0.03] border border-[#0f1012]/[0.08] rounded-lg px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                          placeholder={field.placeholder || field.label}
                          aria-label={field.label}
                        />
                      ))}
                      <textarea
                        value={taskOutputById[task.id] ?? ""}
                        onChange={(event) =>
                          setTaskOutputById((prev) => ({ ...prev, [task.id]: event.target.value }))
                        }
                        className="md:col-span-2 bg-[#0f1012]/[0.03] border border-[#0f1012]/[0.08] rounded-lg px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all resize-none"
                        rows={2}
                        placeholder='Additional output, e.g. {"finding":"clear"}'
                      />
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busyAction === `task-${task.id}` || isMissingAnyEvidence}
                        onClick={() => handleCompleteTask(task.id)}
                      >
                        {busyAction === `task-${task.id}` ? "Completing…" : "Complete Task"}
                      </Button>
                      {isMissingAnyEvidence && (
                        <span className="text-xs text-[#b71c1c]">
                          Upload{" "}
                          {missingRequiredDocuments.length > 0
                            ? missingRequiredDocuments.map(formatDocumentType).join(", ")
                            : "supporting evidence"}{" "}
                          before completing.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Documents Tab ───
  const renderDocumentsTab = () => {
    return (
      <div className="space-y-6">
        {!isAuditor && (
          <div className="rounded-xl border border-[#0f1012]/[0.06] bg-[#fdfdfd] p-4">
            <h3 className="text-sm font-medium text-[#0f1012] mb-3">Upload Document</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-1">
                <label htmlFor="document-task" className="text-[#868788] text-[10px] uppercase mb-1 block tracking-wider font-medium">
                  Task
                </label>
                <select
                  id="document-task"
                  value={selectedTaskId}
                  onChange={(event) => setSelectedTaskId(event.target.value)}
                  className="w-full bg-[#0f1012]/[0.03] border border-[#0f1012]/[0.08] rounded-lg px-3 py-2 text-sm text-[#020201] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                >
                  <option value="">Case document</option>
                  {caseDetail.tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label htmlFor="document-type" className="text-[#868788] text-[10px] uppercase mb-1 block tracking-wider font-medium">
                  Document Type
                </label>
                <input
                  id="document-type"
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  className="w-full bg-[#0f1012]/[0.03] border border-[#0f1012]/[0.08] rounded-lg px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                  placeholder="payment_instruction"
                />
              </div>
              <div className="md:col-span-1">
                <label htmlFor="document-file" className="text-[#868788] text-[10px] uppercase mb-1 block tracking-wider font-medium">
                  File
                </label>
                <input
                  id="document-file"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => {
                    selectedFileRef.current = event.target.files?.[0] ?? null;
                  }}
                  className="w-full bg-[#0f1012]/[0.03] border border-[#0f1012]/[0.08] rounded-lg px-3 py-[5px] text-sm text-[#020201] file:bg-transparent file:border-0 file:text-sm file:font-medium file:text-[#8f8f8f] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                />
              </div>
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyAction === "document-upload"}
                  onClick={handleUploadDocument}
                  className="w-full md:w-auto"
                >
                  <FiUpload className="size-3.5" />
                  {busyAction === "document-upload" ? "Uploading…" : "Upload"}
                </Button>
              </div>
            </div>

            {/* Required doc hints for selected task */}
            {selectedDocumentRequirements && selectedDocumentRequirements.required.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedDocumentRequirements.required.map((docType) => {
                  const uploaded = selectedDocumentRequirements.uploaded.includes(docType);
                  return (
                    <button
                      key={docType}
                      type="button"
                      onClick={() => setDocumentType(docType)}
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                        uploaded
                          ? "border-[#1b5e20]/20 bg-[#e8f5e9] text-[#1b5e20]"
                          : "border-[#0f1012]/[0.08] bg-white text-[#0f1012] hover:border-[#0071e3]/30 hover:text-[#0071e3]"
                      }`}
                    >
                      {formatDocumentType(docType)} {uploaded ? "· uploaded" : "· set type"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Document List */}
        {caseDetail.documents.length === 0 ? (
          <div className="text-center py-16 text-[#868788]">
            <FiFolder size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No documents attached.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#0f1012]/[0.06] bg-[#fdfdfd] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0f1012]/[0.02] border-b border-[#0f1012]/[0.06]">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-[#868788] font-medium">Name</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-[#868788] font-medium hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-[#868788] font-medium hidden md:table-cell">Date</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-[#868788] font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0f1012]/[0.04]">
                {caseDetail.documents.map((document) => (
                  <tr key={document.id} className="hover:bg-[#0f1012]/[0.015] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <FiFileText className="text-[#868788] shrink-0" size={16} />
                        <span className="text-[#0f1012] truncate max-w-[200px] sm:max-w-xs" title={document.filename}>
                          {document.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#868788] hidden sm:table-cell">
                      {document.document_type || document.mime_type}
                    </td>
                    <td className="px-4 py-3 text-[#868788] hidden md:table-cell">{formatDate(document.uploaded_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="p-1.5 text-[#868788] hover:text-[#0f1012] hover:bg-[#0f1012]/[0.05] rounded-md transition-colors"
                        onClick={() =>
                          void runAction(`download-${document.id}`, async () => {
                            await downloadCaseDocument(document.id, document.filename);
                          })
                        }
                      >
                        <FiDownload size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ─── History Tab ───
  const renderHistoryTab = () => {
    const events = [...caseDetail.events].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return (
      <div className="space-y-8">
        {/* Timeline */}
        <div>
          <h3 className="text-sm font-medium text-[#0f1012] mb-4">Activity Timeline</h3>
          {events.length === 0 ? (
            <div className="text-center py-12 text-[#868788]">
              <FiClock size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No events recorded.</p>
            </div>
          ) : (
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[#0f1012]/[0.08]" />
              <div className="space-y-0">
                {events.map((event, index) => {
                  const isFirst = index === 0;
                  const isResolvedOrCompleted =
                    event.event_type.includes("resolved") || event.event_type.includes("completed");
                  return (
                    <div key={event.id} className="relative pb-6 last:pb-0">
                      {/* Dot */}
                      <div
                        className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center bg-white z-10 ${
                          isResolvedOrCompleted
                            ? "border-[#1b5e20] text-[#1b5e20]"
                            : isFirst
                            ? "border-[#0071e3] text-[#0071e3]"
                            : "border-[#0f1012]/[0.12] text-[#868788]"
                        }`}
                      >
                        {isResolvedOrCompleted ? <FiCheckCircle size={10} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                      </div>
                      <div className="pl-6">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[#0f1012] text-sm font-medium">{event.summary}</span>
                          <span className="text-[#868788] text-xs whitespace-nowrap">{formatDate(event.created_at)}</span>
                        </div>
                        <div className="text-[#868788] text-xs mt-0.5">
                          {event.event_type}
                          {event.flow_node_key ? ` · ${event.flow_node_key}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Details Tab ───
  const renderDetailsTab = () => {
    return (
      <div className="rounded-xl border border-[#0f1012]/[0.06] bg-[#fdfdfd] p-4 overflow-auto custom-scrollbar" style={{ maxHeight: 600 }}>
        {renderCaseDataValue(caseDetail.case_data_json)}
      </div>
    );
  };

  return (
    <div className="p-6 h-full overflow-y-auto custom-scrollbar text-[#8f8f8f]">
      <Link to="/cases" className="text-[#8f8f8f] hover:text-[#0f1012] flex items-center gap-2 mb-6 transition-colors text-sm">
        <FiArrowLeft size={16} /> Cases
      </Link>

      <CaseHeader caseDetail={caseDetail} />

      {(actionError || actionSuccess) && (
        <div
          className={`mb-6 p-3.5 rounded-lg text-sm flex items-center gap-2 ${
            actionError
              ? "bg-[#ffebee] border border-[#b71c1c]/20 text-[#b71c1c]"
              : "bg-[#e8f5e9] border border-[#1b5e20]/20 text-[#1b5e20]"
          }`}
        >
          {actionError ? <FiAlertTriangle size={14} /> : <FiCheckCircle size={14} />}
          {actionError || actionSuccess}
        </div>
      )}

      <CaseSummaryGrid caseDetail={caseDetail} currentOwner={currentOwner} />

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mb-6 border-b border-[#0f1012]/[0.06]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "text-[#0f1012]" : "text-[#868788] hover:text-[#0f1012]"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                  {tab.key === "tasks" && caseDetail.tasks.filter((t) => !["completed", "cancelled"].includes(t.status)).length > 0 && (
                    <span className="ml-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#0071e3] text-white text-[10px] font-semibold">
                      {caseDetail.tasks.filter((t) => !["completed", "cancelled"].includes(t.status)).length}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0f1012] rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="min-h-[200px]">
            {activeTab === "tasks" && renderTasksTab()}
            {activeTab === "documents" && renderDocumentsTab()}
            {activeTab === "history" && renderHistoryTab()}
            {activeTab === "details" && renderDetailsTab()}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="xl:w-80 shrink-0 space-y-4">
          {/* Pending Approvals */}
          {caseDetail.approvals.length > 0 && (
            <div className="rounded-xl border border-[#0f1012]/[0.06] bg-[#fdfdfd] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#0f1012]/[0.04] flex items-center justify-between">
                <h3 className="text-xs font-medium text-[#0f1012] uppercase tracking-wider">Approvals</h3>
                {pendingApprovals.length > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#b71c1c] text-white text-[10px] font-semibold">
                    {pendingApprovals.length}
                  </span>
                )}
              </div>
              <div className="divide-y divide-[#0f1012]/[0.04]">
                {caseDetail.approvals.map((approval) => (
                  <div key={approval.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-[#0f1012] font-medium">Approval #{approval.id}</span>
                      <Badge variant={statusBadgeVariant(approval.status)} className="text-[10px]">
                        {formatLabel(approval.status)}
                      </Badge>
                    </div>
                    <div className="text-[#868788] text-xs mt-0.5">
                      {approval.flow_node_key || "approval node"} · {formatDate(approval.requested_at)}
                    </div>
                    {approval.decision_reason && (
                      <div className="text-[#868788] text-xs mt-1 italic">"{approval.decision_reason}"</div>
                    )}
                    {!isAuditor && approval.status === "requested" && (
                      <div className="mt-3">
                        <textarea
                          value={approvalReasonById[approval.id] ?? ""}
                          onChange={(event) =>
                            setApprovalReasonById((prev) => ({ ...prev, [approval.id]: event.target.value }))
                          }
                          className="w-full bg-[#0f1012]/[0.03] border border-[#0f1012]/[0.08] rounded-lg px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all resize-none mb-2"
                          rows={2}
                          placeholder="Decision reason (optional)"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            disabled={busyAction === `approval-approve-${approval.id}`}
                            onClick={() =>
                              void runAction(`approval-approve-${approval.id}`, async () => {
                                await approveApproval(approval.id, approvalReasonById[approval.id]);
                                await refreshAfterAction("Approval approved.");
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="flex-1"
                            disabled={busyAction === `approval-reject-${approval.id}`}
                            onClick={() =>
                              void runAction(`approval-reject-${approval.id}`, async () => {
                                await rejectApproval(approval.id, approvalReasonById[approval.id]);
                                await refreshAfterAction("Approval rejected.");
                              })
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Escalations */}
          {(canManualEscalate || caseDetail.escalations.length > 0) && (
            <div className="rounded-xl border border-[#0f1012]/[0.06] bg-[#fdfdfd] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#0f1012]/[0.04] flex items-center justify-between">
                <h3 className="text-xs font-medium text-[#0f1012] uppercase tracking-wider">Escalations</h3>
                {activeEscalations.length > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#b71c1c] text-white text-[10px] font-semibold">
                    {activeEscalations.length}
                  </span>
                )}
              </div>
              <div className="divide-y divide-[#0f1012]/[0.04]">
                {canManualEscalate && (
                  <div className="px-4 py-3">
                    {!showEscalationForm ? (
                      <button
                        onClick={() => setShowEscalationForm(true)}
                        className="flex items-center gap-2 text-sm text-[#b71c1c] hover:text-[#b71c1c]/80 transition-colors font-medium"
                      >
                        <FiAlertTriangle size={14} />
                        Escalate this case
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#0f1012]">New escalation</span>
                          <button onClick={() => setShowEscalationForm(false)} className="text-[#868788] hover:text-[#0f1012]">
                            <FiX size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={escalationTargetType}
                            onChange={(event) => {
                              setEscalationTargetType(event.target.value as "team" | "user");
                              setEscalationTargetId("");
                            }}
                            className="w-full bg-[#0f1012]/[0.03] border border-[#0f1012]/[0.08] rounded-lg px-3 py-2 text-sm text-[#020201] focus:outline-none focus:border-[#0071e3]/40 transition-all"
                          >
                            <option value="team">Team</option>
                            <option value="user">User</option>
                          </select>
                          <select
                            value={escalationTargetId}
                            onChange={(event) => setEscalationTargetId(event.target.value)}
                            className="w-full bg-[#0f1012]/[0.03] border border-[#0f1012]/[0.08] rounded-lg px-3 py-2 text-sm text-[#020201] focus:outline-none focus:border-[#0071e3]/40 transition-all"
                          >
                            <option value="">{escalationTargetOptions.length === 0 ? "No targets" : "Select…"}</option>
                            {escalationTargetOptions.map((target) => (
                              <option key={`${escalationTargetType}-${target.id}`} value={target.id}>
                                {target.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          value={escalationReason}
                          onChange={(event) => setEscalationReason(event.target.value)}
                          className="w-full bg-[#0f1012]/[0.03] border border-[#0f1012]/[0.08] rounded-lg px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0071e3]/40 transition-all resize-none"
                          rows={2}
                          placeholder="Why is intervention required?"
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busyAction === "manual-escalation" || !escalationReason.trim() || !escalationTargetId}
                          onClick={handleManualEscalation}
                          className="w-full"
                        >
                          {busyAction === "manual-escalation" ? "Escalating…" : "Escalate Case"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {caseDetail.escalations.map((escalation) => (
                  <div key={escalation.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FiAlertTriangle className="text-[#b71c1c] shrink-0 mt-0.5" size={14} />
                        <span className="text-sm text-[#0f1012] font-medium truncate">{escalation.reason}</span>
                      </div>
                      <Badge variant={statusBadgeVariant(escalation.status)} className="text-[10px] shrink-0">
                        {formatLabel(escalation.status)}
                      </Badge>
                    </div>
                    <div className="text-[#868788] text-xs mt-1 pl-5">
                      {escalation.escalation_type} · {formatDate(escalation.triggered_at)}
                    </div>
                    {(escalation.to_team_id || escalation.to_user_id) && (
                      <div className="text-[#868788] text-xs mt-0.5 pl-5">
                        To:{" "}
                        {escalation.to_team_id
                          ? teamNameById.get(escalation.to_team_id) ?? `Team #${escalation.to_team_id}`
                          : userNameById.get(escalation.to_user_id ?? 0) ?? `User #${escalation.to_user_id}`}
                      </div>
                    )}
                    {canManageCase && escalation.status === "triggered" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2 ml-5"
                        disabled={busyAction === `resolve-escalation-${escalation.id}`}
                        onClick={() =>
                          void runAction(`resolve-escalation-${escalation.id}`, async () => {
                            await resolveEscalation(caseDetail.id, escalation.id, "Resolved from case detail");
                            await refreshAfterAction("Escalation resolved.");
                          })
                        }
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                ))}
                {caseDetail.escalations.length === 0 && !canManualEscalate && (
                  <div className="px-4 py-3 text-sm text-[#868788]">No escalations.</div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {!isAuditor && (
            <div className="rounded-xl border border-[#0f1012]/[0.06] bg-[#fdfdfd] p-4">
              <h3 className="text-xs font-medium text-[#0f1012] uppercase tracking-wider mb-3">Quick Actions</h3>
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                className="w-full bg-[#0f1012]/[0.03] border border-[#0f1012]/[0.08] rounded-lg px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0071e3]/40 focus:ring-1 focus:ring-[#0071e3]/20 transition-all resize-none mb-3"
                rows={2}
                placeholder="Add a case note…"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyAction === "note" || !noteText.trim()}
                  onClick={() =>
                    void runAction("note", async () => {
                      await addCaseNote(caseDetail.id, noteText);
                      setNoteText("");
                      await refreshAfterAction("Note added.");
                    })
                  }
                >
                  <FiMessageSquare size={13} /> Add Note
                </Button>
                {canManageCase && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busyAction === "close-case" || ["closed", "cancelled"].includes(caseDetail.status)}
                      onClick={() =>
                        void runAction("close-case", async () => {
                          await closeCase(caseDetail.id, "Closed from case detail");
                          await refreshAfterAction("Case closed.");
                        })
                      }
                    >
                      Close Case
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyAction === "cancel-case" || ["closed", "cancelled"].includes(caseDetail.status)}
                      onClick={() =>
                        void runAction("cancel-case", async () => {
                          await cancelCase(caseDetail.id, "Cancelled from case detail");
                          await refreshAfterAction("Case cancelled.");
                        })
                      }
                    >
                      Cancel Case
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseDetailPage;
