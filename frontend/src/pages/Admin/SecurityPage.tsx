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

const formatSecurityDate = (value: string) => new Date(value).toLocaleDateString();

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
            setDomains([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDomains();
    }, [fetchDomains]);

    const validateDomain = (domain: string): boolean => {
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
                <div className="flex items-center gap-3 mb-2">
                    <div className="size-10 flex items-center justify-center border border-white/[0.08] bg-[#111214] text-white rounded-lg">
                        <FiShield size={20} />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-white font-mono">
                        Security Settings
                    </h1>
                </div>
                <p className="text-[#6a6b6c] text-xs font-mono tracking-widest uppercase pl-14">
                    HTTP Allow-List & Security Controls
                </p>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar z-10 space-y-8">
                
                {/* Info Banner */}
                <div className="p-4 bg-[#07080a] border border-white/[0.08] rounded-xl flex items-start gap-3">
                    <FiInfo className="text-white mt-0.5 flex-shrink-0" size={18} />
                    <div>
                        <h3 className="text-sm font-semibold text-white mb-1">HTTP Allow-List Enforcement</h3>
                        <p className="text-xs text-[#9c9c9d] leading-relaxed">
                            Only domains listed below can be accessed by HTTP Request nodes at runtime. 
                            All other domains will be blocked and the request logged. Default policy: <strong className="text-[#ff6363]">DENY ALL</strong>.
                        </p>
                    </div>
                </div>

                {/* Success/Error Messages */}
                {success && (
                    <div className="p-3 bg-[#0d2b1a]/40 border border-[#59d499]/20 rounded-lg flex items-center gap-2">
                        <FiCheck className="text-[#59d499]" />
                        <span className="text-sm text-[#59d499]">{success}</span>
                    </div>
                )}
                {error && (
                    <div className="p-3 bg-[#452324]/40 border border-[#ff6363]/20 rounded-lg flex items-center gap-2">
                        <FiAlertTriangle className="text-[#ff6363]" />
                        <span className="text-sm text-[#ff6363]">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-[#ff6363] hover:text-[#ff6363]/80">
                            <FiX size={16} />
                        </button>
                    </div>
                )}

                {/* Add Domain Section */}
                <div className="bg-[#07080a] border border-white/[0.08] rounded-xl p-6">
                    <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FiPlus className="text-white" />
                        Add Allowed Domain
                    </h2>
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6b6c]" />
                            <input
                                type="text"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                                placeholder="api.example.com"
                                className="w-full pl-10 pr-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-lg text-white placeholder:text-[#6a6b6c] focus:border-white/[0.18] focus:outline-none focus:ring-1 focus:ring-white/[0.18] font-mono text-sm transition-all"
                            />
                        </div>
                        <button
                            onClick={handleAddDomain}
                            disabled={addingDomain}
                            className="px-6 py-3 bg-[#e6e6e6] text-[#040506] font-semibold rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
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
                <div className="bg-[#07080a] border border-white/[0.08] rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                            <FiGlobe className="text-white" />
                            Allowed Domains
                        </h2>
                        <span className="text-xs text-[#6a6b6c] font-mono">
                            {domains.length} domain{domains.length !== 1 ? 's' : ''} configured
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-[#6a6b6c]">
                            <FiLoader className="animate-spin text-2xl" />
                        </div>
                    ) : domains.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-[#6a6b6c]">
                            <FiAlertTriangle className="text-3xl text-[#ff6363] mb-3" />
                            <p className="text-sm font-mono">No domains configured</p>
                            <p className="text-xs text-[#6a6b6c] mt-1">All HTTP requests will be blocked</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.04]">
                            {domains.map((domain) => (
                                <div 
                                    key={domain.id} 
                                    className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="size-8 flex items-center justify-center bg-[#0d2b1a] border border-[#59d499]/20 rounded text-[#59d499]">
                                            <FiCheck size={14} />
                                        </div>
                                        <div>
                                            <span className="text-white font-mono text-sm">{domain.domain}</span>
                                            <div className="text-[10px] text-[#6a6b6c] font-mono mt-0.5">
                                                Added by {domain.users?.email || `User #${domain.created_by}`} &bull; {formatSecurityDate(domain.created_at)}
                                            </div>
                                        </div>
                                    </div>

                                    {deleteConfirm === domain.id ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-[#9c9c9d]">Remove?</span>
                                            <button
                                                onClick={() => handleDeleteDomain(domain.id)}
                                                className="px-3 py-1.5 bg-[#ff6363] text-white text-xs font-semibold rounded hover:bg-[#ff6363]/90 transition-colors"
                                            >
                                                Yes
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(null)}
                                                className="px-3 py-1.5 bg-[#1b1c1e] text-white text-xs font-medium rounded hover:bg-[#111214] transition-colors"
                                            >
                                                No
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setDeleteConfirm(domain.id)}
                                            className="p-2 text-[#6a6b6c] hover:text-[#ff6363] hover:bg-[#452324]/30 rounded-lg transition-colors"
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
