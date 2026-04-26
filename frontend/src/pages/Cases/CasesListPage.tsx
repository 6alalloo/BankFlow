import React, { useEffect, useState } from "react";
import { FiBriefcase, FiClock, FiUser } from "react-icons/fi";
import { fetchCases, type CaseSummary } from "../../api/cases";

const CasesListPage: React.FC = () => {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCases()
      .then(setCases)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load cases"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 p-md-5">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h3 text-white mb-1">Cases</h1>
          <p className="text-slate-400 mb-0">Live BankFlow case records and operational status.</p>
        </div>
      </div>

      {loading && <div className="text-slate-400">Loading cases...</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && (
        <div className="d-grid gap-3">
          {cases.length === 0 ? (
            <div className="border border-white/10 rounded-xl p-4 text-slate-400 bg-white/[0.02]">
              No cases have been created yet.
            </div>
          ) : (
            cases.map((caseItem) => (
              <div key={caseItem.id} className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                <div className="d-flex align-items-start justify-content-between gap-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 text-cyan-300 fw-semibold">
                      <FiBriefcase />
                      {caseItem.case_reference}
                    </div>
                    <div className="text-white mt-1">{caseItem.title || caseItem.case_type}</div>
                    <div className="text-slate-500 text-sm mt-1">{caseItem.case_type}</div>
                  </div>
                  <div className="text-end">
                    <div className="badge bg-info text-dark text-uppercase">{caseItem.status}</div>
                    <div className="text-slate-500 text-sm mt-2 text-uppercase">{caseItem.priority}</div>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-3 mt-3 text-slate-400 text-sm">
                  <span className="d-flex align-items-center gap-1">
                    <FiUser />
                    {caseItem.assignee_user?.full_name || caseItem.assignee_team?.name || "Unassigned"}
                  </span>
                  <span className="d-flex align-items-center gap-1">
                    <FiClock />
                    {new Date(caseItem.opened_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CasesListPage;
