import { useState, useEffect, useCallback, type KeyboardEvent } from "react";
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

const formatAuditDate = (value: string) => new Date(value).toLocaleDateString();
const formatAuditTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

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

  const handleExpandableKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: number, hasDetails: boolean) => {
    if (!hasDetails) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpand(id);
    }
  };

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

  const handleExportJSON = () => {
    if (logs.length === 0) return;
    const jsonContent = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handlePurgeLogs = async () => {
    setIsPurging(true);
    try {
      const response = await apiDelete<{ deleted: number }>('/audit/purge?days=90');
      setPurgeSuccess(`Successfully purged ${response.deleted || 0} records older than 90 days.`);
      setShowPurgeModal(false);
      fetchAuditLogs();
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
    if (action.includes("create")) return "text-[#59d499] border-[#59d499]/20 bg-[#0d2b1a]";
    if (action.includes("update")) return "text-white border-white/[0.08] bg-[#111214]";
    if (action.includes("delete")) return "text-[#ff6363] border-[#ff6363]/20 bg-[#452324]";
    if (action.includes("login")) return "text-[#9c9c9d] border-white/[0.08] bg-[#07080a]";
    return "text-[#6a6b6c] border-white/[0.08] bg-[#07080a]";
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
    if (value === null || value === undefined) return <span className="text-[#6a6b6c] font-mono">-</span>;

    if (typeof value === 'boolean') {
      return value ? (
        <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-semibold font-mono uppercase tracking-widest bg-[#0d2b1a] text-[#59d499] border border-[#59d499]/20 rounded">
          TRUE
        </span>
      ) : (
        <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-semibold font-mono uppercase tracking-widest bg-[#452324] text-[#ff6363] border border-[#ff6363]/20 rounded">
          FALSE
        </span>
      );
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        return (
             <div className="flex flex-col gap-1 border-l border-white/[0.08] pl-2">
                {Object.entries(obj).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-[10px] font-mono">
                        <span className="text-[#6a6b6c]">{formatKey(k)}:</span>
                        <span className="text-white">{formatValue(v)}</span>
                    </div>
                ))}
            </div>
        );
    }

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        try {
            return new Date(value).toLocaleString();
        } catch {
            return String(value);
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
    'node_id', 'nodeid', 'id', 'flow_id', 'case_id', 'org_id',
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
      <div className="flex items-center justify-center h-full bg-[#040506]">
        <div className="p-10 border border-[#ff6363]/20 bg-[#452324]/10 text-center max-w-md rounded-2xl">
            <FiShield className="mx-auto text-5xl text-[#ff6363] mb-6" />
            <h2 className="text-2xl font-semibold font-mono text-white mb-2 uppercase tracking-widest">Access Denied</h2>
            <p className="text-[#ff6363] font-mono text-sm">Administrator privileges required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#040506] text-white overflow-hidden relative font-sans">
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/[0.08] z-10 shrink-0 bg-[#07080a]">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                   <div className="flex items-center gap-3 mb-2">
                        <div className="size-10 flex items-center justify-center border border-white/[0.08] bg-[#111214] text-white rounded-lg">
                            <FiShield size={20} />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-white font-mono flex items-center gap-3">
                            Security Audit Log
                        </h1>
                   </div>
                   <p className="text-[#6a6b6c] text-xs font-mono tracking-widest uppercase pl-14">
                        System Access & Modification Records
                   </p>
                </div>
                
                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiFilter className="text-[#6a6b6c]" size={14} />
                        </div>
                        <select 
                            value={filters.eventType}
                            onChange={(e) => setFilters(prev => ({ ...prev, eventType: e.target.value }))}
                            className="pl-9 pr-8 py-2 bg-[#111214] border border-white/[0.08] text-xs font-mono text-[#9c9c9d] focus:outline-none focus:border-white/[0.18] appearance-none hover:bg-[#1b1c1e] transition-colors cursor-pointer min-w-[180px] uppercase tracking-wider rounded-lg"
                        >
                            <option value="" className="bg-[#111214]">All Events</option>
                            <option value="flow_created" className="bg-[#111214]">Flow Created</option>
                            <option value="flow_updated" className="bg-[#111214]">Flow Updated</option>
                            <option value="flow_deleted" className="bg-[#111214]">Flow Deleted</option>
                    <option value="case_created" className="bg-[#111214]">Case Created</option>
                    <option value="case_completed" className="bg-[#111214]">Case Completed</option>
                    <option value="approval_decided" className="bg-[#111214]">Approval Decided</option>
                            <option value="user_login" className="bg-[#111214]">User Login</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-[#6a6b6c]">
                            <FiChevronRight className="rotate-90" size={12}/>
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiSearch className="text-[#6a6b6c]" size={14} />
                        </div>
                        <select 
                            value={filters.targetType}
                            onChange={(e) => setFilters(prev => ({ ...prev, targetType: e.target.value }))}
                            className="pl-9 pr-8 py-2 bg-[#111214] border border-white/[0.08] text-xs font-mono text-[#9c9c9d] focus:outline-none focus:border-white/[0.18] appearance-none hover:bg-[#1b1c1e] transition-colors cursor-pointer min-w-[150px] uppercase tracking-wider rounded-lg"
                        >
                            <option value="" className="bg-[#111214]">All Targets</option>
                            <option value="flow" className="bg-[#111214]">Flow</option>
                    <option value="case" className="bg-[#111214]">Case</option>
                            <option value="user" className="bg-[#111214]">User</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-[#6a6b6c]">
                            <FiChevronRight className="rotate-90" size={12}/>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-auto">
                        <button 
                            onClick={handleExportCSV}
                            disabled={logs.length === 0}
                            className="px-3 py-2 bg-[#111214] border border-white/[0.08] text-xs font-mono text-[#9c9c9d] hover:bg-[#1b1c1e] hover:border-white/[0.18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 rounded-lg"
                        >
                            <FiDownload size={12} />
                            CSV
                        </button>
                        <button 
                            onClick={handleExportJSON}
                            disabled={logs.length === 0}
                            className="px-3 py-2 bg-[#111214] border border-white/[0.08] text-xs font-mono text-[#9c9c9d] hover:bg-[#1b1c1e] hover:border-white/[0.18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 rounded-lg"
                        >
                            <FiDownload size={12} />
                            JSON
                        </button>
                        <button 
                            onClick={() => setShowPurgeModal(true)}
                            className="px-3 py-2 bg-[#452324]/30 border border-[#ff6363]/20 text-xs font-mono text-[#ff6363] hover:bg-[#452324]/50 hover:border-[#ff6363]/40 transition-colors flex items-center gap-2 rounded-lg"
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
            <div className="mx-8 mt-4 p-3 bg-[#0d2b1a]/40 border border-[#59d499]/20 rounded-lg flex items-center gap-2 z-10">
                <FiShield className="text-[#59d499]" />
                <span className="text-sm text-[#59d499]">{purgeSuccess}</span>
            </div>
        )}

        {/* Purge Confirmation Modal */}
        {showPurgeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040506]/60 backdrop-blur-sm">
                <div className="bg-[#111214] border border-[#ff6363]/20 rounded-2xl p-6 w-[450px] shadow-2xl space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="size-12 flex items-center justify-center bg-[#ff6363]/10 border border-[#ff6363]/20 rounded-xl">
                            <FiAlertTriangle className="text-[#ff6363] text-xl" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Purge Old Logs?</h3>
                            <p className="text-xs text-[#9c9c9d]">This action cannot be undone</p>
                        </div>
                    </div>
                    <p className="text-sm text-[#9c9c9d] leading-relaxed">
                        This will permanently delete all audit log records older than <strong className="text-[#ff6363]">90 days</strong>. 
                        The purge action itself will be logged for compliance.
                    </p>
                    <div className="flex gap-3 justify-end pt-2">
                        <button 
                            onClick={() => setShowPurgeModal(false)}
                            disabled={isPurging}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-[#9c9c9d] hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handlePurgeLogs}
                            disabled={isPurging}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#ff6363] text-white hover:bg-[#ff6363]/90 transition-colors shadow-lg flex items-center gap-2 disabled:opacity-50"
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
            <div className="flex flex-col items-center justify-center py-20 text-[#6a6b6c] gap-4">
                <FiActivity className="animate-spin text-3xl opacity-50" />
                <p className="font-mono text-xs uppercase tracking-widest">Decrypting Audit Trail...</p>
            </div>
        ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#6a6b6c] opacity-60">
                <FiDatabase className="text-4xl mb-4" />
                <p className="font-mono text-xs uppercase tracking-widest">No Records Found</p>
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
                            className={`group relative overflow-hidden border-l-2 transition-all duration-300
                                ${isExpanded 
                                    ? 'bg-[#111214] border-l-white border-y border-r border-y-white/[0.08] border-r-white/[0.08]' 
                                    : 'bg-[#07080a] border-l-[#363739] border-y border-r border-y-white/[0.04] border-r-white/[0.04] hover:border-l-white/[0.18] hover:bg-[#0a0b0d]'}
                            `}
                        >
                            <div className={`flex items-center gap-4 px-4 py-3 ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
                                 onClick={hasDetails ? () => toggleExpand(log.id) : undefined}
                                 onKeyDown={(event) => handleExpandableKeyDown(event, log.id, hasDetails)}
                                 role={hasDetails ? "button" : undefined}
                                 tabIndex={hasDetails ? 0 : undefined}
                            >
                                <div className={`size-8 flex items-center justify-center border ${actionStyles} transition-colors rounded-md`}>
                                    {getActionIcon(log.action)}
                                </div>

                                <div className="flex-1 flex flex-wrap items-center gap-x-6 gap-y-1 min-w-0">
                                    <span className="text-white font-semibold text-xs tracking-wider uppercase font-mono">
                                        {formatActionName(log.action)}
                                    </span>
                                    
                                    <div className="hidden sm:block h-3 w-px bg-white/[0.08]"></div>

                                    <div className="flex items-center gap-2 text-xs text-[#9c9c9d] font-mono">
                                        <FiUser size={12} className="text-[#6a6b6c]"/>
                                        <span className="text-[#9c9c9d] truncate max-w-[200px]">
                                            {log.users?.email || `User ${log.actor_user_id || 'System'}`}
                                        </span>
                                    </div>

                                    {log.entity_type && (
                                        <div className="flex items-center gap-2">
                                            <FiDatabase size={12} className="text-[#6a6b6c]" />
                                            <div className="text-[10px] text-[#6a6b6c] font-mono flex items-center gap-1 uppercase">
                                                <span>{log.entity_type}</span>
                                                <span className="text-[#6a6b6c]">::</span>
                                                <span className="text-[#9c9c9d]">#{log.entity_id}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-6 shrink-0">
                                    <div className="flex items-center gap-2 text-[10px] text-[#6a6b6c] font-mono uppercase tracking-wider">
                                        <span>{formatAuditDate(log.created_at)}</span>
                                        <span className="text-[#9c9c9d]">{formatAuditTime(log.created_at)}</span>
                                    </div>
                                    
                                    {hasDetails && (
                                        <div className={`text-[#6a6b6c] transition-transform duration-300 ${isExpanded ? 'rotate-90 text-white' : 'group-hover:text-[#9c9c9d]'}`}>
                                            <FiChevronRight size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {isExpanded && hasDetails && (
                                <div className="border-t border-white/[0.08] bg-[#040506] px-6 py-4">
                                    <div className="flex items-center gap-2 text-[9px] text-[#6a6b6c] mb-4 uppercase tracking-[0.2em] font-semibold border-b border-white/[0.06] pb-2">
                                        <FiCpu size={12} />
                                        <span>Packet Data Inspection</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12">
                                        {Object.entries(details).map(([key, value]) => (
                                            <div key={key} className="flex flex-col gap-1 min-w-0">
                                                <span className="text-[9px] text-[#6a6b6c] font-mono uppercase tracking-wider truncate border-l-2 border-white/[0.08] pl-2">
                                                    {formatKey(key)}
                                                </span>
                                                <div className="text-xs text-white font-mono break-all pl-2.5">
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
      <div className="flex items-center justify-between border-t border-white/[0.08] px-8 py-4 bg-[#07080a]">
        <p className="text-[10px] text-[#6a6b6c] font-mono uppercase tracking-wider">
            Displaying <span className="text-white">{logs.length}</span> / <span className="text-white">{total}</span> records
        </p>
        <div className="flex gap-1">
            <button
                onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
                disabled={offset === 0}
                className="p-2 border border-white/[0.08] bg-[#111214] text-[#6a6b6c] hover:text-white hover:bg-[#1b1c1e] disabled:opacity-20 disabled:cursor-not-allowed transition-all rounded-lg"
            >
                <FiChevronLeft size={14} />
            </button>
            <button
                onClick={() => setOffset((prev) => prev + limit)}
                disabled={offset + limit >= total}
                className="p-2 border border-white/[0.08] bg-[#111214] text-[#6a6b6c] hover:text-white hover:bg-[#1b1c1e] disabled:opacity-20 disabled:cursor-not-allowed transition-all rounded-lg"
            >
                <FiChevronRight size={14} />
            </button>
        </div>
      </div>
    </div>
  );
}
