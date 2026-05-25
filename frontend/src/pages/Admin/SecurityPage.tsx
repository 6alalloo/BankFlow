import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/useAuth";
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
            <div className="flex items-center justify-center h-full bg-[#f2f2f4]">
                <div className="p-10 border border-[#b71c1c]/20 bg-[#ffebee]/30 text-center max-w-md rounded-[10px]">
                    <FiShield className="mx-auto text-5xl text-[#b71c1c] mb-6" />
                    <h2 className="text-2xl font-medium text-[#0f1012] mb-2 uppercase tracking-widest">Access Denied</h2>
                    <p className="text-[#b71c1c] text-sm">Administrator privileges required.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#f2f2f4] text-[#0f1012] overflow-hidden relative font-sans">
            {/* Header */}
            <div className="px-8 py-6 border-b border-[#0f1012]/[0.08] z-10 shrink-0 bg-[#fdfdfd]">
                <div className="flex items-center gap-3 mb-2">
                    <div className="size-10 flex items-center justify-center border border-[#0f1012]/[0.08] bg-[#f2f2f4] text-[#0f1012] rounded-[10px]">
                        <FiShield size={20} />
                    </div>
                    <h1 className="text-2xl font-medium tracking-tight text-[#0f1012]">
                        Security Settings
                    </h1>
                </div>
                <p className="text-[#868788] text-xs tracking-widest uppercase pl-14">
                    HTTP Allow-List & Security Controls
                </p>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar z-10 space-y-8">
                
                {/* Info Banner */}
                <div className="p-4 bg-[#fdfdfd] border border-[#0f1012]/[0.08] rounded-[10px] flex items-start gap-3">
                    <FiInfo className="text-[#0f1012] mt-0.5 flex-shrink-0" size={18} />
                    <div>
                        <h3 className="text-sm font-medium text-[#0f1012] mb-1">HTTP Allow-List Enforcement</h3>
                        <p className="text-xs text-[#8f8f8f] leading-relaxed">
                            Only domains listed below can be accessed by HTTP Request nodes at runtime. 
                            All other domains will be blocked and the request logged. Default policy: <strong className="text-[#b71c1c]">DENY ALL</strong>.
                        </p>
                    </div>
                </div>

                {/* Success/Error Messages */}
                {success && (
                    <div className="p-3 bg-[#e8f5e9]/40 border border-[#1b5e20]/20 rounded-[10px] flex items-center gap-2">
                        <FiCheck className="text-[#1b5e20]" />
                        <span className="text-sm text-[#1b5e20]">{success}</span>
                    </div>
                )}
                {error && (
                    <div className="p-3 bg-[#ffebee]/40 border border-[#b71c1c]/20 rounded-[10px] flex items-center gap-2">
                        <FiAlertTriangle className="text-[#b71c1c]" />
                        <span className="text-sm text-[#b71c1c]">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-[#b71c1c] hover:text-[#b71c1c]/80">
                            <FiX size={16} />
                        </button>
                    </div>
                )}

                {/* Add Domain Section */}
                <div className="bg-[#fdfdfd] border border-[#0f1012]/[0.08] rounded-[10px] p-6">
                    <h2 className="text-sm font-medium text-[#0f1012] uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FiPlus className="text-[#0f1012]" />
                        Add Allowed Domain
                    </h2>
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868788]" />
                            <input
                                type="text"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                                placeholder="api.example.com"
                                className="w-full pl-10 pr-4 py-3 bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] text-[#020201] placeholder:text-[#868788] focus:border-[#0071e3]/40 focus:outline-none focus:ring-1 focus:ring-[#0071e3]/20 text-sm transition-all"
                            />
                        </div>
                        <button
                            onClick={handleAddDomain}
                            disabled={addingDomain}
                            className="px-6 py-3 bg-[#0f1012] text-white font-medium rounded-[10px] hover:bg-[#020201] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
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
                <div className="bg-[#fdfdfd] border border-[#0f1012]/[0.08] rounded-[10px] overflow-hidden">
                    <div className="p-4 border-b border-[#0f1012]/[0.08] flex items-center justify-between">
                        <h2 className="text-sm font-medium text-[#0f1012] uppercase tracking-wider flex items-center gap-2">
                            <FiGlobe className="text-[#0f1012]" />
                            Allowed Domains
                        </h2>
                        <span className="text-xs text-[#868788]">
                            {domains.length} domain{domains.length !== 1 ? 's' : ''} configured
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-[#868788]">
                            <FiLoader className="animate-spin text-2xl" />
                        </div>
                    ) : domains.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-[#868788]">
                            <FiAlertTriangle className="text-3xl text-[#b71c1c] mb-3" />
                            <p className="text-sm">No domains configured</p>
                            <p className="text-xs text-[#868788] mt-1">All HTTP requests will be blocked</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[#0f1012]/[0.04]">
                            {domains.map((domain) => (
                                <div 
                                    key={domain.id} 
                                    className="flex items-center justify-between px-6 py-4 hover:bg-[#0f1012]/[0.02] transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="size-8 flex items-center justify-center bg-[#e8f5e9] border border-[#1b5e20]/20 rounded text-[#1b5e20]">
                                            <FiCheck size={14} />
                                        </div>
                                         <div>
                                            <span className="text-[#0f1012] font-mono text-sm">{domain.domain}</span>
                                            <div className="text-[10px] text-[#868788] mt-0.5">
                                                Added by {domain.users?.email || `User #${domain.created_by}`} &bull; {formatSecurityDate(domain.created_at)}
                                            </div>
                                        </div>
                                    </div>

                                    {deleteConfirm === domain.id ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-[#8f8f8f]">Remove?</span>
                                            <button
                                                onClick={() => handleDeleteDomain(domain.id)}
                                                className="px-3 py-1.5 bg-[#b71c1c] text-white text-xs font-medium rounded-[6px] hover:bg-[#b71c1c]/90 transition-colors"
                                            >
                                                Remove Domain
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(null)}
                                                className="px-3 py-1.5 bg-[#f2f2f4] text-[#0f1012] text-xs font-normal rounded-[6px] hover:bg-[#fdfdfd] transition-colors"
                                            >
                                                Keep Domain
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setDeleteConfirm(domain.id)}
                                            className="p-2 text-[#868788] hover:text-[#b71c1c] hover:bg-[#ffebee] rounded-lg transition-colors"
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
