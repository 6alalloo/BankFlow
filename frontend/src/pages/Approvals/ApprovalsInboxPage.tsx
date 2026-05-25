import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiClock, FiShield, FiXCircle } from "react-icons/fi";
import { approveApproval, fetchApprovals, rejectApproval, type ApprovalsQuery } from "../../api/approvals";
import type { CaseApproval } from "../../api/cases";
import { Badge, type BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

const filters: Array<{ key: string; label: string; query: ApprovalsQuery }> = [
  { key: "requested", label: "Pending", query: { status: "requested" } },
  { key: "overdue", label: "Overdue", query: { overdue: true } },
  { key: "approved", label: "Approved", query: { status: "approved" } },
  { key: "rejected", label: "Rejected", query: { status: "rejected" } },
];

const statusVariant = (status: string): BadgeVariant => {
  if (status === "approved") return "success";
  if (["rejected", "expired"].includes(status)) return "danger";
  if (status === "requested") return "future";
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

const getDecisionReason = (approvalId: number, reasons: Record<number, string>) => reasons[approvalId]?.trim() || undefined;

const ApprovalsInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("requested");
  const [approvals, setApprovals] = useState<CaseApproval[]>([]);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const currentFilter = useMemo(() => filters.find((filter) => filter.key === activeFilter) ?? filters[0], [activeFilter]);

  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await fetchApprovals(currentFilter.query);
      setApprovals(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [currentFilter]);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  const decide = async (approval: CaseApproval, decision: "approve" | "reject") => {
    try {
      setBusy(`${decision}-${approval.id}`);
      const reason = getDecisionReason(approval.id, reasons);
      if (decision === "approve") {
        await approveApproval(approval.id, reason);
      } else {
        await rejectApproval(approval.id, reason);
      }
      await loadApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${decision} approval`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 text-[#8f8f8f]">
      <div className="mb-8">
        <h1 className="mb-1 text-2xl font-medium text-[#0f1012] tracking-tight">Approvals Inbox</h1>
        <p className="text-sm text-[#8f8f8f]">Pending governance decisions and historical approval outcomes.</p>
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
        <div className="rounded-[10px] border border-[#0f1012]/[0.06] bg-[#fdfdfd] p-6 text-sm shadow-card">Loading approvals&hellip;</div>
      ) : approvals.length === 0 ? (
        <div className="rounded-[10px] border border-[#0f1012]/[0.06] bg-[#fdfdfd] p-8 text-center shadow-card">
          <FiShield className="mx-auto mb-3 text-[#0071e3]" size={24} strokeWidth={1.5} />
          <div className="text-sm font-medium text-[#0f1012]">No approvals in this view</div>
          <div className="mt-1 text-xs text-[#868788]">Switch filters to review completed or rejected decisions.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <div
              key={approval.id}
              data-testid={`approval-row-${approval.case_id}`}
              className="rounded-[10px] border border-[#0f1012]/[0.06] bg-[#fdfdfd] p-5 shadow-card hover:shadow-elevated transition-all"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(approval.status)}>{formatLabel(approval.status)}</Badge>
                    <span className="text-[10px] uppercase tracking-wider text-[#868788]">
                      {approval.flow_node_key || "approval"}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-[#0f1012]">{approval.approval_label || `Approval #${approval.id}`}</div>
                  <button
                    type="button"
                    onClick={() => navigate(`/cases/${approval.case_id}`)}
                    className="mt-1 text-xs text-[#8f8f8f] hover:text-[#0f1012] transition-colors tabular-nums"
                  >
                    {approval.case?.case_reference || `Case #${approval.case_id}`}
                  </button>
                </div>
                <div className="text-right text-xs text-[#8f8f8f]">
                  <div className="flex items-center justify-end gap-2">
                    <FiClock className="text-[#868788]" strokeWidth={1.5} />
                    {formatDate(approval.due_at)}
                  </div>
                  <div className="mt-1 text-[#868788]">Requested {formatDate(approval.requested_at)}</div>
                </div>
              </div>

              {approval.status === "requested" && (
                <div className="mt-4 border-t border-[#0f1012]/[0.06] pt-4">
                  <label className="block">
                    <span className="mb-1 block text-[10px] uppercase tracking-wider text-[#868788]">Decision Reason</span>
                    <textarea
                      value={reasons[approval.id] ?? ""}
                      onChange={(event) => setReasons((current) => ({ ...current, [approval.id]: event.target.value }))}
                      rows={2}
                      className="w-full resize-none rounded-[10px] border border-[#0f1012]/[0.08] bg-[#0f1012]/[0.04] px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] transition-all focus:border-[#0f1012]/[0.18] focus:outline-none focus:ring-1 focus:ring-[#0071e3]/20"
                      placeholder="Record the basis for this decision"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="primary" size="sm" onClick={() => decide(approval, "approve")} disabled={busy === `approve-${approval.id}`}>
                      <FiCheckCircle className="size-3.5" strokeWidth={1.5} />
                      Approve
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => decide(approval, "reject")} disabled={busy === `reject-${approval.id}`}>
                      <FiXCircle className="size-3.5" strokeWidth={1.5} />
                      Reject
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/${approval.case_id}`)}>
                      Open Case
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApprovalsInboxPage;
