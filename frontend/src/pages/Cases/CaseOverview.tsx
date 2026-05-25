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
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant={statusBadgeVariant(caseDetail.status)}>{formatLabel(caseDetail.status)}</Badge>
          <Badge variant={statusBadgeVariant(caseDetail.priority)}>{formatLabel(caseDetail.priority)}</Badge>
          {caseDetail.flow && <Badge variant="secondary">{caseDetail.flow.name}</Badge>}
        </div>
        <h1 className="text-xl font-medium text-[#0f1012] mb-1 tabular-nums">{caseDetail.case_reference}</h1>
        <p className="text-[#8f8f8f] mb-0">{caseDetail.title || formatLabel(caseDetail.case_type)}</p>
      </div>
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="border border-[#0f1012]/[0.06] rounded-[10px] p-3 bg-[#fdfdfd] shadow-card">
            <div className="text-[#868788] text-[10px] uppercase mb-2 tracking-wider">{item.label}</div>
            <div className="flex items-center gap-2 text-[#0f1012] text-sm">
              <Icon className="text-[#868788]" strokeWidth={1.5} /> {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
