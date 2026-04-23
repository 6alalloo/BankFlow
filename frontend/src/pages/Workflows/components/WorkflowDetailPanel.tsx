import React, { useEffect, useMemo, useState } from 'react';
import { FiLayers, FiSettings, FiPlay, FiCpu, FiTrash2, FiCopy } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { fetchWorkflowGraph, type WorkflowApi } from '../../../api/workflows';
import RecentExecutions from './RecentExecutions';

type WorkflowDetailPanelProps = {
    workflow: WorkflowApi | null;
    onRun: (wf: WorkflowApi) => void;
    onDelete: (wf: WorkflowApi) => void;
    onDuplicate?: (wf: WorkflowApi) => void;
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

const WorkflowDetailPanel: React.FC<WorkflowDetailPanelProps> = ({ workflow, onRun, onDelete, onDuplicate }) => {
    const navigate = useNavigate();
    const [nodeKinds, setNodeKinds] = useState<string[]>([]);
    const [nodeCount, setNodeCount] = useState(0);
    const [triggerProtocol, setTriggerProtocol] = useState('MANUAL');

    useEffect(() => {
        let active = true;

        const loadGraph = async () => {
            if (!workflow) {
                setNodeKinds([]);
                setNodeCount(0);
                setTriggerProtocol('MANUAL');
                return;
            }

            try {
                const graph = await fetchWorkflowGraph(workflow.id);
                if (!active) return;

                const kinds = graph.nodes.map((node) => node.kind);
                const uniqueKinds = Array.from(new Set(kinds));
                const triggerNode = graph.nodes.find((node) => node.kind === 'trigger');
                const triggerConfig =
                    (triggerNode?.config as Record<string, unknown> | undefined) ?? {};

                setNodeKinds(uniqueKinds);
                setNodeCount(graph.nodes.length);
                setTriggerProtocol(getTriggerProtocol(triggerConfig, workflow.default_trigger));
            } catch (err) {
                if (!active) return;
                console.error('Failed to load workflow graph:', err);
                setNodeKinds([]);
                setNodeCount(0);
                setTriggerProtocol(workflow?.default_trigger ? normalizeLabel(workflow.default_trigger) : 'MANUAL');
            }
        };

        void loadGraph();

        return () => {
            active = false;
        };
    }, [workflow]);

    const integrationsLabel = useMemo(() => {
        if (nodeKinds.length === 0) return 'NONE';
        const filtered = nodeKinds.filter((kind) => kind !== 'trigger');
        const list = filtered.length > 0 ? filtered : nodeKinds;
        return list.map(normalizeLabel).join(' // ');
    }, [nodeKinds]);

    const ownerLabel = useMemo(() => {
        if (!workflow) return 'UNASSIGNED';
        if (workflow.users?.full_name) return workflow.users.full_name.toUpperCase();
        if (workflow.users?.email) return workflow.users.email.toUpperCase();
        if (workflow.owner_user_id) return `USER #${workflow.owner_user_id}`;
        return 'UNASSIGNED';
    }, [workflow]);

    const nodeCountLabel = useMemo(() => `${nodeCount} NODES`, [nodeCount]);
    const lastConfigLabel = useMemo(() => formatLastConfig(workflow?.updated_at), [workflow?.updated_at]);

    if (!workflow) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full bg-[#020408] border-l border-white/5 font-mono">
                <div className="w-16 h-16 rounded-full border border-cyan-900/30 flex items-center justify-center mb-4 animate-pulse">
                     <FiLayers size={24} className="text-cyan-900" />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-900">Awaiting Selection...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#020408] relative overflow-hidden font-sans text-slate-300">
            {/* 1. Cyber Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(19,40,76,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(19,40,76,0.1)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none -translate-y-1/3 translate-x-1/3" />
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 relative z-10">
                <div className="max-w-4xl space-y-10"> 
                    
                    {/* Header: Identification */}
                    <div className="flex items-start gap-6 border-b border-white/5 pb-8">
                        <div className="w-16 h-16 rounded-2xl bg-black/40 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.15)] relative group">
                             <div className="absolute inset-0 bg-cyan-400/10 animate-pulse rounded-2xl" />
                             <FiLayers size={32} className="text-cyan-400 relative z-10" />
                        </div>
                        <div className="pt-1">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-[10px] font-mono text-cyan-500 border border-cyan-500/30 px-1.5 py-0.5 rounded tracking-widest bg-cyan-950/30">ID: {workflow.id.toString().padStart(4, '0')}</span>
                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Ver. {workflow.version}.0</span>
                            </div>
                            <h1 className="text-4xl font-bold text-white tracking-tight mb-3 uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                                {workflow.name}
                            </h1>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl font-light border-l-2 border-slate-700 pl-4">
                                {workflow.description || "System description unavailable."}
                            </p>
                        </div>
                    </div>

                    {/* Configuration Matrix: Verifiable Metadata V3 */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                             <h3 className="text-xs font-bold text-cyan-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <FiCpu className="animate-pulse" />
                                System Configuration
                            </h3>
                            <div className="h-px flex-1 bg-gradient-to-r from-cyan-900/50 to-transparent ml-4" />
                        </div>
                        
                        <div className="bg-black/40 border border-white/10 rounded-none relative">
                            {/* Decor corners */}
                            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-500"/>
                            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-500"/>
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-500"/>
                            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-500"/>

                            <div className="grid grid-cols-2 divide-x divide-white/5">
                                {/* Row 1 */}
                                <div className="p-4 border-b border-white/5 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Trigger Protocol</span>
                                    <span className="text-xs font-bold font-mono text-cyan-400 uppercase">{triggerProtocol}</span>
                                </div>
                                <div className="p-4 border-b border-white/5 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Integrations</span>
                                    <span className="text-xs font-bold font-mono text-white">{integrationsLabel}</span>
                                </div>

                                {/* Row 2 */}
                                <div className="p-4 border-b border-white/5 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Engine Version</span>
                                    <span className="text-xs font-bold font-mono text-emerald-400">V{workflow.version}.0.0</span>
                                </div>
                                <div className="p-4 border-b border-white/5 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">System Owner</span>
                                    <span className="text-xs font-bold font-mono text-white">{ownerLabel}</span>
                                </div>

                                {/* Row 3 */}
                                <div className="p-4 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Last Config</span>
                                    <span className="text-xs font-bold font-mono text-purple-400 uppercase">{lastConfigLabel}</span>
                                </div>
                                <div className="p-4 flex justify-between items-center group hover:bg-white/[0.02] transition-colors cursor-default">
                                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Complexity</span>
                                    <span className="text-xs font-bold font-mono text-white">{nodeCountLabel}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Executions: Log Stream */}
                    <div>
                         <div className="flex items-center justify-between mb-4">
                             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Execution Stream</h3>
                             <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent ml-4" />
                        </div>
                         <div className="bg-black/40 border border-white/5 rounded-none">
                             <RecentExecutions workflowId={workflow.id} />
                         </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions: HUD Controls */}
            <div className="p-6 bg-[#020408]/90 backdrop-blur-md border-t border-white/5 z-20 flex items-center justify-end gap-6">
                <div className="flex gap-4 flex-1 justify-end w-full">
                     <button
                        onClick={() => onDelete(workflow)}
                        className="py-4 px-6 bg-red-950/10 hover:bg-red-950/30 text-red-800 hover:text-red-500 border border-red-900/30 hover:border-red-500/50 font-mono text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all clip-path-polygon group"
                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                    >
                        <FiTrash2 className="group-hover:animate-pulse" /> Delete
                    </button>
                    {onDuplicate && (
                        <button
                            onClick={() => onDuplicate(workflow)}
                            className="py-4 px-6 bg-purple-950/10 hover:bg-purple-950/30 text-purple-400 hover:text-purple-300 border border-purple-900/30 hover:border-purple-500/50 font-mono text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all clip-path-polygon group"
                            style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                        >
                            <FiCopy className="group-hover:animate-pulse" /> Duplicate
                        </button>
                    )}
                    <button
                        onClick={() => onRun(workflow)}
                        className="flex-1 py-4 bg-white/5 hover:bg-cyan-950/30 text-cyan-400 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/50 font-mono text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all clip-path-polygon group"
                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                    >
                        <FiPlay className="group-hover:drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]" /> Execute
                    </button>
                    <button
                        onClick={() => navigate(`/workflows/${workflow.id}/builder`)}
                        className="flex-1 py-4 bg-cyan-600 hover:bg-cyan-500 text-black font-bold font-mono text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] clip-path-polygon"
                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                    >
                         <FiSettings className="animate-spin-slow" /> Config // Builder
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorkflowDetailPanel;
