import React, { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiBriefcase, FiCheckCircle, FiCpu, FiCopy, FiLayers, FiSend, FiSettings, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { createCase } from '../../../api/cases';
import { fetchFlowGraph, FlowPublishError, publishFlow, type FlowApi, type PublishIssue } from '../../../api/flows';

type FlowDetailPanelProps = {
    flow: FlowApi | null;
    onDelete: (wf: FlowApi) => void;
    onDuplicate?: (wf: FlowApi) => void;
    onFlowUpdated?: (wf: FlowApi) => void;
};

const normalizeLabel = (value: string) =>
    value.replace(/_/g, ' ').toUpperCase();

const getTriggerProtocol = (config: Record<string, unknown>, fallback?: string | null) => {
    const candidates = [
        config.triggerType,
        (config as Record<string, unknown>).trigger_type,
        config.protocol,
        fallback,
    ];
    const found = candidates.find((entry) => typeof entry === 'string' && entry.trim().length > 0) as string | undefined;
    return found ? normalizeLabel(found) : 'MANUAL';
};

const formatLastConfig = (updatedAt?: string | null) => {
    if (!updatedAt) return 'UNKNOWN';
    const parsed = new Date(updatedAt);
    if (Number.isNaN(parsed.getTime())) return 'UNKNOWN';
    return parsed.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const FlowDetailPanel: React.FC<FlowDetailPanelProps> = ({ flow, onDelete, onDuplicate, onFlowUpdated }) => {
    const navigate = useNavigate();
    const [nodeKinds, setNodeKinds] = useState<string[]>([]);
    const [nodeCount, setNodeCount] = useState(0);
    const [triggerProtocol, setTriggerProtocol] = useState('MANUAL');
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishIssues, setPublishIssues] = useState<PublishIssue[]>([]);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
    const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
    const [caseTitle, setCaseTitle] = useState('');
    const [casePriority, setCasePriority] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
    const [caseDataText, setCaseDataText] = useState('{\n  \n}');
    const [caseError, setCaseError] = useState<string | null>(null);
    const [isCreatingCase, setIsCreatingCase] = useState(false);

    useEffect(() => {
        let active = true;

        const loadGraph = async () => {
            if (!flow) {
                setNodeKinds([]);
                setNodeCount(0);
                setTriggerProtocol('MANUAL');
                return;
            }

            try {
                const graph = await fetchFlowGraph(flow.id);
                if (!active) return;

                const kinds = graph.nodes.map((node) => node.kind);
                const uniqueKinds = Array.from(new Set(kinds));
                const triggerNode = graph.nodes.find((node) => node.kind === 'trigger');
                const triggerConfig =
                    (triggerNode?.config as Record<string, unknown> | undefined) ?? {};

                setNodeKinds(uniqueKinds);
                setNodeCount(graph.nodes.length);
                setTriggerProtocol(getTriggerProtocol(triggerConfig, flow.default_trigger));
            } catch (err) {
                if (!active) return;
                console.error('Failed to load flow graph:', err);
                setNodeKinds([]);
                setNodeCount(0);
                setTriggerProtocol(flow?.default_trigger ? normalizeLabel(flow.default_trigger) : 'MANUAL');
            }
        };

        void loadGraph();

        return () => {
            active = false;
        };
    }, [flow]);

    useEffect(() => {
        setPublishIssues([]);
        setPublishError(null);
        setPublishSuccess(null);
        setCaseError(null);
        setCaseTitle(flow?.name ?? '');
    }, [flow?.id, flow?.name]);

    const integrationsLabel = useMemo(() => {
        if (nodeKinds.length === 0) return 'NONE';
        const filtered = nodeKinds.filter((kind) => kind !== 'trigger');
        const list = filtered.length > 0 ? filtered : nodeKinds;
        return list.map(normalizeLabel).join(' // ');
    }, [nodeKinds]);

    const ownerLabel = useMemo(() => {
        if (!flow) return 'UNASSIGNED';
        if (flow.users?.full_name) return flow.users.full_name.toUpperCase();
        if (flow.users?.email) return flow.users.email.toUpperCase();
        if (flow.owner_user_id) return `USER #${flow.owner_user_id}`;
        return 'UNASSIGNED';
    }, [flow]);

    const nodeCountLabel = useMemo(() => `${nodeCount} NODES`, [nodeCount]);
    const lastConfigLabel = useMemo(() => formatLastConfig(flow?.updated_at), [flow?.updated_at]);
    const canCreateCase = flow?.status === 'published' && Boolean(flow.current_published_version);

    const handlePublish = async () => {
        if (!flow) return;
        try {
            setIsPublishing(true);
            setPublishError(null);
            setPublishIssues([]);
            setPublishSuccess(null);
            const updated = await publishFlow(flow.id, 'Published from BankFlow flow detail');
            onFlowUpdated?.(updated);
            setPublishSuccess(`Published version ${updated.version || updated.current_published_version?.version_number || 1}.`);
        } catch (err) {
            if (err instanceof FlowPublishError) {
                setPublishError(err.message);
                setPublishIssues(err.issues);
            } else {
                setPublishError(err instanceof Error ? err.message : 'Failed to publish flow');
            }
        } finally {
            setIsPublishing(false);
        }
    };

    const handleCreateCase = async () => {
        if (!flow) return;
        let caseData: Record<string, unknown> | undefined;

        try {
            const trimmed = caseDataText.trim();
            caseData = trimmed && trimmed !== '{}' ? JSON.parse(trimmed) as Record<string, unknown> : undefined;
            if (caseData !== undefined && (typeof caseData !== 'object' || Array.isArray(caseData) || caseData === null)) {
                throw new Error('Case data must be a JSON object.');
            }
        } catch (err) {
            setCaseError(err instanceof Error ? err.message : 'Case data must be valid JSON.');
            return;
        }

        try {
            setIsCreatingCase(true);
            setCaseError(null);
            const created = await createCase({
                flowId: flow.id,
                title: caseTitle.trim() || flow.name,
                priority: casePriority,
                intakeSource: 'manual',
                caseData,
            });
            setIsCreateCaseOpen(false);
            navigate(`/cases/${created.id}`);
        } catch (err) {
            setCaseError(err instanceof Error ? err.message : 'Failed to create case');
        } finally {
            setIsCreatingCase(false);
        }
    };

    if (!flow) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 h-full bg-[#020408] border-l border-white/5 font-mono">
                <div className="size-16 rounded-full border border-cyan-900/30 flex items-center justify-center mb-4 animate-pulse">
                     <FiLayers size={24} className="text-cyan-900" />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-900">Awaiting Selection?</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#020408] relative overflow-hidden font-sans text-zinc-300">
            {/* 1. Cyber Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(19,40,76,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(19,40,76,0.1)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none -translate-y-1/3 translate-x-1/3" />
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 relative z-10">
                <div className="max-w-4xl space-y-10"> 
                    
                    {/* Header: Identification */}
                    <div className="flex items-start gap-6 border-b border-white/5 pb-8">
                        <div className="size-16 rounded-2xl bg-zinc-950/40 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.15)] relative group">
                             <div className="absolute inset-0 bg-cyan-400/10 animate-pulse rounded-2xl" />
                             <FiLayers size={32} className="text-cyan-400 relative z-10" />
                        </div>
                        <div className="pt-1">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-[10px] font-mono text-cyan-500 border border-cyan-500/30 px-1.5 py-0.5 rounded tracking-widest bg-cyan-950/30">ID: {flow.id.toString().padStart(4, '0')}</span>
                                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Ver. {flow.version}.0</span>
                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded tracking-widest uppercase border ${flow.status === 'published' ? 'text-emerald-300 border-emerald-500/30 bg-emerald-950/20' : 'text-amber-300 border-amber-500/30 bg-amber-950/20'}`}>
                                    {flow.status}
                                </span>
                            </div>
                            <h1 className="text-4xl font-semibold text-cyan-100 tracking-tight mb-3 uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                                {flow.name}
                            </h1>
                            <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl font-light border-l-2 border-zinc-700 pl-4">
                                {flow.description || "System description unavailable."}
                            </p>
                        </div>
                    </div>

                    {(publishError || publishSuccess) && (
                        <div className={`border p-4 ${publishError ? 'border-rose-500/30 bg-rose-950/20 text-rose-100' : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-100'}`}>
                            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-2">
                                {publishError ? <FiAlertTriangle /> : <FiCheckCircle />}
                                {publishError || publishSuccess}
                            </div>
                            {publishIssues.length > 0 && (
                                <div className="space-y-2">
                                    {publishIssues.map((issue) => (
                                        <div key={`${issue.code}-${issue.message}`} className="text-sm text-rose-200/90">
                                            <span className="font-mono text-rose-300">{issue.code}</span>
                                            {': '}
                                            {issue.message}
                                            {(issue.nodeKey || issue.node_key || issue.edgeKey || issue.edge_key) && (
                                                <span className="font-mono text-rose-300">
                                                    {' '}[{issue.nodeKey || issue.node_key || issue.edgeKey || issue.edge_key}]
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Configuration Matrix: Verifiable Metadata V3 */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                             <h3 className="text-xs font-semibold text-cyan-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <FiCpu className="animate-pulse" />
                                System Configuration
                            </h3>
                            <div className="h-px flex-1 bg-gradient-to-r from-cyan-900/50 to-transparent ml-4" />
                        </div>
                        
                        <div className="bg-zinc-950/40 border border-white/10 rounded-none relative">
                            {/* Decor corners */}
                            <div className="absolute top-0 left-0 size-2 border-t border-l border-cyan-500"/>
                            <div className="absolute top-0 right-0 size-2 border-t border-r border-cyan-500"/>
                            <div className="absolute bottom-0 left-0 size-2 border-b border-l border-cyan-500"/>
                            <div className="absolute bottom-0 right-0 size-2 border-b border-r border-cyan-500"/>

                            <div className="grid grid-cols-2 divide-x divide-white/5">
                                {/* Row 1 */}
                                <div className="p-4 border-b border-white/5 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Trigger Protocol</span>
                                    <span className="text-xs font-semibold font-mono text-cyan-400 uppercase">{triggerProtocol}</span>
                                </div>
                                <div className="p-4 border-b border-white/5 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Integrations</span>
                                    <span className="text-xs font-semibold font-mono text-white">{integrationsLabel}</span>
                                </div>

                                {/* Row 2 */}
                                <div className="p-4 border-b border-white/5 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Engine Version</span>
                                    <span className="text-xs font-semibold font-mono text-emerald-400">V{flow.version}.0.0</span>
                                </div>
                                <div className="p-4 border-b border-white/5 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">System Owner</span>
                                    <span className="text-xs font-semibold font-mono text-white">{ownerLabel}</span>
                                </div>

                                {/* Row 3 */}
                                <div className="p-4 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Last Config</span>
                                    <span className="text-xs font-semibold font-mono text-purple-400 uppercase">{lastConfigLabel}</span>
                                </div>
                                <div className="p-4 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">Complexity</span>
                                    <span className="text-xs font-semibold font-mono text-white">{nodeCountLabel}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Footer Actions: HUD Controls */}
            <div className="p-4 sm:p-6 bg-[#020408]/90 backdrop-blur-md border-t border-white/5 z-20 flex items-center justify-end gap-6">
                <div className="flex flex-wrap gap-3 sm:gap-4 flex-1 justify-end w-full">
                    <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className="py-3 sm:py-4 px-4 sm:px-6 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 hover:text-emerald-200 border border-emerald-800/40 hover:border-emerald-500/60 font-mono text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 sm:gap-3 transition-all disabled:opacity-60"
                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                    >
                        <FiSend /> {isPublishing ? 'Publishing?' : 'Publish'}
                    </button>
                    <button
                        onClick={() => setIsCreateCaseOpen(true)}
                        disabled={!canCreateCase}
                        title={canCreateCase ? 'Create a case from this published flow' : 'Publish this flow before creating cases'}
                        className="py-3 sm:py-4 px-4 sm:px-6 bg-blue-950/20 hover:bg-blue-950/40 text-blue-300 hover:text-blue-200 border border-blue-800/40 hover:border-blue-500/60 font-mono text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 sm:gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                    >
                        <FiBriefcase /> Create Case
                    </button>
                     <button
                        onClick={() => onDelete(flow)}
                        className="py-3 sm:py-4 px-4 sm:px-6 bg-red-950/10 hover:bg-red-950/30 text-red-800 hover:text-red-500 border border-red-900/30 hover:border-red-500/50 font-mono text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 sm:gap-3 transition-all clip-path-polygon group"
                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                    >
                        <FiTrash2 className="group-hover:animate-pulse" /> Delete
                    </button>
                    {onDuplicate && (
                        <button
                            onClick={() => onDuplicate(flow)}
                            className="py-3 sm:py-4 px-4 sm:px-6 bg-purple-950/10 hover:bg-purple-950/30 text-purple-400 hover:text-purple-300 border border-purple-900/30 hover:border-purple-500/50 font-mono text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 sm:gap-3 transition-all clip-path-polygon group"
                            style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                        >
                            <FiCopy className="group-hover:animate-pulse" /> Duplicate
                        </button>
                    )}
                    <button
                        onClick={() => navigate(`/flows/${flow.id}/builder`)}
                        className="flex-1 min-w-[220px] py-3 sm:py-4 bg-cyan-600 hover:bg-cyan-500 text-black font-semibold font-mono text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 sm:gap-3 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] clip-path-polygon"
                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                    >
                         <FiSettings className="animate-spin-slow" /> Config // Builder
                    </button>
                </div>
            </div>

            {isCreateCaseOpen && (
                <>
                    <button type="button" aria-label="Close create case dialog" className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-40" onClick={() => setIsCreateCaseOpen(false)} />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-xl">
                        <div className="bg-[#0f172a] border border-zinc-800 rounded-lg shadow-2xl overflow-hidden p-6">
                            <h3 className="text-lg font-semibold text-white mb-1">Create Case</h3>
                            <p className="text-zinc-400 text-sm mb-5">Start a live case from the current published version of {flow.name}.</p>
                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-xs uppercase tracking-widest text-zinc-500 font-mono">Title</span>
                                    <input
                                        value={caseTitle}
                                        onChange={(event) => setCaseTitle(event.target.value)}
                                        className="mt-2 w-full bg-zinc-950/30 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-cyan-500"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs uppercase tracking-widest text-zinc-500 font-mono">Priority</span>
                                    <select
                                        value={casePriority}
                                        onChange={(event) => setCasePriority(event.target.value as typeof casePriority)}
                                        className="mt-2 w-full bg-zinc-950/30 border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-cyan-500"
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-xs uppercase tracking-widest text-zinc-500 font-mono">Case Data JSON</span>
                                    <textarea
                                        value={caseDataText}
                                        onChange={(event) => setCaseDataText(event.target.value)}
                                        rows={6}
                                        className="mt-2 w-full bg-zinc-950/30 border border-white/10 rounded px-3 py-2 text-white font-mono text-sm outline-none focus:border-cyan-500"
                                    />
                                </label>
                            </div>
                            {caseError && <div className="alert alert-danger mt-4 mb-0">{caseError}</div>}
                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    onClick={() => setIsCreateCaseOpen(false)}
                                    disabled={isCreatingCase}
                                    className="px-4 py-2 text-zinc-300 hover:text-white text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateCase}
                                    disabled={isCreatingCase}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-black text-sm font-semibold rounded-lg shadow-lg shadow-cyan-900/20 flex items-center gap-2 transition-all disabled:opacity-60"
                                >
                                    {isCreatingCase ? 'Creating?' : 'Create Case'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default FlowDetailPanel;
