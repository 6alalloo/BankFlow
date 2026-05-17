import React, { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiBriefcase, FiCheckCircle, FiCpu, FiCopy, FiLayers, FiSend, FiSettings, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { createCase } from '../../../api/cases';
import { fetchFlowGraph, FlowPublishError, publishFlow, type FlowApi, type PublishIssue } from '../../../api/flows';
import { Button, Badge } from '../../../components/ui';
import { buildObjectFromFields, getCaseFields } from '../../../utils/caseForms';

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
    const [caseFieldValues, setCaseFieldValues] = useState<Record<string, string>>({});
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
        setCaseFieldValues({});
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
    const caseFields = useMemo(() => getCaseFields(flow?.case_type), [flow?.case_type]);

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
            const guidedData = buildObjectFromFields(caseFields, caseFieldValues);
            if (trimmed && trimmed !== '{}') {
                const parsed = JSON.parse(trimmed) as unknown;
                if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error('Case data must be a JSON object.');
                }
                caseData = { ...guidedData, ...(parsed as Record<string, unknown>) };
            } else {
                caseData = Object.keys(guidedData).length > 0 ? guidedData : undefined;
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
            <div className="flex-1 flex flex-col items-center justify-center text-[#6a6b6c] h-full bg-[#040506] border-l border-white/[0.08] font-mono">
                <div className="size-14 rounded-2xl border border-white/[0.08] flex items-center justify-center mb-4 bg-[#07080a]">
                     <FiLayers size={24} className="text-[#6a6b6c]" />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#6a6b6c]">Awaiting Selection</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#040506] relative overflow-hidden font-sans text-[#9c9c9d]">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 relative z-10">
                <div className="max-w-4xl space-y-10"> 
                    
                    {/* Header */}
                    <div className="flex items-start gap-5 border-b border-white/[0.08] pb-8">
                        <div className="size-14 rounded-2xl bg-[#07080a] border border-white/[0.08] flex items-center justify-center shrink-0">
                             <FiLayers size={28} className="text-white" />
                        </div>
                        <div className="pt-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="text-[10px] font-mono text-[#6a6b6c] border border-white/[0.08] px-1.5 py-0.5 rounded-md tracking-widest bg-[#111214]">ID: {flow.id.toString().padStart(4, '0')}</span>
                                <span className="text-[10px] font-mono text-[#6a6b6c] uppercase tracking-widest">Ver. {flow.version}.0</span>
                                <Badge variant={flow.status === 'published' ? 'mint' : 'secondary'}>
                                    {flow.status}
                                </Badge>
                            </div>
                            <h1 className="text-3xl font-semibold text-white tracking-tight mb-3">
                                {flow.name}
                            </h1>
                            <p className="text-[#9c9c9d] text-sm leading-relaxed max-w-2xl font-light">
                                {flow.description || "System description unavailable."}
                            </p>
                        </div>
                    </div>

                    {(publishError || publishSuccess) && (
                        <div className={`border rounded-lg p-4 ${publishError ? 'border-[#ff6363]/20 bg-[#452324]/30 text-[#ff6363]' : 'border-[#59d499]/20 bg-[#0d2b1a]/40 text-[#59d499]'}`}>
                            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-2">
                                {publishError ? <FiAlertTriangle /> : <FiCheckCircle />}
                                {publishError || publishSuccess}
                            </div>
                            {publishIssues.length > 0 && (
                                <div className="space-y-2">
                                    {publishIssues.map((issue) => (
                                        <div key={`${issue.code}-${issue.message}`} className="text-sm text-[#ff6363]/80">
                                            <span className="font-mono text-[#ff6363]">{issue.code}</span>
                                            {': '}
                                            {issue.message}
                                            {(issue.nodeKey || issue.node_key || issue.edgeKey || issue.edge_key) && (
                                                <span className="font-mono text-[#ff6363]">
                                                    {' '}[{issue.nodeKey || issue.node_key || issue.edgeKey || issue.edge_key}]
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Configuration Matrix */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                             <h3 className="text-xs font-semibold text-[#9c9c9d] uppercase tracking-[0.2em] flex items-center gap-2">
                                <FiCpu />
                                System Configuration
                            </h3>
                            <div className="h-px flex-1 bg-white/[0.08] ml-4" />
                        </div>
                        
                        <div className="bg-[#07080a] border border-white/[0.08] rounded-2xl overflow-hidden">
                            <div className="grid grid-cols-2 divide-x divide-white/[0.08]">
                                <div className="p-4 border-b border-white/[0.08] flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#6a6b6c] font-mono">Trigger Protocol</span>
                                    <span className="text-xs font-semibold font-mono text-white uppercase">{triggerProtocol}</span>
                                </div>
                                <div className="p-4 border-b border-white/[0.08] flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#6a6b6c] font-mono">Integrations</span>
                                    <span className="text-xs font-semibold font-mono text-white">{integrationsLabel}</span>
                                </div>

                                <div className="p-4 border-b border-white/[0.08] flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#6a6b6c] font-mono">Engine Version</span>
                                    <span className="text-xs font-semibold font-mono text-white">V{flow.version}.0.0</span>
                                </div>
                                <div className="p-4 border-b border-white/[0.08] flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#6a6b6c] font-mono">System Owner</span>
                                    <span className="text-xs font-semibold font-mono text-white">{ownerLabel}</span>
                                </div>

                                <div className="p-4 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#6a6b6c] font-mono">Last Config</span>
                                    <span className="text-xs font-semibold font-mono text-white uppercase">{lastConfigLabel}</span>
                                </div>
                                <div className="p-4 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#6a6b6c] font-mono">Complexity</span>
                                    <span className="text-xs font-semibold font-mono text-white">{nodeCountLabel}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-[#07080a] border-t border-white/[0.08] z-20 flex items-center justify-end gap-3">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePublish}
                    disabled={isPublishing}
                >
                    <FiSend className="size-3.5" />
                    {isPublishing ? 'Publishing...' : 'Publish'}
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsCreateCaseOpen(true)}
                    disabled={!canCreateCase}
                >
                    <FiBriefcase className="size-3.5" />
                    Create Case
                </Button>
                <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(flow)}
                >
                    <FiTrash2 className="size-3.5" />
                    Delete
                </Button>
                {onDuplicate && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onDuplicate(flow)}
                    >
                        <FiCopy className="size-3.5" />
                        Duplicate
                    </Button>
                )}
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/flows/${flow.id}/builder`)}
                >
                    <FiSettings className="size-3.5" />
                    Open Builder
                </Button>
            </div>

            {isCreateCaseOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <button type="button" aria-label="Close create case dialog" className="absolute inset-0 bg-[#040506]/80 backdrop-blur-sm" onClick={() => setIsCreateCaseOpen(false)} />
                    <div className="relative z-10 w-full max-w-lg">
                        <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-6 shadow-xl">
                            <h3 className="text-lg font-semibold text-white mb-1">Create Case</h3>
                            <p className="text-[#9c9c9d] text-sm mb-5">Start a live case from the current published version of {flow.name}.</p>
                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-[10px] uppercase tracking-widest text-[#6a6b6c] font-mono">Title</span>
                                    <input
                                        value={caseTitle}
                                        onChange={(event) => setCaseTitle(event.target.value)}
                                        className="mt-1.5 w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] uppercase tracking-widest text-[#6a6b6c] font-mono">Priority</span>
                                    <select
                                        value={casePriority}
                                        onChange={(event) => setCasePriority(event.target.value as typeof casePriority)}
                                        className="mt-1.5 w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                                    >
                                        <option value="low" className="bg-[#111214]">Low</option>
                                        <option value="normal" className="bg-[#111214]">Normal</option>
                                        <option value="high" className="bg-[#111214]">High</option>
                                        <option value="critical" className="bg-[#111214]">Critical</option>
                                    </select>
                                </label>
                                <div>
                                    <span className="text-[10px] uppercase tracking-widest text-[#6a6b6c] font-mono">Case Fields</span>
                                    <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {caseFields.map((field) => (
                                            <label key={field.key} className="block">
                                                <span className="mb-1 block text-xs text-[#9c9c9d]">{field.label}</span>
                                                <input
                                                    value={caseFieldValues[field.key] ?? ''}
                                                    onChange={(event) => setCaseFieldValues((current) => ({ ...current, [field.key]: event.target.value }))}
                                                    type={field.type === 'number' ? 'number' : 'text'}
                                                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                                                    placeholder={field.placeholder}
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <label className="block">
                                    <span className="text-[10px] uppercase tracking-widest text-[#6a6b6c] font-mono">Additional Case Data JSON</span>
                                    <textarea
                                        value={caseDataText}
                                        onChange={(event) => setCaseDataText(event.target.value)}
                                        rows={6}
                                        className="mt-1.5 w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all resize-none"
                                    />
                                </label>
                            </div>
                            {caseError && (
                                <div className="mt-4 p-3 rounded-lg bg-[#452324]/40 border border-[#ff6363]/20 text-[#ff6363] text-sm">
                                    {caseError}
                                </div>
                            )}
                            <div className="flex gap-3 justify-end mt-6">
                                <Button variant="ghost" onClick={() => setIsCreateCaseOpen(false)} disabled={isCreatingCase}>
                                    Cancel
                                </Button>
                                <Button variant="primary" onClick={handleCreateCase} disabled={isCreatingCase}>
                                    {isCreatingCase ? 'Creating...' : 'Create Case'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlowDetailPanel;
