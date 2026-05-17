import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiClock, FiShield, FiXCircle } from "react-icons/fi";
import { approveApproval, fetchApprovals, rejectApproval, type ApprovalsQuery } from "../../api/approvals";
import type { CaseApproval } from "../../api/cases";
import { Badge, Button, type BadgeVariant } from "../../components/ui";

const filters: Array<{ key: string; label: string; query: ApprovalsQuery }> = [
  { key: "requested", label: "Pending", query: { status: "requested" } },
  { key: "overdue", label: "Overdue", query: { overdue: true } },
  { key: "approved", label: "Approved", query: { status: "approved" } },
  { key: "rejected", label: "Rejected", query: { status: "rejected" } },
];

const statusVariant = (status: string): BadgeVariant => {
  if (status === "approved") return "mint";
  if (["rejected", "expired"].includes(status)) return "ember";
  if (status === "requested") return "sky";
  return "secondary";
};

const formatDate = (value?: string | null) => {
  if (!value) return "No due date";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Invalid date" : parsed.toLocaleString();
};

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
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#040506] p-6 text-[#9c9c9d]">
      <div className="mb-6">
        <h1 className="mb-1 text-xl font-semibold text-white">Approvals Inbox</h1>
        <p className="text-sm text-[#9c9c9d]">Pending governance decisions and historical approval outcomes.</p>
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
        <div className="rounded-2xl border border-white/[0.08] bg-[#07080a] p-6 text-sm">Loading approvals...</div>
      ) : approvals.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#07080a] p-8 text-center">
          <FiShield className="mx-auto mb-3 text-[#56c2ff]" size={24} />
          <div className="text-sm font-medium text-white">No approvals in this view</div>
          <div className="mt-1 text-xs text-[#6a6b6c]">Switch filters to review completed or rejected decisions.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <div key={approval.id} className="rounded-2xl border border-white/[0.08] bg-[#07080a] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(approval.status)}>{approval.status.replace(/_/g, " ")}</Badge>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#6a6b6c]">
                      {approval.flow_node_key || "approval"}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-white">{approval.approval_label || `Approval #${approval.id}`}</div>
                  <button
                    type="button"
                    onClick={() => navigate(`/cases/${approval.case_id}`)}
                    className="mt-1 text-xs font-mono text-[#9c9c9d] hover:text-white"
                  >
                    {approval.case?.case_reference || `Case #${approval.case_id}`}
                  </button>
                </div>
                <div className="text-right text-xs text-[#9c9c9d]">
                  <div className="flex items-center justify-end gap-2">
                    <FiClock className="text-[#6a6b6c]" />
                    {formatDate(approval.due_at)}
                  </div>
                  <div className="mt-1 text-[#6a6b6c]">Requested {formatDate(approval.requested_at)}</div>
                </div>
              </div>

              {approval.status === "requested" && (
                <div className="mt-4 border-t border-white/[0.08] pt-4">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[#6a6b6c]">Decision Reason</span>
                    <textarea
                      value={reasons[approval.id] ?? ""}
                      onChange={(event) => setReasons((current) => ({ ...current, [approval.id]: event.target.value }))}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-[#6a6b6c] transition-all focus:border-white/[0.18] focus:outline-none focus:ring-1 focus:ring-white/[0.18]"
                      placeholder="Record the basis for this decision"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="primary" size="sm" onClick={() => decide(approval, "approve")} disabled={busy === `approve-${approval.id}`}>
                      <FiCheckCircle className="size-3.5" />
                      Approve
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => decide(approval, "reject")} disabled={busy === `reject-${approval.id}`}>
                      <FiXCircle className="size-3.5" />
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
