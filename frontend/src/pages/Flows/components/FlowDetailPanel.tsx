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
            <div className="flex-1 flex flex-col items-center justify-center text-[#868788] h-full bg-[#f2f2f4] border-l border-[#0f1012]/[0.06]">
                <div className="size-14 rounded-[10px] border border-[#0f1012]/[0.08] flex items-center justify-center mb-4 bg-[#fdfdfd] shadow-card">
                     <FiLayers size={24} className="text-[#868788]" strokeWidth={1.5} />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#868788]">Awaiting Selection</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#f2f2f4] relative overflow-hidden font-sans text-[#8f8f8f]">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 relative z-10">
                <div className="max-w-4xl space-y-10"> 
                    
                    {/* Header */}
                    <div className="flex items-start gap-5 border-b border-[#0f1012]/[0.06] pb-8">
                        <div className="size-14 rounded-[10px] bg-[#fdfdfd] border border-[#0f1012]/[0.08] flex items-center justify-center shrink-0 shadow-card">
                             <FiLayers size={28} className="text-[#0f1012]" strokeWidth={1.5} />
                        </div>
                        <div className="pt-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="text-[10px] text-[#868788] border border-[#0f1012]/[0.08] px-1.5 py-0.5 rounded-[6px] tracking-widest bg-[#f2f2f4]">ID: {flow.id.toString().padStart(4, '0')}</span>
                                <span className="text-[10px] text-[#868788] uppercase tracking-widest">Ver. {flow.version}.0</span>
                                <Badge variant={flow.status === 'published' ? 'success' : 'secondary'}>
                                    {flow.status}
                                </Badge>
                            </div>
                            <h1 className="text-3xl font-medium text-[#0f1012] tracking-tight mb-3">
                                {flow.name}
                            </h1>
                            <p className="text-[#8f8f8f] text-sm leading-relaxed max-w-2xl font-normal">
                                {flow.description || "System description unavailable."}
                            </p>
                        </div>
                    </div>

                    {(publishError || publishSuccess) && (
                        <div className={`border rounded-[10px] p-4 ${publishError ? 'border-[#b71c1c]/15 bg-[#ffebee]/40 text-[#b71c1c]' : 'border-[#1b5e20]/15 bg-[#e8f5e9]/40 text-[#1b5e20]'}`}>
                            <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-2">
                                {publishError ? <FiAlertTriangle strokeWidth={1.5} /> : <FiCheckCircle strokeWidth={1.5} />}
                                {publishError || publishSuccess}
                            </div>
                            {publishIssues.length > 0 && (
                                <div className="space-y-2">
                                    {publishIssues.map((issue) => (
                                        <div key={`${issue.code}-${issue.message}`} className="text-sm text-[#b71c1c]/80">
                                            <span className="font-mono text-[#b71c1c]">{issue.code}</span>
                                            {': '}
                                            {issue.message}
                                            {(issue.nodeKey || issue.node_key || issue.edgeKey || issue.edge_key) && (
                                                <span className="font-mono text-[#b71c1c]">
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
                             <h3 className="text-xs font-medium text-[#8f8f8f] uppercase tracking-[0.2em] flex items-center gap-2">
                                <FiCpu />
                                System Configuration
                            </h3>
                            <div className="h-px flex-1 bg-[#0f1012]/[0.08] ml-4" />
                        </div>
                        
                        <div className="bg-[#fdfdfd] border border-[#0f1012]/[0.06] rounded-[10px] overflow-hidden shadow-card">
                            <div className="grid grid-cols-2 divide-x divide-[#0f1012]/[0.06]">
                                <div className="p-4 border-b border-[#0f1012]/[0.06] flex justify-between items-center group hover:bg-[#0f1012]/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#868788]">Trigger Protocol</span>
                                    <span className="text-xs font-medium text-[#0f1012] uppercase">{triggerProtocol}</span>
                                </div>
                                <div className="p-4 border-b border-[#0f1012]/[0.06] flex justify-between items-center group hover:bg-[#0f1012]/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#868788]">Integrations</span>
                                    <span className="text-xs font-medium text-[#0f1012]">{integrationsLabel}</span>
                                </div>

                                <div className="p-4 border-b border-[#0f1012]/[0.06] flex justify-between items-center group hover:bg-[#0f1012]/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#868788]">Engine Version</span>
                                    <span className="text-xs font-medium text-[#0f1012]">V{flow.version}.0.0</span>
                                </div>
                                <div className="p-4 border-b border-[#0f1012]/[0.06] flex justify-between items-center group hover:bg-[#0f1012]/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#868788]">System Owner</span>
                                    <span className="text-xs font-medium text-[#0f1012]">{ownerLabel}</span>
                                </div>

                                <div className="p-4 flex justify-between items-center group hover:bg-[#0f1012]/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#868788]">Last Config</span>
                                    <span className="text-xs font-medium text-[#0f1012] uppercase">{lastConfigLabel}</span>
                                </div>
                                <div className="p-4 flex justify-between items-center group hover:bg-[#0f1012]/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-[#868788]">Complexity</span>
                                    <span className="text-xs font-medium text-[#0f1012]">{nodeCountLabel}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-[#fdfdfd]/80 border-t border-[#0f1012]/[0.06] z-20 flex items-center justify-end gap-3 backdrop-blur-md">
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
                    <button type="button" aria-label="Close create case dialog" className="absolute inset-0 bg-[#0f1012]/20 backdrop-blur-sm" onClick={() => setIsCreateCaseOpen(false)} />
                    <div className="relative z-10 w-full max-w-lg">
                        <div className="rounded-[10px] bg-[#fdfdfd] border border-[#0f1012]/[0.08] shadow-elevated p-6">
                            <h3 className="text-lg font-medium text-[#0f1012] mb-1">Create Case</h3>
                            <p className="text-[#8f8f8f] text-sm mb-5">Start a live case from the current published version of {flow.name}.</p>
                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-[10px] uppercase tracking-widest text-[#868788]">Title</span>
                                    <input
                                        value={caseTitle}
                                        onChange={(event) => setCaseTitle(event.target.value)}
                                        className="mt-1.5 w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#020201] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] uppercase tracking-widest text-[#868788]">Priority</span>
                                    <select
                                        value={casePriority}
                                        onChange={(event) => setCasePriority(event.target.value as typeof casePriority)}
                                        className="mt-1.5 w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#020201] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </label>
                                <div>
                                    <span className="text-[10px] uppercase tracking-widest text-[#868788]">Case Fields</span>
                                    <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {caseFields.map((field) => (
                                            <label key={field.key} className="block">
                                                <span className="mb-1 block text-xs text-[#8f8f8f]">{field.label}</span>
                                                <input
                                                    value={caseFieldValues[field.key] ?? ''}
                                                    onChange={(event) => setCaseFieldValues((current) => ({ ...current, [field.key]: event.target.value }))}
                                                    type={field.type === 'number' ? 'number' : 'text'}
                                                    className="w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2 text-sm text-[#020201] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                                                    placeholder={field.placeholder}
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <label className="block">
                                    <span className="text-[10px] uppercase tracking-widest text-[#868788]">Additional Case Data JSON</span>
                                    <textarea
                                        value={caseDataText}
                                        onChange={(event) => setCaseDataText(event.target.value)}
                                        rows={6}
                                        className="mt-1.5 w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2.5 text-sm text-[#020201] font-mono focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all resize-none"
                                    />
                                </label>
                            </div>
                            {caseError && (
                                <div className="mt-4 p-3 rounded-[10px] bg-[#ffebee]/40 border border-[#b71c1c]/15 text-[#b71c1c] text-sm">
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
