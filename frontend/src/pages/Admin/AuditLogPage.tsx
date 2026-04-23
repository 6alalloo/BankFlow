import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { apiGet, apiDelete } from "../../api/apiClient";
import { 
    FiShield, 
    FiActivity, 
    FiUser, 
    FiSearch, 
    FiFilter,
    FiPlusCircle,
    FiEdit3,
    FiTrash2,
    FiLogIn,
    FiLogOut,
    FiChevronRight,
    FiChevronLeft,
    FiDatabase,
    FiCpu,
    FiDownload,
    FiAlertTriangle,
    FiLoader
} from "react-icons/fi";

interface AuditLog {
  id: number;
  action: string;
  actor_user_id: number | null;
  entity_type: string | null;
  entity_id: number | null;
  data_json: string | null;
  created_at: string;
  users?: {
    id: number;
    email: string;
  };
}

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25); 
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({
    eventType: "",
    targetType: "",
  });
  const [expandedLogs, setExpandedLogs] = useState<number[]>([]);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (filters.eventType) params.append("eventType", filters.eventType);
      if (filters.targetType) params.append("targetType", filters.targetType);

      const response = await apiGet<AuditLogsResponse>(`/audit?${params.toString()}`);
      setLogs(response.data);
      setTotal(response.total);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, offset, filters]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const toggleExpand = (id: number) => {
    setExpandedLogs(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // Export logs as CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    
    const headers = ['ID', 'Action', 'User', 'Entity Type', 'Entity ID', 'Timestamp'];
    const rows = logs.map(log => [
      log.id,
      log.action,
      log.users?.email || `User #${log.actor_user_id}`,
      log.entity_type || '',
      log.entity_id || '',
      new Date(log.created_at).toISOString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Export logs as JSON
  const handleExportJSON = () => {
    if (logs.length === 0) return;
    
    const jsonContent = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  // Purge old logs (>90 days)
  const handlePurgeLogs = async () => {
    setIsPurging(true);
    try {
      const response = await apiDelete<{ deleted: number }>('/audit/purge?days=90');
      setPurgeSuccess(`Successfully purged ${response.deleted || 0} records older than 90 days.`);
      setShowPurgeModal(false);
      fetchAuditLogs(); // Refresh the list
      setTimeout(() => setPurgeSuccess(null), 5000);
    } catch (error) {
      console.error('Failed to purge logs:', error);
      setPurgeSuccess('Failed to purge logs. Please try again.');
    } finally {
      setIsPurging(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes("create")) return <FiPlusCircle />;
    if (action.includes("update")) return <FiEdit3 />;
    if (action.includes("delete")) return <FiTrash2 />;
    if (action.includes("login")) return <FiLogIn />;
    if (action.includes("logout")) return <FiLogOut />;
    return <FiActivity />;
  };

  const getActionStyles = (action: string) => {
    if (action.includes("create")) return "text-emerald-400 border-emerald-500/30 bg-emerald-950/20";
    if (action.includes("update")) return "text-blue-400 border-blue-500/30 bg-blue-950/20";
    if (action.includes("delete")) return "text-rose-400 border-rose-500/30 bg-rose-950/20";
    if (action.includes("login")) return "text-amber-400 border-amber-500/30 bg-amber-950/20";
    return "text-slate-400 border-slate-500/30 bg-slate-900/40";
  };

  const formatActionName = (action: string) => {
    return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1') 
      .replace(/_/g, ' ')         
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-slate-600 font-mono">-</span>;

    if (typeof value === 'boolean') {
      return value ? (
        <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          TRUE
        </span>
      ) : (
        <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">
          FALSE
        </span>
      );
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        return (
             <div className="flex flex-col gap-1 border-l border-white/10 pl-2">
                {Object.entries(obj).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-[10px] font-mono">
                        <span className="text-cyan-700">{formatKey(k)}:</span>
                        <span className="text-cyan-100">{formatValue(v)}</span>
                    </div>
                ))}
            </div>
        );
    }

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        try {
            return new Date(value).toLocaleString();
        } catch {
            // Invalid date format, fall through to string display
        }
    }

    return String(value);
  };

  const parseDetails = (log: AuditLog) => {
    try {
      if (!log.data_json) return {};
      
      const raw = JSON.parse(log.data_json);
      const { details, ...topLevel } = raw;
      let flat = { ...topLevel };
      if (details && typeof details === 'object') {
          flat = { ...flat, ...details };
      }

      const bannedKeys = [
          'ipaddress', 'useragent', 'ip_address', 'user_agent',
          'node_id', 'nodeid', 'id', 'workflow_id', 'execution_id', 'org_id',
          'nodetype', 'node_type', 'kind'
      ];

      const clean: Record<string, unknown> = {};
      
      const actorName = log.users?.email || `User #${log.actor_user_id}`;
      clean["Performed By"] = actorName;

      const nodeTypeKey = Object.keys(flat).find(k => k.toLowerCase() === 'node_type' || k.toLowerCase() === 'nodetype' || k.toLowerCase() === 'kind');
      if (nodeTypeKey && flat[nodeTypeKey]) {
          let typeVal = flat[nodeTypeKey];
          if (typeof typeVal === 'string') {
               typeVal = typeVal.replace(/node$/i, '');
               typeVal = typeVal.split(/[_ ]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          }
          clean["Node Type"] = typeVal;
      }

      Object.entries(flat).forEach(([k, v]) => {
          const lowerK = k.toLowerCase().replace(/_/g, '');
          const isBanned = bannedKeys.some(b => b.replace(/_/g, '') === lowerK);
          
          if (!isBanned) {
              clean[k] = v;
          }
      });

      return clean;

    } catch {
        return {}; 
    }
  };

  if (!user || user.role?.name !== "Admin") {
    return (
      <div className="flex items-center justify-center h-full bg-[#020408]">
        <div className="p-10 border border-rose-500/20 bg-rose-950/10 text-center max-w-md clip-path-polygon" style={{ clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)' }}>
            <FiShield className="mx-auto text-5xl text-rose-500 mb-6 animate-pulse" />
            <h2 className="text-2xl font-bold font-mono text-white mb-2 uppercase tracking-widest">Access Denied</h2>
            <p className="text-rose-400 font-mono text-sm">Clearance Level Insufficient. Administrator privileges required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#020408] text-white overflow-hidden relative font-sans">
        {/* Tech Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

        {/* Header */}
        <div className="px-8 py-6 border-b border-cyan-900/20 z-10 shrink-0 bg-[#020408]/90 backdrop-blur-md">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                   <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 flex items-center justify-center border border-cyan-500/30 bg-cyan-950/20 text-cyan-400">
                            <FiShield size={20} />
                        </div>
                        <h1 className="text-2xl font-bold tracking-widest text-white uppercase font-mono flex items-center gap-3">
                            Security Audit Log
                        </h1>
                   </div>
                   <p className="text-cyan-900/60 text-xs font-mono tracking-widest uppercase pl-14">
                        System Access & Modification Records // Secure Storage
                   </p>
                </div>
                
                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiFilter className="text-cyan-700" size={14} />
                        </div>
                        <select 
                            value={filters.eventType}
                            onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value }))}
                            className="pl-9 pr-8 py-2 bg-[#050b14]/80 border border-cyan-900/30 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500/50 appearance-none hover:bg-cyan-950/20 transition-colors cursor-pointer min-w-[180px] uppercase tracking-wider"
                        >
                            <option value="" className="bg-[#020408]">All Events</option>
                            <option value="workflow_created" className="bg-[#020408]">Workflow Created</option>
                            <option value="workflow_updated" className="bg-[#020408]">Workflow Updated</option>
                            <option value="workflow_deleted" className="bg-[#020408]">Workflow Deleted</option>
                            <option value="execution_started" className="bg-[#020408]">Execution Started</option>
                            <option value="execution_completed" className="bg-[#020408]">Execution Completed</option>
                            <option value="execution_failed" className="bg-[#020408]">Execution Failed</option>
                            <option value="user_login" className="bg-[#020408]">User Login</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-cyan-700">
                            <FiChevronRight className="rotate-90" size={12}/>
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiSearch className="text-cyan-700" size={14} />
                        </div>
                        <select 
                            value={filters.targetType}
                            onChange={(e) => setFilters(prev => ({ ...prev, targetType: e.target.value }))}
                            className="pl-9 pr-8 py-2 bg-[#050b14]/80 border border-cyan-900/30 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500/50 appearance-none hover:bg-cyan-950/20 transition-colors cursor-pointer min-w-[150px] uppercase tracking-wider"
                        >
                            <option value="" className="bg-[#020408]">All Targets</option>
                            <option value="workflow" className="bg-[#020408]">Workflow</option>
                            <option value="execution" className="bg-[#020408]">Execution</option>
                            <option value="user" className="bg-[#020408]">User</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-cyan-700">
                            <FiChevronRight className="rotate-90" size={12}/>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-auto">
                        <div className="relative group">
                            <button 
                                onClick={handleExportCSV}
                                disabled={logs.length === 0}
                                className="px-3 py-2 bg-[#050b14]/80 border border-cyan-900/30 text-xs font-mono text-cyan-300 hover:bg-cyan-950/20 hover:border-cyan-500/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FiDownload size={12} />
                                CSV
                            </button>
                        </div>
                        <button 
                            onClick={handleExportJSON}
                            disabled={logs.length === 0}
                            className="px-3 py-2 bg-[#050b14]/80 border border-cyan-900/30 text-xs font-mono text-cyan-300 hover:bg-cyan-950/20 hover:border-cyan-500/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <FiDownload size={12} />
                            JSON
                        </button>
                        <button 
                            onClick={() => setShowPurgeModal(true)}
                            className="px-3 py-2 bg-rose-950/30 border border-rose-500/30 text-xs font-mono text-rose-400 hover:bg-rose-950/50 hover:border-rose-500/50 transition-colors flex items-center gap-2"
                        >
                            <FiTrash2 size={12} />
                            Purge Old
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Success Banner */}
        {purgeSuccess && (
            <div className="mx-8 mt-4 p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 z-10">
                <FiShield className="text-emerald-400" />
                <span className="text-sm text-emerald-300">{purgeSuccess}</span>
            </div>
        )}

        {/* Purge Confirmation Modal */}
        {showPurgeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-[#0a0e1a] border border-rose-500/30 rounded-xl p-6 w-[450px] shadow-2xl space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 flex items-center justify-center bg-rose-500/10 border border-rose-500/30 rounded-lg">
                            <FiAlertTriangle className="text-rose-400 text-xl" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Purge Old Logs?</h3>
                            <p className="text-xs text-slate-400">This action cannot be undone</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                        This will permanently delete all audit log records older than <strong className="text-rose-400">90 days</strong>. 
                        The purge action itself will be logged for compliance.
                    </p>
                    <div className="flex gap-3 justify-end pt-2">
                        <button 
                            onClick={() => setShowPurgeModal(false)}
                            disabled={isPurging}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handlePurgeLogs}
                            disabled={isPurging}
                            className="px-4 py-2 rounded-lg text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-lg flex items-center gap-2 disabled:opacity-50"
                        >
                            {isPurging ? (
                                <>
                                    <FiLoader className="animate-spin" />
                                    Purging...
                                </>
                            ) : (
                                <>
                                    <FiTrash2 />
                                    Confirm Purge
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}

      {/* Logs Feed */}
      <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar z-10 space-y-2">
        {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-cyan-900 gap-4">
                <FiActivity className="animate-spin text-3xl opacity-50" />
                <p className="font-mono text-xs uppercase tracking-widest animate-pulse">Decrypting Audit Trail...</p>
            </div>
        ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500 opacity-60">
                <FiDatabase className="text-4xl mb-4 text-cyan-900" />
                <p className="font-mono text-xs uppercase tracking-widest text-cyan-800">No Records Found</p>
            </div>
        ) : (
            <>
                {logs.map((log, idx) => {
                    const details = parseDetails(log);
                    const isExpanded = expandedLogs.includes(log.id);
                    const actionStyles = getActionStyles(log.action);
                    const hasDetails = details && Object.keys(details).length > 0;

                    return (
                        <div 
                            key={log.id} 
                            style={{ animationDelay: `${idx * 20}ms` }}
                            className={`group relative overflow-hidden border-l-2 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards
                                ${isExpanded 
                                    ? 'bg-[#080c14] border-l-cyan-500 border-y border-r border-y-cyan-500/30 border-r-cyan-500/30' 
                                    : 'bg-[#03060c] border-l-slate-700 border-y border-r border-y-white/5 border-r-white/5 hover:border-l-cyan-500/50 hover:bg-[#050910]'}
                            `}
                        >
                            <div className={`flex items-center gap-4 px-4 py-3 ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
                                 onClick={hasDetails ? () => toggleExpand(log.id) : undefined}
                            >
                                {/* Icon Badge */}
                                <div className={`w-8 h-8 flex items-center justify-center border ${actionStyles} transition-colors`}>
                                    {getActionIcon(log.action)}
                                </div>

                                {/* Content Line */}
                                <div className="flex-1 flex flex-wrap items-center gap-x-6 gap-y-1 min-w-0">
                                    <span className="text-white font-bold text-xs tracking-wider uppercase font-mono">
                                        {formatActionName(log.action)}
                                    </span>
                                    
                                    <div className="hidden sm:block h-3 w-px bg-white/10"></div>

                                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                                        <FiUser size={12} className="text-cyan-700"/>
                                        <span className="text-cyan-100/70 truncate max-w-[200px]">
                                            {log.users?.email || `User ${log.actor_user_id || 'System'}`}
                                        </span>
                                    </div>

                                    {log.entity_type && (
                                        <div className="flex items-center gap-2">
                                            <FiDatabase size={12} className="text-cyan-900" />
                                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 uppercase">
                                                <span>{log.entity_type}</span>
                                                <span className="text-cyan-700">::</span>
                                                <span className="text-cyan-500">#{log.entity_id}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Time & Chevron */}
                                <div className="flex items-center gap-6 shrink-0">
                                    <div className="flex items-center gap-2 text-[10px] text-cyan-900 font-mono uppercase tracking-wider">
                                        <span>{new Date(log.created_at).toLocaleDateString()}</span>
                                        <span className="text-cyan-600">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                                    </div>
                                    
                                    {hasDetails && (
                                        <div className={`text-cyan-700 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-cyan-400' : 'group-hover:text-cyan-500'}`}>
                                            <FiChevronRight size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Details Panel - Tech Grid */}
                            {isExpanded && hasDetails && (
                                <div className="border-t border-cyan-900/30 bg-[#020408] px-6 py-4 animate-in slide-in-from-top-1">
                                    <div className="flex items-center gap-2 text-[9px] text-cyan-600 mb-4 uppercase tracking-[0.2em] font-bold border-b border-white/5 pb-2">
                                        <FiCpu size={12} />
                                        <span>Packet Data Inspection</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12">
                                        {Object.entries(details).map(([key, value]) => (
                                            <div key={key} className="flex flex-col gap-1 min-w-0">
                                                <span className="text-[9px] text-cyan-900 font-mono uppercase tracking-wider truncate border-l-2 border-cyan-900/50 pl-2">
                                                    {formatKey(key)}
                                                </span>
                                                <div className="text-xs text-cyan-100 font-mono break-all pl-2.5">
                                                    {formatValue(value)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </>
        )}
      </div>

       {/* Pagination */}
      <div className="flex items-center justify-between border-t border-white/5 px-8 py-4 bg-[#020408]/90">
        <p className="text-[10px] text-cyan-900 font-mono uppercase tracking-wider">
            Displaying <span className="text-cyan-400">{logs.length}</span> / <span className="text-cyan-400">{total}</span> records
        </p>
        <div className="flex gap-1">
            <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="p-2 border border-cyan-900/30 bg-cyan-950/10 text-cyan-600 hover:text-cyan-400 hover:bg-cyan-900/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all clip-path-polygon"
                style={{ clipPath: 'polygon(5px 0, 100% 0, 100% 100%, 0 100%, 0 5px)' }}
            >
                <FiChevronLeft size={14} />
            </button>
            <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="p-2 border border-cyan-900/30 bg-cyan-950/10 text-cyan-600 hover:text-cyan-400 hover:bg-cyan-900/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all clip-path-polygon"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)' }}
            >
                <FiChevronRight size={14} />
            </button>
        </div>
      </div>
    </div>
  );
}
