import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiAlertTriangle, FiArrowLeft, FiCheckCircle, FiClock, FiDownload, FiFileText, FiUpload } from "react-icons/fi";
import { addCaseNote, cancelCase, closeCase, fetchCaseById, resolveEscalation, type CaseDetail } from "../../api/cases";
import { approveApproval, rejectApproval } from "../../api/approvals";
import { claimTask, completeTask } from "../../api/tasks";
import { downloadCaseDocument, uploadCaseDocument } from "../../api/files";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { buildObjectFromFields, formatDocumentType, getRequiredDocumentTypes, getTaskOutputFields } from "../../utils/caseForms";
import { useAuth } from "../../contexts/useAuth";
import { CaseHeader, CaseSummaryGrid } from "./CaseOverview";
import { formatDate, formatJson, formatLabel, statusBadgeVariant } from "./caseDetailFormatters";

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

  const currentOwner = useMemo(() => {
    if (!caseDetail) return "Unassigned";
    return caseDetail.assignee_user?.full_name || caseDetail.assignee_team?.name || "Unassigned";
  }, [caseDetail]);
  const roleName = user?.role?.name;
  const isAuditor = roleName === "Auditor";
  const canManageCase = roleName === "Admin" || roleName === "Supervisor";
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
  const selectedDocumentRequirements = selectedDocumentTaskId ? documentRequirementsByTaskId.get(selectedDocumentTaskId) : null;

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

  return (
    <div className="p-6 h-full overflow-y-auto custom-scrollbar text-[#8f8f8f]">
      <Link to="/cases" className="text-[#8f8f8f] hover:text-[#0f1012] flex items-center gap-2 mb-4 transition-colors">
        <FiArrowLeft /> Cases
      </Link>

      <CaseHeader caseDetail={caseDetail} />

      {(actionError || actionSuccess) && (
        <div className={`mb-4 p-4 rounded-[10px] text-sm ${actionError ? "bg-[#ffebee] border border-[#b71c1c]/20 text-[#b71c1c]" : "bg-[#e8f5e9] border border-[#1b5e20]/20 text-[#1b5e20]"}`}>
          {actionError || actionSuccess}
        </div>
      )}

      <CaseSummaryGrid caseDetail={caseDetail} currentOwner={currentOwner} />

      <div className="grid grid-cols-1 xl:grid-cols-7 gap-6">
        <div className="xl:col-span-4 space-y-6">
          <section>
            <h2 className="text-sm font-medium text-[#0f1012] uppercase tracking-wider mb-3">Tasks</h2>
            <div className="space-y-3">
              {caseDetail.tasks.length === 0 ? (
                <div className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 text-[#868788] bg-[#fdfdfd]">No tasks for this case yet.</div>
              ) : caseDetail.tasks.map((task) => (
                <div key={task.id} className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 bg-[#fdfdfd]">
                  {(() => {
                    const documentRequirements = documentRequirementsByTaskId.get(task.id);
                    const missingRequiredDocuments = documentRequirements?.missing ?? [];
                    const isDocumentCollection = task.task_type === "document_collection";
                    const isMissingAnyEvidence = isDocumentCollection && (documentRequirements?.required.length ? missingRequiredDocuments.length > 0 : (documentRequirements?.uploadedCount ?? 0) === 0);
                    return (
                      <>
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[#0f1012] font-medium text-sm">{task.title}</div>
                      <div className="text-[#868788] text-xs">{task.task_type} {task.flow_node_key ? `// ${task.flow_node_key}` : ""}</div>
                    </div>
                    <Badge variant={statusBadgeVariant(task.status)}>{formatLabel(task.status)}</Badge>
                  </div>
                  <div className="text-[#8f8f8f] text-xs mt-2">Due: {formatDate(task.due_at)}</div>
                  {isDocumentCollection && documentRequirements && (
                    <div className="mt-3 rounded-[10px] border border-[#0f1012]/[0.06] bg-[#0f1012]/[0.02] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[#868788]">Required evidence</div>
                      {documentRequirements.required.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {documentRequirements.required.map((documentType) => {
                            const uploaded = documentRequirements.uploaded.includes(documentType);
                            return (
                              <span
                                key={documentType}
                                className={`rounded-[10px] border px-2 py-1 text-xs ${
                                  uploaded
                                    ? "border-[#1b5e20]/20 bg-[#e8f5e9] text-[#1b5e20]"
                                    : "border-[#b71c1c]/15 bg-[#ffebee] text-[#b71c1c]"
                                }`}
                              >
                                {formatDocumentType(documentType)} {uploaded ? "uploaded" : "missing"}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-[#8f8f8f]">Attach at least one supporting document before completing this task.</div>
                      )}
                    </div>
                  )}
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
                      {busyAction === `claim-${task.id}` ? "Claiming\u2026" : "Claim"}
                    </Button>
                  )}
                  {!isAuditor && ["pending", "assigned", "claimed", "overdue"].includes(task.status) && (
                    <div className="mt-3 border-t border-[#0f1012]/[0.08] pt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          value={taskDecisionById[task.id] ?? ""}
                          onChange={(event) => setTaskDecisionById((prev) => ({ ...prev, [task.id]: event.target.value }))}
                          className="bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
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
                            className="bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                            placeholder={field.placeholder || field.label}
                            aria-label={field.label}
                          />
                        ))}
                        <textarea
                          value={taskOutputById[task.id] ?? ""}
                          onChange={(event) => setTaskOutputById((prev) => ({ ...prev, [task.id]: event.target.value }))}
                          className="md:col-span-2 bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all resize-none"
                          rows={2}
                          placeholder='Additional output JSON, e.g. {"finding":"clear"}'
                        />
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-2"
                        disabled={busyAction === `task-${task.id}` || isMissingAnyEvidence}
                        onClick={() => handleCompleteTask(task.id)}
                      >
                        {busyAction === `task-${task.id}` ? "Completing\u2026" : "Complete Task"}
                      </Button>
                      {isMissingAnyEvidence && (
                        <div className="mt-2 text-xs text-[#b71c1c]">
                          Upload {missingRequiredDocuments.length > 0 ? missingRequiredDocuments.map(formatDocumentType).join(", ") : "supporting evidence"} before completing.
                        </div>
                      )}
                    </div>
                  )}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-[#0f1012] uppercase tracking-wider mb-3">Approvals</h2>
            <div className="space-y-3">
              {caseDetail.approvals.length === 0 ? (
                <div className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 text-[#868788] bg-[#fdfdfd]">No approvals requested.</div>
              ) : caseDetail.approvals.map((approval) => (
                <div key={approval.id} className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 bg-[#fdfdfd]">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[#0f1012] font-medium text-sm">Approval #{approval.id}</div>
                      <div className="text-[#868788] text-xs">{approval.flow_node_key || "approval node"}</div>
                    </div>
                    <Badge variant={statusBadgeVariant(approval.status)}>{formatLabel(approval.status)}</Badge>
                  </div>
                  <div className="text-[#8f8f8f] text-xs mt-2">Requested: {formatDate(approval.requested_at)}</div>
                  {approval.decision_reason && <div className="text-[#868788] text-xs mt-1">Reason: {approval.decision_reason}</div>}
                  {!isAuditor && approval.status === "requested" && (
                    <div className="mt-3 border-t border-[#0f1012]/[0.08] pt-3">
                      <textarea
                        value={approvalReasonById[approval.id] ?? ""}
                        onChange={(event) => setApprovalReasonById((prev) => ({ ...prev, [approval.id]: event.target.value }))}
                        className="w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all resize-none"
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
            <h2 className="text-sm font-medium text-[#0f1012] uppercase tracking-wider mb-3">Timeline</h2>
            <div className="space-y-3">
              {caseDetail.events.length === 0 ? (
                <div className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 text-[#868788] bg-[#fdfdfd]">No events recorded.</div>
              ) : caseDetail.events.map((event) => (
                <div key={event.id} className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 bg-[#fdfdfd]">
                  <div className="flex items-start gap-3">
                    <div className="text-[#8f8f8f] mt-0.5 shrink-0">
                      {event.event_type.includes("resolved") || event.event_type.includes("completed") ? <FiCheckCircle /> : <FiClock />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-3">
                        <div className="text-[#0f1012] font-medium text-sm">{event.summary}</div>
                        <div className="text-[#868788] text-xs whitespace-nowrap">{formatDate(event.created_at)}</div>
                      </div>
                      <div className="text-[#868788] text-xs">{event.event_type} {event.flow_node_key ? `// ${event.flow_node_key}` : ""}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="xl:col-span-3 space-y-6">
          <section>
            <h2 className="text-sm font-medium text-[#0f1012] uppercase tracking-wider mb-3">Case Data</h2>
            <pre className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 bg-[#fdfdfd] text-[#8f8f8f] text-xs overflow-auto custom-scrollbar" style={{ maxHeight: 360 }}>
              {formatJson(caseDetail.case_data_json)}
            </pre>
          </section>

          <section>
            <h2 className="text-sm font-medium text-[#0f1012] uppercase tracking-wider mb-3">Documents</h2>
            {!isAuditor && (
              <div className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 bg-[#fdfdfd] mb-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div>
                    <label htmlFor="document-task" className="text-[#868788] text-[10px] uppercase mb-1 block tracking-wider">Task</label>
                    <select
                      id="document-task"
                      value={selectedTaskId}
                      onChange={(event) => setSelectedTaskId(event.target.value)}
                      className="w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2 text-sm text-[#020201] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                    >
                      <option value="">Case document</option>
                      {caseDetail.tasks.map((task) => (
                        <option key={task.id} value={task.id}>{task.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="document-type" className="text-[#868788] text-[10px] uppercase mb-1 block tracking-wider">Document Type</label>
                    <input
                      id="document-type"
                      value={documentType}
                      onChange={(event) => setDocumentType(event.target.value)}
                      className="w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                      placeholder="payment_instruction"
                    />
                  </div>
                  <div>
                    <label htmlFor="document-file" className="text-[#868788] text-[10px] uppercase mb-1 block tracking-wider">File</label>
                    <input
                      id="document-file"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) => {
                        selectedFileRef.current = event.target.files?.[0] ?? null;
                      }}
                      className="w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2 text-sm text-[#020201] file:bg-transparent file:border-0 file:text-sm file:font-medium file:text-[#8f8f8f] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                    />
                  </div>
                </div>
                {selectedDocumentRequirements && selectedDocumentRequirements.required.length > 0 && (
                  <div className="mt-3 rounded-[10px] border border-[#0f1012]/[0.06] bg-[#0f1012]/[0.02] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-[#868788]">Required for selected task</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedDocumentRequirements.required.map((documentType) => {
                        const uploaded = selectedDocumentRequirements.uploaded.includes(documentType);
                        return (
                          <button
                            key={documentType}
                            type="button"
                            onClick={() => setDocumentType(documentType)}
                            className={`rounded-[10px] border px-2 py-1 text-xs transition-colors ${
                              uploaded
                                ? "border-[#1b5e20]/20 bg-[#e8f5e9] text-[#1b5e20]"
                                : "border-[#0f1012]/[0.08] bg-[#fdfdfd] text-[#0f1012] hover:border-[#0f1012]/[0.18]"
                            }`}
                          >
                            {formatDocumentType(documentType)} {uploaded ? "uploaded" : "use type"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  disabled={busyAction === "document-upload"}
                  onClick={handleUploadDocument}
                >
                  <FiUpload className="size-3.5" /> {busyAction === "document-upload" ? "Uploading\u2026" : "Upload Document"}
                </Button>
              </div>
            )}
            <div className="space-y-3">
              {caseDetail.documents.length === 0 ? (
                <div className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 text-[#868788] bg-[#fdfdfd]">No documents attached.</div>
              ) : caseDetail.documents.map((document) => (
                <div key={document.id} className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 bg-[#fdfdfd] flex items-center gap-3 justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <FiFileText className="text-[#8f8f8f] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[#0f1012] text-sm truncate">{document.filename}</div>
                      <div className="text-[#868788] text-xs">{document.document_type || document.mime_type} // {formatDate(document.uploaded_at)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-2 text-[#868788] hover:text-[#0f1012] hover:bg-[#0f1012]/[0.05] rounded-lg transition-colors shrink-0"
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
            <h2 className="text-sm font-medium text-[#0f1012] uppercase tracking-wider mb-3">Escalations</h2>
            <div className="space-y-3">
              {caseDetail.escalations.length === 0 ? (
                <div className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 text-[#868788] bg-[#fdfdfd]">No escalations active.</div>
              ) : caseDetail.escalations.map((escalation) => (
                <div key={escalation.id} className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 bg-[#fdfdfd]">
                  <div className="flex justify-between gap-3">
                    <div className="text-[#0f1012] font-medium text-sm flex items-center gap-2"><FiAlertTriangle className="text-[#b71c1c]" /> {escalation.reason}</div>
                    <Badge variant={statusBadgeVariant(escalation.status)}>{formatLabel(escalation.status)}</Badge>
                  </div>
                  <div className="text-[#868788] text-xs mt-2">{escalation.escalation_type} // {formatDate(escalation.triggered_at)}</div>
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
            <h2 className="text-sm font-medium text-[#0f1012] uppercase tracking-wider mb-3">Case Controls</h2>
            <div className="border border-[#0f1012]/[0.08] rounded-[10px] p-4 bg-[#fdfdfd]">
              {isAuditor ? (
                <div className="text-[#868788] text-sm">Auditor access is read-only for case controls.</div>
              ) : (
                <>
                  <textarea
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    className="w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all resize-none mb-3"
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
