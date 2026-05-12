import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiAlertTriangle, FiArrowLeft, FiCheckCircle, FiClock, FiDownload, FiFileText, FiGitBranch, FiShield, FiUpload, FiUser } from "react-icons/fi";
import { addCaseNote, cancelCase, closeCase, fetchCaseById, resolveEscalation, type CaseDetail } from "../../api/cases";
import { approveApproval, rejectApproval } from "../../api/approvals";
import { claimTask, completeTask } from "../../api/tasks";
import { downloadCaseDocument, uploadCaseDocument } from "../../api/files";

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

const StatusPill: React.FC<{ label: string; tone?: "cyan" | "emerald" | "amber" | "rose" | "slate" }> = ({ label, tone = "slate" }) => {
  const styles = {
    cyan: "border-cyan-500/30 bg-cyan-950/30 text-cyan-200",
    emerald: "border-emerald-500/30 bg-emerald-950/30 text-emerald-200",
    amber: "border-amber-500/30 bg-amber-950/30 text-amber-200",
    rose: "border-rose-500/30 bg-rose-950/30 text-rose-200",
    slate: "border-zinc-500/30 bg-zinc-950/30 text-zinc-200",
  };

  return (
    <span className={`inline-flex items-center rounded border px-2 py-1 text-[11px] font-mono uppercase tracking-widest ${styles[tone]}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
};

const statusTone = (status: string): React.ComponentProps<typeof StatusPill>["tone"] => {
  if (["resolved", "closed", "completed", "approved"].includes(status)) return "emerald";
  if (["critical", "rejected", "cancelled", "overdue", "escalated"].includes(status)) return "rose";
  if (["pending_action", "pending_approval", "requested", "claimed", "assigned"].includes(status)) return "amber";
  return "cyan";
};

const CaseDetailPage: React.FC = () => {
  const { id } = useParams();
  const caseId = Number(id);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [taskDecisionById, setTaskDecisionById] = useState<Record<number, string>>({});
  const [taskOutputById, setTaskOutputById] = useState<Record<number, string>>({});
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
    let active = true;

    const load = async () => {
      if (!Number.isInteger(caseId)) {
        if (active) {
          setError("Invalid case id");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await fetchCaseById(caseId);
        if (active) setCaseDetail(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load case");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [caseId]);

  const currentOwner = useMemo(() => {
    if (!caseDetail) return "Unassigned";
    return caseDetail.assignee_user?.full_name || caseDetail.assignee_team?.name || "Unassigned";
  }, [caseDetail]);

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
      let output: Record<string, unknown> = {};
      if (rawOutput) {
        const parsed = JSON.parse(rawOutput) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Task output must be a JSON object.");
        }
        output = parsed as Record<string, unknown>;
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
      <div className="p-4 p-md-5 text-zinc-400">
        <div className="animate-spin size-6 border-2 border-cyan-500 border-t-transparent rounded-full d-inline-block me-2" />
        Loading case?
      </div>
    );
  }

  if (error || !caseDetail) {
    return (
      <div className="p-4 p-md-5">
        <Link to="/cases" className="text-cyan-300 text-decoration-none d-inline-flex align-items-center gap-2 mb-4">
          <FiArrowLeft /> Cases
        </Link>
        <div className="alert alert-danger">{error || "Case not found"}</div>
      </div>
    );
  }

  return (
    <div className="p-4 p-md-5 text-zinc-200">
      <Link to="/cases" className="text-cyan-300 text-decoration-none d-inline-flex align-items-center gap-2 mb-4">
        <FiArrowLeft /> Cases
      </Link>

      <div className="d-flex flex-wrap align-items-start justify-content-between gap-4 mb-4">
        <div>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <StatusPill label={caseDetail.status} tone={statusTone(caseDetail.status)} />
            <StatusPill label={caseDetail.priority} tone={statusTone(caseDetail.priority)} />
            {caseDetail.flow && <StatusPill label={caseDetail.flow.name} tone="slate" />}
          </div>
          <h1 className="h2 text-white mb-2">{caseDetail.case_reference}</h1>
          <p className="text-zinc-400 mb-0">{caseDetail.title || caseDetail.case_type}</p>
        </div>
      </div>

      {(actionError || actionSuccess) && (
        <div className={`alert ${actionError ? "alert-danger" : "alert-success"}`}>
          {actionError || actionSuccess}
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="border border-white/10 rounded p-3 bg-white/[0.02] h-100">
            <div className="text-zinc-500 text-xs text-uppercase font-mono mb-2">Owner</div>
            <div className="d-flex align-items-center gap-2 text-white"><FiUser /> {currentOwner}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="border border-white/10 rounded p-3 bg-white/[0.02] h-100">
            <div className="text-zinc-500 text-xs text-uppercase font-mono mb-2">Opened</div>
            <div className="d-flex align-items-center gap-2 text-white"><FiClock /> {formatDate(caseDetail.opened_at)}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="border border-white/10 rounded p-3 bg-white/[0.02] h-100">
            <div className="text-zinc-500 text-xs text-uppercase font-mono mb-2">Current Node</div>
            <div className="d-flex align-items-center gap-2 text-white"><FiGitBranch /> {caseDetail.current_node_key || "None"}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="border border-white/10 rounded p-3 bg-white/[0.02] h-100">
            <div className="text-zinc-500 text-xs text-uppercase font-mono mb-2">Intake</div>
            <div className="d-flex align-items-center gap-2 text-white"><FiShield /> {caseDetail.intake_source || "manual"}</div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-xl-7">
          <section className="mb-4">
            <h2 className="h5 text-white mb-3">Tasks</h2>
            <div className="d-grid gap-3">
              {caseDetail.tasks.length === 0 ? (
                <div className="border border-white/10 rounded p-3 text-zinc-500 bg-white/[0.02]">No tasks for this case yet.</div>
              ) : caseDetail.tasks.map((task) => (
                <div key={task.id} className="border border-white/10 rounded p-3 bg-white/[0.02]">
                  <div className="d-flex justify-content-between gap-3">
                    <div>
                      <div className="text-white fw-semibold">{task.title}</div>
                      <div className="text-zinc-500 text-sm">{task.task_type} {task.flow_node_key ? `// ${task.flow_node_key}` : ""}</div>
                    </div>
                    <StatusPill label={task.status} tone={statusTone(task.status)} />
                  </div>
                  <div className="text-zinc-400 text-sm mt-2">Due: {formatDate(task.due_at)}</div>
                  {["pending", "assigned"].includes(task.status) && task.claim_policy === "claim_required" && (
                    <button
                      type="button"
                      disabled={busyAction === `claim-${task.id}`}
                      onClick={() => void runAction(`claim-${task.id}`, async () => {
                        await claimTask(task.id);
                        await refreshAfterAction("Task claimed.");
                      })}
                      className="btn btn-sm btn-outline-info mt-3"
                    >
                      {busyAction === `claim-${task.id}` ? "Claiming?" : "Claim"}
                    </button>
                  )}
                  {["pending", "assigned", "claimed", "overdue"].includes(task.status) && (
                    <div className="mt-3 border-top border-white/10 pt-3">
                      <div className="row g-2">
                        <div className="col-md-5">
                          <input
                            value={taskDecisionById[task.id] ?? ""}
                            onChange={(event) => setTaskDecisionById((prev) => ({ ...prev, [task.id]: event.target.value }))}
                            className="form-control form-control-sm bg-zinc-950 text-white border-secondary"
                            placeholder="Decision label, e.g. approved"
                          />
                        </div>
                        <div className="col-md-7">
                          <textarea
                            value={taskOutputById[task.id] ?? ""}
                            onChange={(event) => setTaskOutputById((prev) => ({ ...prev, [task.id]: event.target.value }))}
                            className="form-control form-control-sm bg-zinc-950 text-white border-secondary"
                            rows={2}
                            placeholder='Output JSON, e.g. {"finding":"clear"}'
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busyAction === `task-${task.id}`}
                        onClick={() => handleCompleteTask(task.id)}
                        className="btn btn-sm btn-success mt-2"
                      >
                        {busyAction === `task-${task.id}` ? "Completing?" : "Complete Task"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="mb-4">
            <h2 className="h5 text-white mb-3">Approvals</h2>
            <div className="d-grid gap-3">
              {caseDetail.approvals.length === 0 ? (
                <div className="border border-white/10 rounded p-3 text-zinc-500 bg-white/[0.02]">No approvals requested.</div>
              ) : caseDetail.approvals.map((approval) => (
                <div key={approval.id} className="border border-white/10 rounded p-3 bg-white/[0.02]">
                  <div className="d-flex justify-content-between gap-3">
                    <div>
                      <div className="text-white fw-semibold">Approval #{approval.id}</div>
                      <div className="text-zinc-500 text-sm">{approval.flow_node_key || "approval node"}</div>
                    </div>
                    <StatusPill label={approval.status} tone={statusTone(approval.status)} />
                  </div>
                  <div className="text-zinc-400 text-sm mt-2">Requested: {formatDate(approval.requested_at)}</div>
                  {approval.decision_reason && <div className="text-zinc-500 text-sm mt-1">Reason: {approval.decision_reason}</div>}
                  {approval.status === "requested" && (
                    <div className="mt-3 border-top border-white/10 pt-3">
                      <textarea
                        value={approvalReasonById[approval.id] ?? ""}
                        onChange={(event) => setApprovalReasonById((prev) => ({ ...prev, [approval.id]: event.target.value }))}
                        className="form-control form-control-sm bg-zinc-950 text-white border-secondary"
                        rows={2}
                        placeholder="Decision reason"
                      />
                      <div className="d-flex gap-2 mt-2">
                        <button
                          type="button"
                          disabled={busyAction === `approval-approve-${approval.id}`}
                          onClick={() => void runAction(`approval-approve-${approval.id}`, async () => {
                            await approveApproval(approval.id, approvalReasonById[approval.id]);
                            await refreshAfterAction("Approval approved.");
                          })}
                          className="btn btn-sm btn-success"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyAction === `approval-reject-${approval.id}`}
                          onClick={() => void runAction(`approval-reject-${approval.id}`, async () => {
                            await rejectApproval(approval.id, approvalReasonById[approval.id]);
                            await refreshAfterAction("Approval rejected.");
                          })}
                          className="btn btn-sm btn-outline-danger"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="h5 text-white mb-3">Timeline</h2>
            <div className="d-grid gap-3">
              {caseDetail.events.length === 0 ? (
                <div className="border border-white/10 rounded p-3 text-zinc-500 bg-white/[0.02]">No events recorded.</div>
              ) : caseDetail.events.map((event) => (
                <div key={event.id} className="border border-white/10 rounded p-3 bg-white/[0.02]">
                  <div className="d-flex align-items-start gap-3">
                    <div className="text-cyan-300 mt-1">
                      {event.event_type.includes("resolved") || event.event_type.includes("completed") ? <FiCheckCircle /> : <FiClock />}
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between gap-3">
                        <div className="text-white fw-semibold">{event.summary}</div>
                        <div className="text-zinc-500 text-sm">{formatDate(event.created_at)}</div>
                      </div>
                      <div className="text-zinc-500 text-sm">{event.event_type} {event.flow_node_key ? `// ${event.flow_node_key}` : ""}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="col-xl-5">
          <section className="mb-4">
            <h2 className="h5 text-white mb-3">Case Data</h2>
            <pre className="border border-white/10 rounded p-3 bg-zinc-950/30 text-zinc-300 text-sm overflow-auto" style={{ maxHeight: 360 }}>
              {formatJson(caseDetail.case_data_json)}
            </pre>
          </section>

          <section className="mb-4">
            <h2 className="h5 text-white mb-3">Documents</h2>
            <div className="border border-white/10 rounded p-3 bg-white/[0.02] mb-3">
              <div className="row g-2 align-items-end">
                <div className="col-md-4">
                  <label htmlFor="document-task" className="text-zinc-500 text-xs text-uppercase font-mono mb-1">Task</label>
                  <select
                    id="document-task"
                    value={selectedTaskId}
                    onChange={(event) => setSelectedTaskId(event.target.value)}
                    className="form-select form-select-sm bg-zinc-950 text-white border-secondary"
                  >
                    <option value="">Case document</option>
                    {caseDetail.tasks.map((task) => (
                      <option key={task.id} value={task.id}>{task.title}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label htmlFor="document-type" className="text-zinc-500 text-xs text-uppercase font-mono mb-1">Document Type</label>
                  <input
                    id="document-type"
                    value={documentType}
                    onChange={(event) => setDocumentType(event.target.value)}
                    className="form-control form-control-sm bg-zinc-950 text-white border-secondary"
                    placeholder="payment_instruction"
                  />
                </div>
                <div className="col-md-4">
                  <label htmlFor="document-file" className="text-zinc-500 text-xs text-uppercase font-mono mb-1">File</label>
                  <input
                    id="document-file"
                    type="file"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    className="form-control form-control-sm bg-zinc-950 text-white border-secondary"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={busyAction === "document-upload"}
                onClick={handleUploadDocument}
                className="btn btn-sm btn-outline-info mt-3 d-inline-flex align-items-center gap-2"
              >
                <FiUpload /> {busyAction === "document-upload" ? "Uploading?" : "Upload Document"}
              </button>
            </div>
            <div className="d-grid gap-3">
              {caseDetail.documents.length === 0 ? (
                <div className="border border-white/10 rounded p-3 text-zinc-500 bg-white/[0.02]">No documents attached.</div>
              ) : caseDetail.documents.map((document) => (
                <div key={document.id} className="border border-white/10 rounded p-3 bg-white/[0.02] d-flex align-items-center gap-3 justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                  <FiFileText className="text-cyan-300" />
                  <div>
                    <div className="text-white">{document.filename}</div>
                    <div className="text-zinc-500 text-sm">{document.document_type || document.mime_type} // {formatDate(document.uploaded_at)}</div>
                  </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light"
                    onClick={() => void runAction(`download-${document.id}`, async () => {
                      await downloadCaseDocument(document.id, document.filename);
                    })}
                  >
                    <FiDownload />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="h5 text-white mb-3">Escalations</h2>
            <div className="d-grid gap-3">
              {caseDetail.escalations.length === 0 ? (
                <div className="border border-white/10 rounded p-3 text-zinc-500 bg-white/[0.02]">No escalations active.</div>
              ) : caseDetail.escalations.map((escalation) => (
                <div key={escalation.id} className="border border-white/10 rounded p-3 bg-white/[0.02]">
                  <div className="d-flex justify-content-between gap-3">
                    <div className="text-white fw-semibold d-flex align-items-center gap-2"><FiAlertTriangle /> {escalation.reason}</div>
                    <StatusPill label={escalation.status} tone={statusTone(escalation.status)} />
                  </div>
                  <div className="text-zinc-500 text-sm mt-2">{escalation.escalation_type} // {formatDate(escalation.triggered_at)}</div>
                  {escalation.status === "triggered" && (
                    <button
                      type="button"
                      disabled={busyAction === `resolve-escalation-${escalation.id}`}
                      onClick={() => void runAction(`resolve-escalation-${escalation.id}`, async () => {
                        await resolveEscalation(caseDetail.id, escalation.id, "Resolved from case detail");
                        await refreshAfterAction("Escalation resolved.");
                      })}
                      className="btn btn-sm btn-outline-warning mt-3"
                    >
                      Resolve Escalation
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <h2 className="h5 text-white mb-3">Case Controls</h2>
            <div className="border border-white/10 rounded p-3 bg-white/[0.02]">
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                className="form-control form-control-sm bg-zinc-950 text-white border-secondary mb-2"
                rows={3}
                placeholder="Add a case note"
              />
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyAction === "note" || !noteText.trim()}
                  onClick={() => void runAction("note", async () => {
                    await addCaseNote(caseDetail.id, noteText);
                    setNoteText("");
                    await refreshAfterAction("Note added.");
                  })}
                  className="btn btn-sm btn-outline-info"
                >
                  Add Note
                </button>
                <button
                  type="button"
                  disabled={busyAction === "close-case" || ["closed", "cancelled"].includes(caseDetail.status)}
                  onClick={() => void runAction("close-case", async () => {
                    await closeCase(caseDetail.id, "Closed from case detail");
                    await refreshAfterAction("Case closed.");
                  })}
                  className="btn btn-sm btn-success"
                >
                  Close Case
                </button>
                <button
                  type="button"
                  disabled={busyAction === "cancel-case" || ["closed", "cancelled"].includes(caseDetail.status)}
                  onClick={() => void runAction("cancel-case", async () => {
                    await cancelCase(caseDetail.id, "Cancelled from case detail");
                    await refreshAfterAction("Case cancelled.");
                  })}
                  className="btn btn-sm btn-outline-danger"
                >
                  Cancel Case
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CaseDetailPage;
