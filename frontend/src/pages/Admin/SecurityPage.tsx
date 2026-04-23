import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { apiGet, apiPost, apiDelete } from "../../api/apiClient";
import {
    FiShield,
    FiGlobe,
    FiPlus,
    FiTrash2,
    FiAlertTriangle,
    FiCheck,
    FiX,
    FiLoader,
    FiInfo
} from "react-icons/fi";

interface AllowedDomain {
    id: number;
    domain: string;
    created_by: number;
    created_at: string;
    users?: {
        id: number;
        email: string;
    };
}

interface AllowListResponse {
    data: AllowedDomain[];
}

export default function SecurityPage() {
    const { user } = useAuth();
    const [domains, setDomains] = useState<AllowedDomain[]>([]);
    const [loading, setLoading] = useState(true);
    const [newDomain, setNewDomain] = useState("");
    const [addingDomain, setAddingDomain] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    const fetchDomains = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiGet<AllowListResponse>("/settings/allow-list");
            setDomains(response.data || []);
        } catch (err) {
            console.error("Failed to fetch allow-list:", err);
            // If endpoint doesn't exist yet, show empty list
            setDomains([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDomains();
    }, [fetchDomains]);

    const validateDomain = (domain: string): boolean => {
        // Basic domain validation
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
        return domainRegex.test(domain) || domain.includes(".");
    };

    const handleAddDomain = async () => {
        const trimmedDomain = newDomain.trim().toLowerCase();
        
        if (!trimmedDomain) {
            setError("Please enter a domain");
            return;
        }

        if (!validateDomain(trimmedDomain)) {
            setError("Invalid domain format. Example: api.example.com");
            return;
        }

        if (domains.some(d => d.domain === trimmedDomain)) {
            setError("This domain is already in the allow-list");
            return;
        }

        setAddingDomain(true);
        setError(null);

        try {
            await apiPost("/settings/allow-list", { domain: trimmedDomain });
            setSuccess(`Domain "${trimmedDomain}" added successfully`);
            setNewDomain("");
            fetchDomains();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError("Failed to add domain. Please try again.");
            console.error(err);
        } finally {
            setAddingDomain(false);
        }
    };

    const handleDeleteDomain = async (id: number) => {
        try {
            await apiDelete(`/settings/allow-list/${id}`);
            setSuccess("Domain removed from allow-list");
            setDeleteConfirm(null);
            fetchDomains();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError("Failed to remove domain. Please try again.");
            console.error(err);
        }
    };

    // Admin check
    if (!user || user.role?.name !== "Admin") {
        return (
            <div className="flex items-center justify-center h-full bg-[#020408]">
                <div className="p-10 border border-rose-500/20 bg-rose-950/10 text-center max-w-md" style={{ clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)' }}>
                    <FiShield className="mx-auto text-5xl text-rose-500 mb-6 animate-pulse" />
                    <h2 className="text-2xl font-bold font-mono text-white mb-2 uppercase tracking-widest">Access Denied</h2>
                    <p className="text-rose-400 font-mono text-sm">Administrator privileges required.</p>
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
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 flex items-center justify-center border border-green-500/30 bg-green-950/20 text-green-400">
                        <FiShield size={20} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-widest text-white uppercase font-mono">
                        Security Settings
                    </h1>
                </div>
                <p className="text-cyan-900/60 text-xs font-mono tracking-widest uppercase pl-14">
                    HTTP Allow-List & Security Controls
                </p>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar z-10 space-y-8">
                
                {/* Info Banner */}
                <div className="p-4 bg-blue-950/20 border border-blue-500/20 rounded-lg flex items-start gap-3">
                    <FiInfo className="text-blue-400 mt-0.5 flex-shrink-0" size={18} />
                    <div>
                        <h3 className="text-sm font-bold text-blue-400 mb-1">HTTP Allow-List Enforcement</h3>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Only domains listed below can be accessed by HTTP Request nodes at runtime. 
                            All other domains will be blocked and the request logged. Default policy: <strong className="text-rose-400">DENY ALL</strong>.
                        </p>
                    </div>
                </div>

                {/* Success/Error Messages */}
                {success && (
                    <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                        <FiCheck className="text-emerald-400" />
                        <span className="text-sm text-emerald-300">{success}</span>
                    </div>
                )}
                {error && (
                    <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                        <FiAlertTriangle className="text-rose-400" />
                        <span className="text-sm text-rose-300">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-300">
                            <FiX size={16} />
                        </button>
                    </div>
                )}

                {/* Add Domain Section */}
                <div className="bg-[#050b14] border border-white/5 rounded-xl p-6">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FiPlus className="text-cyan-500" />
                        Add Allowed Domain
                    </h2>
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                                placeholder="api.example.com"
                                className="w-full pl-10 pr-4 py-3 bg-[#020408] border border-white/10 rounded-lg text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none font-mono text-sm"
                            />
                        </div>
                        <button
                            onClick={handleAddDomain}
                            disabled={addingDomain}
                            className="px-6 py-3 bg-cyan-500 text-navy-950 font-bold rounded-lg hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            {addingDomain ? (
                                <FiLoader className="animate-spin" />
                            ) : (
                                <FiPlus />
                            )}
                            Add Domain
                        </button>
                    </div>
                </div>

                {/* Domain List */}
                <div className="bg-[#050b14] border border-white/5 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <FiGlobe className="text-green-500" />
                            Allowed Domains
                        </h2>
                        <span className="text-xs text-slate-500 font-mono">
                            {domains.length} domain{domains.length !== 1 ? 's' : ''} configured
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-cyan-900">
                            <FiLoader className="animate-spin text-2xl" />
                        </div>
                    ) : domains.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <FiAlertTriangle className="text-3xl text-amber-500 mb-3" />
                            <p className="text-sm font-mono">No domains configured</p>
                            <p className="text-xs text-slate-600 mt-1">All HTTP requests will be blocked</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {domains.map((domain) => (
                                <div 
                                    key={domain.id} 
                                    className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 flex items-center justify-center bg-green-500/10 border border-green-500/20 rounded text-green-400">
                                            <FiCheck size={14} />
                                        </div>
                                        <div>
                                            <span className="text-white font-mono text-sm">{domain.domain}</span>
                                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                Added by {domain.users?.email || `User #${domain.created_by}`} • {new Date(domain.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    {deleteConfirm === domain.id ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">Remove?</span>
                                            <button
                                                onClick={() => handleDeleteDomain(domain.id)}
                                                className="px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded hover:bg-rose-600 transition-colors"
                                            >
                                                Yes
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(null)}
                                                className="px-3 py-1.5 bg-slate-700 text-white text-xs font-medium rounded hover:bg-slate-600 transition-colors"
                                            >
                                                No
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setDeleteConfirm(domain.id)}
                                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                            title="Remove domain"
                                        >
                                            <FiTrash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
