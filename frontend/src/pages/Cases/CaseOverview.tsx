import { FiClock, FiGitBranch, FiShield, FiUser } from "react-icons/fi";

import type { CaseDetail } from "../../api/cases";
import { Badge } from "../../components/ui/Badge";
import { formatDate, formatLabel, statusBadgeVariant } from "./caseDetailFormatters";

type CaseOverviewProps = {
  caseDetail: CaseDetail;
  currentOwner: string;
};

export function CaseHeader({ caseDetail }: { caseDetail: CaseDetail }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-2xl font-medium text-[#0f1012] tabular-nums tracking-tight">
          {caseDetail.case_reference}
        </h1>
        <Badge variant={statusBadgeVariant(caseDetail.status)}>{formatLabel(caseDetail.status)}</Badge>
        <Badge variant={statusBadgeVariant(caseDetail.priority)}>{formatLabel(caseDetail.priority)}</Badge>
      </div>
      <p className="text-[#8f8f8f] text-sm">{caseDetail.title || formatLabel(caseDetail.case_type)}</p>
      {caseDetail.flow && (
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[#868788]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3]" />
          {caseDetail.flow.name}
        </div>
      )}
    </div>
  );
}

export function CaseSummaryGrid({ caseDetail, currentOwner }: CaseOverviewProps) {
  const items = [
    { label: "Owner", value: currentOwner, icon: FiUser },
    { label: "Opened", value: formatDate(caseDetail.opened_at), icon: FiClock },
    { label: "Current Node", value: caseDetail.current_node_key || "None", icon: FiGitBranch },
    { label: "Intake", value: caseDetail.intake_source || "manual", icon: FiShield },
  ];

  return (
    <div className="flex flex-wrap gap-6 mb-8 pb-6 border-b border-[#0f1012]/[0.06]">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0f1012]/[0.03]">
              <Icon className="text-[#868788]" size={14} strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#868788] font-medium">{item.label}</div>
              <div className="text-[#0f1012] text-sm font-medium">{item.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
