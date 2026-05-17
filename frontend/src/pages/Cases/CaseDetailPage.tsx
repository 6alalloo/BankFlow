import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiAlertTriangle, FiArrowLeft, FiCheckCircle, FiClock, FiDownload, FiFileText, FiGitBranch, FiShield, FiUpload, FiUser } from "react-icons/fi";
import { addCaseNote, cancelCase, closeCase, fetchCaseById, resolveEscalation, type CaseDetail } from "../../api/cases";
import { approveApproval, rejectApproval } from "../../api/approvals";
import { claimTask, completeTask } from "../../api/tasks";
import { downloadCaseDocument, uploadCaseDocument } from "../../api/files";
import { Button, Badge, type BadgeVariant } from "../../components/ui";
import { buildObjectFromFields, getTaskOutputFields } from "../../utils/caseForms";
import { useAuth } from "../../contexts/AuthContext";

const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return parsed.toLocaleString();
};

const formatJson = (value: unknown) => {
  if (value === null || value === undefined) return "{}";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
};

const statusBadgeVariant = (status: string): BadgeVariant => {
  if (["resolved", "closed", "completed", "approved"].includes(status)) return "mint";
  if (["critical", "rejected", "cancelled", "overdue", "escalated"].includes(status)) return "ember";
  if (["pending_action", "pending_approval", "requested", "claimed", "assigned"].includes(status)) return "sky";
  return "secondary";
};

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
  const [taskDecisionById, setTaskDecisionById] = useState<Record<number, string>>({});
  const [taskOutputById, setTaskOutputById] = useState<Record<number, string>>({});
  const [taskFieldValuesById, setTaskFieldValuesById] = useState<Record<number, Record<string, string>>>({});
  const [approvalReasonById, setApprovalReasonById] = useState<Record<number, string>>({});
  const [noteText, setNoteText] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const currentOwner = useMemo(() => {
    if (!caseDetail) return "Unassigned";
    return caseDetail.assignee_user?.full_name || caseDetail.assignee_team?.name || "Unassigned";
  }, [caseDetail]);
  const roleName = user?.role?.name;
  const isAuditor = roleName === "Auditor";
  const canManageCase = roleName === "Admin" || roleName === "Supervisor";

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
      let output: Record<string, unknown> = buildObjectFromFields(outputFields, taskFieldValuesById[taskId] ?? {});
      if (rawOutput) {
        const parsed = JSON.parse(rawOutput) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Task output must be a JSON object.");
        }
        output = { ...output, ...(parsed as Record<string, unknown>) };
      }
      await completeTask(taskId, {
        decision: taskDecisionById[taskId]?.trim() || undefined,
        output,
      });
      await refreshAfterAction("Task completed.");
    });
  };

  const handleUploadDocument = () => {
    void runAction("document-upload", async () => {
      if (!selectedFile || !caseDetail) throw new Error("Choose a file before uploading.");
      await uploadCaseDocument({
        caseId: caseDetail.id,
        file: selectedFile,
        taskId: selectedTaskId ? Number(selectedTaskId) : null,
        documentType: documentType.trim() || null,
      });
      setSelectedFile(null);
      setDocumentType("");
      setSelectedTaskId("");
      await refreshAfterAction("Document uploaded.");
    });
  };

  if (loading) {
    return (
      <div className="p-6 text-[#9c9c9d]">
        <div className="animate-spin size-5 border-2 border-white/20 border-t-white rounded-full inline-block mr-2" />
        Loading case...
      </div>
    );
  }

  if (error || !caseDetail) {
    return (
      <div className="p-6">
        <Link to="/cases" className="text-[#9c9c9d] hover:text-white flex items-center gap-2 mb-4 transition-colors">
          <FiArrowLeft /> Cases
        </Link>
        <div className="p-4 rounded-lg bg-[#452324]/40 border border-[#ff6363]/20 text-[#ff6363]">{error || "Case not found"}</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto custom-scrollbar text-[#9c9c9d]">
      <Link to="/cases" className="text-[#9c9c9d] hover:text-white flex items-center gap-2 mb-4 transition-colors">
        <FiArrowLeft /> Cases
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant={statusBadgeVariant(caseDetail.status)}>{caseDetail.status.replace(/_/g, " ")}</Badge>
            <Badge variant={statusBadgeVariant(caseDetail.priority)}>{caseDetail.priority}</Badge>
            {caseDetail.flow && <Badge variant="secondary">{caseDetail.flow.name}</Badge>}
          </div>
          <h1 className="text-xl font-semibold text-white mb-1 font-mono">{caseDetail.case_reference}</h1>
          <p className="text-[#9c9c9d] mb-0">{caseDetail.title || caseDetail.case_type}</p>
        </div>
      </div>

      {(actionError || actionSuccess) && (
        <div className={`mb-4 p-4 rounded-lg text-sm ${actionError ? "bg-[#452324]/40 border border-[#ff6363]/20 text-[#ff6363]" : "bg-[#0d2b1a]/40 border border-[#59d499]/20 text-[#59d499]"}`}>
          {actionError || actionSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="border border-white/[0.08] rounded-xl p-3 bg-[#07080a]">
          <div className="text-[#6a6b6c] text-[10px] uppercase font-mono mb-2 tracking-wider">Owner</div>
          <div className="flex items-center gap-2 text-white text-sm"><FiUser className="text-[#6a6b6c]" /> {currentOwner}</div>
        </div>
        <div className="border border-white/[0.08] rounded-xl p-3 bg-[#07080a]">
          <div className="text-[#6a6b6c] text-[10px] uppercase font-mono mb-2 tracking-wider">Opened</div>
          <div className="flex items-center gap-2 text-white text-sm"><FiClock className="text-[#6a6b6c]" /> {formatDate(caseDetail.opened_at)}</div>
        </div>
        <div className="border border-white/[0.08] rounded-xl p-3 bg-[#07080a]">
          <div className="text-[#6a6b6c] text-[10px] uppercase font-mono mb-2 tracking-wider">Current Node</div>
          <div className="flex items-center gap-2 text-white text-sm"><FiGitBranch className="text-[#6a6b6c]" /> {caseDetail.current_node_key || "None"}</div>
        </div>
        <div className="border border-white/[0.08] rounded-xl p-3 bg-[#07080a]">
          <div className="text-[#6a6b6c] text-[10px] uppercase font-mono mb-2 tracking-wider">Intake</div>
          <div className="flex items-center gap-2 text-white text-sm"><FiShield className="text-[#6a6b6c]" /> {caseDetail.intake_source || "manual"}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-7 gap-6">
        <div className="xl:col-span-4 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Tasks</h2>
            <div className="space-y-3">
              {caseDetail.tasks.length === 0 ? (
                <div className="border border-white/[0.08] rounded-xl p-4 text-[#6a6b6c] bg-[#07080a]">No tasks for this case yet.</div>
              ) : caseDetail.tasks.map((task) => (
                <div key={task.id} className="border border-white/[0.08] rounded-xl p-4 bg-[#07080a]">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white font-medium text-sm">{task.title}</div>
                      <div className="text-[#6a6b6c] text-xs">{task.task_type} {task.flow_node_key ? `// ${task.flow_node_key}` : ""}</div>
                    </div>
                    <Badge variant={statusBadgeVariant(task.status)}>{task.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="text-[#9c9c9d] text-xs mt-2">Due: {formatDate(task.due_at)}</div>
                  {!isAuditor && ["pending", "assigned"].includes(task.status) && task.claim_policy === "claim_required" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      disabled={busyAction === `claim-${task.id}`}
                      onClick={() => void runAction(`claim-${task.id}`, async () => {
                        await claimTask(task.id);
                        await refreshAfterAction("Task claimed.");
                      })}
                    >
                      {busyAction === `claim-${task.id}` ? "Claiming..." : "Claim"}
                    </Button>
                  )}
                  {!isAuditor && ["pending", "assigned", "claimed", "overdue"].includes(task.status) && (
                    <div className="mt-3 border-t border-white/[0.08] pt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          value={taskDecisionById[task.id] ?? ""}
                          onChange={(event) => setTaskDecisionById((prev) => ({ ...prev, [task.id]: event.target.value }))}
                          className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                          placeholder="Decision label, e.g. approved"
                        />
                        {getTaskOutputFields(task.task_type).map((field) => (
                          <input
                            key={field.key}
                            value={taskFieldValuesById[task.id]?.[field.key] ?? ""}
                            onChange={(event) => setTaskFieldValuesById((prev) => ({
                              ...prev,
                              [task.id]: {
                                ...(prev[task.id] ?? {}),
                                [field.key]: event.target.value,
                              },
                            }))}
                            type={field.type === "number" ? "number" : "text"}
                            className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                            placeholder={field.placeholder || field.label}
                            aria-label={field.label}
                          />
                        ))}
                        <textarea
                          value={taskOutputById[task.id] ?? ""}
                          onChange={(event) => setTaskOutputById((prev) => ({ ...prev, [task.id]: event.target.value }))}
                          className="md:col-span-2 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all resize-none"
                          rows={2}
                          placeholder='Additional output JSON, e.g. {"finding":"clear"}'
                        />
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-2"
                        disabled={busyAction === `task-${task.id}`}
                        onClick={() => handleCompleteTask(task.id)}
                      >
                        {busyAction === `task-${task.id}` ? "Completing..." : "Complete Task"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Approvals</h2>
            <div className="space-y-3">
              {caseDetail.approvals.length === 0 ? (
                <div className="border border-white/[0.08] rounded-xl p-4 text-[#6a6b6c] bg-[#07080a]">No approvals requested.</div>
              ) : caseDetail.approvals.map((approval) => (
                <div key={approval.id} className="border border-white/[0.08] rounded-xl p-4 bg-[#07080a]">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white font-medium text-sm">Approval #{approval.id}</div>
                      <div className="text-[#6a6b6c] text-xs">{approval.flow_node_key || "approval node"}</div>
                    </div>
                    <Badge variant={statusBadgeVariant(approval.status)}>{approval.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="text-[#9c9c9d] text-xs mt-2">Requested: {formatDate(approval.requested_at)}</div>
                  {approval.decision_reason && <div className="text-[#6a6b6c] text-xs mt-1">Reason: {approval.decision_reason}</div>}
                  {!isAuditor && approval.status === "requested" && (
                    <div className="mt-3 border-t border-white/[0.08] pt-3">
                      <textarea
                        value={approvalReasonById[approval.id] ?? ""}
                        onChange={(event) => setApprovalReasonById((prev) => ({ ...prev, [approval.id]: event.target.value }))}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all resize-none"
                        rows={2}
                        placeholder="Decision reason"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={busyAction === `approval-approve-${approval.id}`}
                          onClick={() => void runAction(`approval-approve-${approval.id}`, async () => {
                            await approveApproval(approval.id, approvalReasonById[approval.id]);
                            await refreshAfterAction("Approval approved.");
                          })}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busyAction === `approval-reject-${approval.id}`}
                          onClick={() => void runAction(`approval-reject-${approval.id}`, async () => {
                            await rejectApproval(approval.id, approvalReasonById[approval.id]);
                            await refreshAfterAction("Approval rejected.");
                          })}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Timeline</h2>
            <div className="space-y-3">
              {caseDetail.events.length === 0 ? (
                <div className="border border-white/[0.08] rounded-xl p-4 text-[#6a6b6c] bg-[#07080a]">No events recorded.</div>
              ) : caseDetail.events.map((event) => (
                <div key={event.id} className="border border-white/[0.08] rounded-xl p-4 bg-[#07080a]">
                  <div className="flex items-start gap-3">
                    <div className="text-[#9c9c9d] mt-0.5 shrink-0">
                      {event.event_type.includes("resolved") || event.event_type.includes("completed") ? <FiCheckCircle /> : <FiClock />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-3">
                        <div className="text-white font-medium text-sm">{event.summary}</div>
                        <div className="text-[#6a6b6c] text-xs font-mono whitespace-nowrap">{formatDate(event.created_at)}</div>
                      </div>
                      <div className="text-[#6a6b6c] text-xs">{event.event_type} {event.flow_node_key ? `// ${event.flow_node_key}` : ""}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="xl:col-span-3 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Case Data</h2>
            <pre className="border border-white/[0.08] rounded-xl p-4 bg-[#07080a] text-[#9c9c9d] text-xs overflow-auto custom-scrollbar" style={{ maxHeight: 360 }}>
              {formatJson(caseDetail.case_data_json)}
            </pre>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Documents</h2>
            {!isAuditor && (
              <div className="border border-white/[0.08] rounded-xl p-4 bg-[#07080a] mb-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div>
                    <label htmlFor="document-task" className="text-[#6a6b6c] text-[10px] uppercase font-mono mb-1 block tracking-wider">Task</label>
                    <select
                      id="document-task"
                      value={selectedTaskId}
                      onChange={(event) => setSelectedTaskId(event.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                    >
                      <option value="" className="bg-[#111214]">Case document</option>
                      {caseDetail.tasks.map((task) => (
                        <option key={task.id} value={task.id} className="bg-[#111214]">{task.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="document-type" className="text-[#6a6b6c] text-[10px] uppercase font-mono mb-1 block tracking-wider">Document Type</label>
                    <input
                      id="document-type"
                      value={documentType}
                      onChange={(event) => setDocumentType(event.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                      placeholder="payment_instruction"
                    />
                  </div>
                  <div>
                    <label htmlFor="document-file" className="text-[#6a6b6c] text-[10px] uppercase font-mono mb-1 block tracking-wider">File</label>
                    <input
                      id="document-file"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white file:bg-transparent file:border-0 file:text-sm file:font-medium file:text-[#9c9c9d] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                    />
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  disabled={busyAction === "document-upload"}
                  onClick={handleUploadDocument}
                >
                  <FiUpload className="size-3.5" /> {busyAction === "document-upload" ? "Uploading..." : "Upload Document"}
                </Button>
              </div>
            )}
            <div className="space-y-3">
              {caseDetail.documents.length === 0 ? (
                <div className="border border-white/[0.08] rounded-xl p-4 text-[#6a6b6c] bg-[#07080a]">No documents attached.</div>
              ) : caseDetail.documents.map((document) => (
                <div key={document.id} className="border border-white/[0.08] rounded-xl p-4 bg-[#07080a] flex items-center gap-3 justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <FiFileText className="text-[#9c9c9d] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-white text-sm truncate">{document.filename}</div>
                      <div className="text-[#6a6b6c] text-xs">{document.document_type || document.mime_type} // {formatDate(document.uploaded_at)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-2 text-[#6a6b6c] hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors shrink-0"
                    onClick={() => void runAction(`download-${document.id}`, async () => {
                      await downloadCaseDocument(document.id, document.filename);
                    })}
                  >
                    <FiDownload size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Escalations</h2>
            <div className="space-y-3">
              {caseDetail.escalations.length === 0 ? (
                <div className="border border-white/[0.08] rounded-xl p-4 text-[#6a6b6c] bg-[#07080a]">No escalations active.</div>
              ) : caseDetail.escalations.map((escalation) => (
                <div key={escalation.id} className="border border-white/[0.08] rounded-xl p-4 bg-[#07080a]">
                  <div className="flex justify-between gap-3">
                    <div className="text-white font-medium text-sm flex items-center gap-2"><FiAlertTriangle className="text-[#ff6363]" /> {escalation.reason}</div>
                    <Badge variant={statusBadgeVariant(escalation.status)}>{escalation.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="text-[#6a6b6c] text-xs mt-2">{escalation.escalation_type} // {formatDate(escalation.triggered_at)}</div>
              {canManageCase && escalation.status === "triggered" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      disabled={busyAction === `resolve-escalation-${escalation.id}`}
                      onClick={() => void runAction(`resolve-escalation-${escalation.id}`, async () => {
                        await resolveEscalation(caseDetail.id, escalation.id, "Resolved from case detail");
                        await refreshAfterAction("Escalation resolved.");
                      })}
                    >
                      Resolve Escalation
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Case Controls</h2>
            <div className="border border-white/[0.08] rounded-xl p-4 bg-[#07080a]">
              {isAuditor ? (
                <div className="text-[#6a6b6c] text-sm">Auditor access is read-only for case controls.</div>
              ) : (
                <>
                  <textarea
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all resize-none mb-3"
                    rows={3}
                    placeholder="Add a case note"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busyAction === "note" || !noteText.trim()}
                      onClick={() => void runAction("note", async () => {
                        await addCaseNote(caseDetail.id, noteText);
                        setNoteText("");
                        await refreshAfterAction("Note added.");
                      })}
                    >
                      Add Note
                    </Button>
                    {canManageCase && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={busyAction === "close-case" || ["closed", "cancelled"].includes(caseDetail.status)}
                          onClick={() => void runAction("close-case", async () => {
                            await closeCase(caseDetail.id, "Closed from case detail");
                            await refreshAfterAction("Case closed.");
                          })}
                        >
                          Close Case
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={busyAction === "cancel-case" || ["closed", "cancelled"].includes(caseDetail.status)}
                          onClick={() => void runAction("cancel-case", async () => {
                            await cancelCase(caseDetail.id, "Cancelled from case detail");
                            await refreshAfterAction("Case cancelled.");
                          })}
                        >
                          Cancel Case
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CaseDetailPage;
