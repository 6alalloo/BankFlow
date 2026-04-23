// src/pages/Executions/executionsListPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiActivity, FiUser, FiZap, FiClock, FiRefreshCw, FiChevronRight } from "react-icons/fi";
import {
  fetchExecutions,
  type ExecutionSummary,
  type ExecutionStatus,
} from "../../api/executions";

type StatusFilter = "all" | ExecutionStatus;

const POLL_INTERVAL_MS = 3000;

const ExecutionsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [workflowIdFilterText] = useState("");

  const pollTimerRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);

  const workflowIdFilter = useMemo(() => {
    const trimmed = workflowIdFilterText.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [workflowIdFilterText]);

  const loadExecutions = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const data = await fetchExecutions();
      setExecutions(data);
    } catch (err) {
      console.error("[ExecutionsListPage] Failed to load executions:", err);
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    void loadExecutions();
  }, []);

  const filteredExecutions = useMemo(() => {
    return executions.filter((ex) => {
      if (statusFilter !== "all" && ex.status !== statusFilter) return false;
      if (workflowIdFilter != null && ex.workflow_id !== workflowIdFilter) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;

      const wfName = ex.workflows?.name?.toLowerCase() ?? "";
      const idStr = String(ex.id);
      return wfName.includes(q) || idStr.includes(q);
    });
  }, [executions, statusFilter, search, workflowIdFilter]);

  const shouldPoll = useMemo(() => {
    if (statusFilter === "running") return true;
    return executions.some((ex) => ex.status === "running" || ex.status === "queued");
  }, [executions, statusFilter]);

  useEffect(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    if (!shouldPoll) return;

    pollTimerRef.current = window.setInterval(() => {
      void loadExecutions({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [shouldPoll]);

  const getTriggerIcon = (type: string) => {
      switch(type?.toLowerCase()) {
          case 'manual': return <FiUser />;
          case 'webhook': return <FiZap />;
          case 'schedule': return <FiClock />;
          default: return <FiActivity />;
      }
  };

  return (
    <div className="h-full flex flex-col bg-[#020408] text-white overflow-hidden relative font-sans">
       {/* Tech Grid Background */}
       <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Header */}
      <div className="px-8 py-6 border-b border-cyan-900/20 z-10 shrink-0 bg-[#020408]/90 backdrop-blur-md">
        <div className="flex items-end justify-between mb-8">
            <div>
                <h1 className="text-2xl font-bold tracking-widest text-white mb-1 uppercase font-mono flex items-center gap-3">
                    <FiActivity className="text-cyan-500" /> System Executions
                </h1>
                <p className="text-cyan-900/60 text-xs font-mono tracking-widest uppercase">Real-time Automation Monitoring v2.4.0</p>
            </div>
            <div className="flex gap-3">
                 {/* Refresh Button */}
                <button 
                    onClick={() => loadExecutions({ silent: false })}
                    disabled={refreshing || loading}
                    className="group p-2.5 bg-cyan-950/10 border border-cyan-900/30 text-cyan-500 hover:text-cyan-300 hover:bg-cyan-900/20 hover:border-cyan-500/50 transition-all disabled:opacity-50 clip-path-polygon"
                    style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
                >
                    <FiRefreshCw className={`group-hover:rotate-180 transition-transform duration-700 ${refreshing ? "animate-spin" : ""}`} size={16} />
                </button>
            </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-6">
             {/* Search */}
            <div className="relative flex-1 max-w-lg group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <FiSearch className="text-cyan-900 group-focus-within:text-cyan-500 transition-colors" />
                </div>
                <input 
                    type="text" 
                    placeholder="SEARCH PROTOCOL LOGS..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[#050b14] border border-cyan-900/30 pl-10 pr-4 py-2 text-xs font-mono text-cyan-100 placeholder:text-cyan-900/50 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all uppercase tracking-wider"
                />
            </div>

            {/* Status Filters - Tech Tabs */}
            <div className="flex items-center gap-2">
                {(['all', 'running', 'completed', 'failed'] as const).map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-widest transition-all duration-300 border
                            ${statusFilter === s 
                                ? 'bg-cyan-500/10 border-cyan-400/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]' 
                                : 'bg-[#050b14] border-white/10 text-slate-500 hover:text-cyan-300 hover:border-cyan-500/40'}
                        `}
                    >
                        {s}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar z-10 space-y-2">
          {loading && !refreshing ? (
              <div className="flex justify-center pt-24 flex-col items-center">
                  <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
                  <span className="text-cyan-900 text-xs font-mono uppercase tracking-widest animate-pulse">Scanning Logs...</span>
              </div>
          ) : filteredExecutions.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-24 text-slate-500 opacity-60">
                  <FiActivity size={48} className="text-cyan-900/50 mb-4" />
                  <h3 className="text-sm font-mono text-cyan-800 uppercase tracking-widest">No Logs Found</h3>
              </div>
          ) : (
              <div className="pb-8 space-y-2">
                  {filteredExecutions.map((ex) => (
                      <div 
                        key={ex.id}
                        onClick={() => navigate(`/executions/${ex.id}`)}
                        className="group relative flex items-center justify-between p-3 pl-4 bg-[#050b14] border border-white/5 hover:border-cyan-500/30 cursor-pointer transition-all duration-200 hover:bg-cyan-950/10 hover:shadow-[0_0_15px_rgba(6,182,212,0.05)]"
                      >
                          {/* Left Accent Bar */}
                          <div className={`absolute left-0 top-0 bottom-0 w-0.5 transition-colors duration-300
                              ${ex.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : ''}
                              ${ex.status === 'failed' ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : ''}
                              ${ex.status === 'running' ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]' : ''}
                              ${!['completed','failed','running'].includes(ex.status) ? 'bg-slate-700' : ''}
                          `} />

                          <div className="flex items-center gap-4 z-10">
                               {/* ID Badge */}
                               <div className="w-12 h-12 flex items-center justify-center bg-[#020408] border border-white/5 group-hover:border-cyan-500/20 transition-colors">
                                   <span className="font-mono text-xs text-slate-500 group-hover:text-cyan-400">#{ex.id}</span>
                               </div>

                              <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-3">
                                      <span className="text-slate-200 font-bold text-sm tracking-wide group-hover:text-cyan-400 transition-colors uppercase">
                                          {ex.workflows?.name || "Untitled Protocol"}
                                      </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-wider text-slate-600">
                                      <span className={`flex items-center gap-1.5
                                          ${ex.status === 'failed' ? 'text-rose-500' : ''}
                                          ${ex.status === 'running' ? 'text-amber-500' : ''}
                                          ${ex.status === 'completed' ? 'text-emerald-500' : ''}
                                      `}>
                                          {ex.status}
                                      </span>
                                      <span className="text-cyan-900">//</span>
                                      <span className="flex items-center gap-1.5 text-slate-500">
                                          {getTriggerIcon(ex.trigger_type || 'manual')} 
                                          <span>{ex.trigger_type || 'MANUAL'}</span>
                                      </span>
                                  </div>
                              </div>
                          </div>

                          <div className="flex items-center gap-8 z-10 pr-4">
                                <div className="text-right hidden sm:block">
                                    <div className="text-[9px] uppercase tracking-wider text-cyan-900 mb-0.5">Exec Time</div>
                                    <div className="font-mono text-xs text-cyan-400">
                                        {ex.duration_ms ? `${(ex.duration_ms/1000).toFixed(3)}s` : '--'}
                                    </div>
                                </div>
                                <div className="text-right min-w-[80px]">
                                    <div className="text-[9px] uppercase tracking-wider text-cyan-900 mb-0.5">Timestamp</div>
                                    <div className="text-xs text-slate-400 font-mono">
                                        {new Date(ex.started_at || '').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                                    </div>
                                </div>
                                <FiChevronRight className="text-cyan-900 opacity-0 group-hover:opacity-100 group-hover:text-cyan-500 transition-all -translate-x-2 group-hover:translate-x-0" />
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );
};

export default ExecutionsListPage;
