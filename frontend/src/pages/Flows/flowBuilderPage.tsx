import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCheck } from 'react-icons/fi';
import {
    LuLayoutTemplate,
    LuChevronDown,
    LuServer,
    LuTriangleAlert,
    LuArrowLeft,
    LuPlus,
    LuPlay,
    LuZap,
    LuClipboardCheck,
    LuShieldCheck,
} from 'react-icons/lu';

import {
    fetchFlowGraph,
    createFlowNode,
    createFlowEdge,
    createFlow,
    updateFlowNode,
    updateFlowNodePosition,
    deleteFlowEdge,
    deleteFlowNode,
    updateFlow,
    publishFlow,
    FlowPublishError,
    type FlowGraphNode,
    type FlowGraphEdge,
    type FlowGraphMeta,
} from '../../api/flows';

import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    type Connection,
    type Edge,
    ReactFlowProvider,
    useReactFlow,
    type Node as RFNode,
} from 'reactflow';

import ConfigPanel from '../../components/builder/ConfigPanel';
import NodePicker from '../../components/builder/NodePicker';
import { NODE_TYPE_MAP } from '../../components/builder/nodePickerOptions';
import { templates, type FlowTemplate } from '../../data/templates';
import { resolveTemplateTeamKeys } from '../../utils/resolveTemplateTeams';
import { DEFAULT_NODE_CONFIGS, type NodeKind } from '../../types/nodeConfigs';
import {
    SNAP_GRID,
    edgeTypes,
    getFromNodeId,
    getLayoutedElements,
    getToNodeId,
    nodeTypesMap,
    snap,
    type FlowNodeData,
} from './flowBuilderGraph';

type BuilderState = {
    flowId: number | null;
    flowMeta?: FlowGraphMeta;
    nodes: FlowGraphNode[];
    edges: FlowGraphEdge[];
};

const FlowBuilderContent: React.FC = () => {
    const params = useParams<{ id?: string }>();
    const navigate = useNavigate();

    const { fitView, project } = useReactFlow();
    const flowWrapperRef = useRef<HTMLDivElement | null>(null);
    const hasInitialFit = useRef(false);

    const [state, setState] = useState<BuilderState>({
        flowId: null,
        flowMeta: undefined,
        nodes: [],
        edges: [],
    });

    const [rfNodes, setRfNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
    const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<FlowGraphEdge>([]);
    const [nodePickerOpen, setNodePickerOpen] = useState(false);
    const pickerParentIdRef = useRef<number | null>(null);
    const [pickerPosition, setPickerPosition] = useState<{ x: number; y: number } | null>(null);

    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

    const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
    const [isEmptyTemplateOpen, setIsEmptyTemplateOpen] = useState(false);
    const [showTemplateConfirm, setShowTemplateConfirm] = useState<FlowTemplate | null>(null);
    const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);

    const [pendingSaves, setPendingSaves] = useState(0);
    const [publishMessage, setPublishMessage] = useState<string | null>(null);
    const [publishIssues, setPublishIssues] = useState<string[]>([]);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const beginSave = useCallback(() => setPendingSaves((n: number) => n + 1), []);
    const endSave = useCallback(() => setPendingSaves((n: number) => Math.max(0, n - 1)), []);
    const isSaving = pendingSaves > 0;

    const refreshRef = useRef<(backendNodes: FlowGraphNode[], backendEdges: FlowGraphEdge[]) => void>(() => {});

    const handleEdgeDeleteClick = useCallback(
        async (edgeIdStr: string) => {
            const edgeId = Number(edgeIdStr);
            if (!state.flowId || Number.isNaN(edgeId)) {
                setRfEdges((current) => current.filter((e) => e.id !== edgeIdStr));
                return;
            }

            try {
                beginSave();
                await deleteFlowEdge(state.flowId, edgeId);
                const graph = await fetchFlowGraph(state.flowId);
                setState((prev) => ({ ...prev, nodes: graph.nodes, edges: graph.edges }));
                refreshRef.current(graph.nodes, graph.edges);
            } catch (e) {
                console.error('[FlowBuilderPage] Failed to delete edge on server:', e);
            } finally {
                endSave();
            }
        },
        [state.flowId, beginSave, endSave, setRfEdges]
    );

    const mapToReactFlowEdge = useCallback(
        (edge: FlowGraphEdge): Edge => {
            const sourceId = getFromNodeId(edge);
            const sourceNode = state.nodes.find((n) => n.id === sourceId);
            const isCondition = sourceNode?.kind === 'condition';

            // For condition nodes, auto-label edges Yes/No if not already labeled
            let label = edge.label;
            if (isCondition && !label) {
                const outgoing = state.edges.filter((e) => getFromNodeId(e) === sourceId);
                const index = outgoing.findIndex((e) => e.id === edge.id);
                label = index === 0 ? 'Yes' : 'No';
            }

            return {
                id: String(edge.id),
                source: String(sourceId),
                target: String(getToNodeId(edge)),
                label,
                type: 'custom',
                data: { onDelete: handleEdgeDeleteClick },
            };
        },
        [handleEdgeDeleteClick, state.nodes, state.edges]
    );

    const refreshVisualGraph = useCallback(
        (backendNodes: FlowGraphNode[], backendEdges: FlowGraphEdge[]) => {
            const realNodes: RFNode<FlowNodeData>[] = backendNodes.map((n) => ({
                id: String(n.id),
                type: 'bankflow',
                position: { x: snap(n.pos_x || 0), y: snap(n.pos_y || 0) },
                data: {
                    backendId: n.id,
                    name: n.name,
                    kind: n.kind,
                    config: n.config || {},
                    onAddAfter: () => {
                        pickerParentIdRef.current = n.id;
                        setPickerPosition(null);
                        setNodePickerOpen(true);
                    },
                },
            }));

            if (realNodes.length === 0) {
                const startGhost: RFNode<FlowNodeData> = {
                    id: 'ghost-start',
                    type: 'ghost',
                    position: { x: snap(360), y: snap(240) },
                    data: {
                        kind: 'ghost',
                        onAdd: (e: React.MouseEvent) => {
                            if (e) setPickerPosition({ x: e.clientX + 20, y: e.clientY });
                            pickerParentIdRef.current = null;
                            setNodePickerOpen(true);
                        },
                    },
                };
                setRfNodes([startGhost]);
                setRfEdges([]);
                return;
            }

            const sourceIds = new Set(backendEdges.map((e) => getFromNodeId(e)));
            const leafNodes = backendNodes.filter((n) => !sourceIds.has(n.id));

            const ghostNodes: RFNode<FlowNodeData>[] = leafNodes.map((leaf) => ({
                id: `ghost-${leaf.id}`,
                type: 'ghost',
                position: { x: snap((leaf.pos_x || 0) + 400), y: snap(leaf.pos_y || 0) },
                data: {
                    kind: 'ghost',
                    onAdd: (e: React.MouseEvent) => {
                        if (e) setPickerPosition({ x: e.clientX + 20, y: e.clientY });
                        pickerParentIdRef.current = leaf.id;
                        setNodePickerOpen(true);
                    },
                },
            }));

            const realRfEdges = backendEdges.map(mapToReactFlowEdge);
            const ghostEdges: Edge[] = leafNodes.map((leaf) => ({
                id: `e-ghost-${leaf.id}`,
                source: String(leaf.id),
                target: `ghost-${leaf.id}`,
                type: 'custom',
                animated: true,
                style: { stroke: '#c7c7cc', strokeDasharray: '5,5', opacity: 0.5 },
            }));

            const allNodes = [...realNodes, ...ghostNodes];
            const allEdges = [...realRfEdges, ...ghostEdges];

            const hasPositions = realNodes.some((n) => n.position.x !== 0 || n.position.y !== 0);

            if (!hasPositions && realNodes.length > 0) {
                const layouted = getLayoutedElements(allNodes, allEdges);
                setRfNodes(layouted.nodes);
                setRfEdges(layouted.edges);
            } else {
                setRfNodes(allNodes);
                setRfEdges(allEdges);
            }
        },
        [setRfNodes, setRfEdges, mapToReactFlowEdge, setPickerPosition, setNodePickerOpen]
    );

    useEffect(() => {
        refreshRef.current = refreshVisualGraph;
    }, [refreshVisualGraph]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            setSelectedNodeId(null);
            hasInitialFit.current = false;

            try {
                if (!params.id) {
                    const created = await createFlow({
                        name: 'Untitled Flow',
                        description: 'Draft flow created from the builder.',
                    });
                    if (!cancelled) navigate(`/flows/${created.id}/builder`, { replace: true });
                    return;
                }
                const numericId = Number(params.id);

                const graph = await fetchFlowGraph(numericId);
                if (cancelled) return;

                setState({
                    flowId: numericId,
                    flowMeta: graph.flow,
                    nodes: graph.nodes,
                    edges: graph.edges,
                });

                refreshRef.current(graph.nodes, graph.edges);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load flow');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [params.id, navigate]);

    useEffect(() => {
        if (!loading && !hasInitialFit.current && rfNodes.length > 0) {
            const timer = setTimeout(() => {
                fitView({ padding: 0.4, duration: 500 });
                hasInitialFit.current = true;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [loading, rfNodes, fitView]);



    const handleRename = async (newName: string) => {
        if (!state.flowId || !state.flowMeta) return;
        const updatedMeta = { ...state.flowMeta, name: newName };
        setState((prev) => ({ ...prev, flowMeta: updatedMeta }));

        try {
            await updateFlow(state.flowId, { name: newName });
        } catch (e) {
            console.error('Rename failed', e);
        }
    };

    const handleApplyTemplate = async (template: FlowTemplate) => {
        if (!state.flowId || isApplyingTemplate) return;
        const flowId = state.flowId;

        try {
            setIsApplyingTemplate(true);
            setShowTemplateConfirm(null);
            setIsTemplateDropdownOpen(false);

            await Promise.all(state.nodes.map((node) => deleteFlowNode(flowId, node.id)));

            const resolvedNodes = await resolveTemplateTeamKeys(template.nodes);
            const nodeIdMap: Record<string, number> = {};

            await Promise.all(
                resolvedNodes.map(async (templateNode) => {
                    const nodeResponse = await createFlowNode(flowId, {
                        kind: templateNode.kind,
                        name: templateNode.name,
                        posX: templateNode.pos_x,
                        posY: templateNode.pos_y,
                        config: templateNode.config,
                    });
                    nodeIdMap[templateNode.id] = nodeResponse.id;
                })
            );

            await Promise.all(
                template.edges.map(async (templateEdge) => {
                    const fromNodeId = nodeIdMap[templateEdge.from];
                    const toNodeId = nodeIdMap[templateEdge.to];

                    if (fromNodeId && toNodeId) {
                        await createFlowEdge(flowId, {
                            fromNodeId,
                            toNodeId,
                            label: templateEdge.label || undefined,
                            condition: templateEdge.condition || undefined,
                        });
                    }
                })
            );

            await updateFlow(flowId, { name: template.name });

            const graph = await fetchFlowGraph(flowId);
            setState((prev) => ({
                ...prev,
                flowMeta: graph.flow,
                nodes: graph.nodes,
                edges: graph.edges,
            }));
            refreshRef.current(graph.nodes, graph.edges);

            setTimeout(() => {
                fitView({ padding: 0.4, duration: 500 });
            }, 150);
        } catch (e) {
            console.error('Failed to apply template:', e);
        } finally {
            setIsApplyingTemplate(false);
        }
    };

    const handleNodeDragStop = useCallback(
        async (_event: React.MouseEvent, node: RFNode) => {
            const data = node.data as FlowNodeData | undefined;
            if (!data) return;

            const backendId = data.backendId;
            let { x, y } = node.position;

            if (!backendId) return;

            // Snap to grid
            x = snap(x);
            y = snap(y);

            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                console.warn(`[FlowBuilderPage] Invalid position values for node ${backendId}: (${x}, ${y})`);
                return;
            }

            const nodeExists = state.nodes.some((n) => n.id === backendId);
            if (!nodeExists) {
                console.warn(`[FlowBuilderPage] Node ${backendId} not found in state, skipping position update`);
                return;
            }

            // Visually snap the node immediately
            setRfNodes((nds) =>
                nds.map((n) => (n.id === String(backendId) ? { ...n, position: { x, y } } : n))
            );

            setState((prev) => ({
                ...prev,
                nodes: prev.nodes.map((n) => (n.id === backendId ? { ...n, pos_x: x, pos_y: y } : n)),
            }));

            if (state.flowId) {
                try {
                    beginSave();
                    await updateFlowNodePosition(state.flowId!, backendId, x, y);
                } catch (e) {
                    console.error('[FlowBuilderPage] Failed to persist node position:', e);
                } finally {
                    endSave();
                }
            }
        },
        [state.flowId, state.nodes, beginSave, endSave, setRfNodes]
    );

    const handleConnect = useCallback(
        async (connection: Connection) => {
            if (!state.flowId) return;
            if (!connection.source || !connection.target) return;

            const fromId = Number(connection.source);
            const toId = Number(connection.target);

            try {
                beginSave();
                await createFlowEdge(state.flowId, {
                    fromNodeId: fromId,
                    toNodeId: toId,
                });

                const graph = await fetchFlowGraph(state.flowId);
                setState((prev) => ({ ...prev, nodes: graph.nodes, edges: graph.edges }));
                refreshRef.current(graph.nodes, graph.edges);
            } catch (err) {
                console.error('[FlowBuilderPage] Failed to create edge:', err);
            } finally {
                endSave();
            }
        },
        [state.flowId, beginSave, endSave, refreshRef]
    );

    const handleSelectionChange = useCallback(
        (params: { nodes: RFNode[]; edges: Edge[] }) => {
            const nodes = params.nodes ?? [];
            if (nodes.length === 0) {
                setSelectedNodeId(null);
                return;
            }

            const first = nodes[0];
            if (first.type === 'bankflow') {
                const idNum = Number(first.id);
                setSelectedNodeId(idNum);
            } else {
                setSelectedNodeId(null);
            }
        },
        []
    );

    const handleNodeSelect = async (kind: string) => {
        setNodePickerOpen(false);
        if (!state.flowId) return;

        const isFirstNode = state.nodes.length === 0;

        try {
            beginSave();

            let posX = 200;
            let posY = 200;

            if (pickerPosition) {
                const projected = project({ x: pickerPosition.x, y: pickerPosition.y });
                posX = snap(projected.x);
                posY = snap(projected.y);
            } else if (pickerParentIdRef.current) {
                const parent = state.nodes.find((n) => n.id === pickerParentIdRef.current);
                if (parent) {
                    posX = snap(parent.pos_x + 300);
                    posY = snap(parent.pos_y);
                }
            }

            const newNode = await createFlowNode(state.flowId, {
                kind,
                posX,
                posY,
                config: DEFAULT_NODE_CONFIGS[kind as NodeKind] ?? {},
            });

            const pickerParentId = pickerParentIdRef.current;
            if (pickerParentId) {
                await createFlowEdge(state.flowId, {
                    fromNodeId: pickerParentId,
                    toNodeId: newNode.id,
                });
            }

            const graph = await fetchFlowGraph(state.flowId);
            setState((prev) => ({ ...prev, nodes: graph.nodes, edges: graph.edges }));
            refreshRef.current(graph.nodes, graph.edges);

            if (isFirstNode) {
                setTimeout(() => {
                    fitView({ padding: 0.5, maxZoom: 0.85, duration: 400 });
                }, 150);
            }
        } catch (e) {
            console.error('Failed to add node', e);
        } finally {
            endSave();
        }
    };

    const openPalette = () => {
        pickerParentIdRef.current = null;
        setPickerPosition(null);
        setNodePickerOpen(true);
    };

    const handlePaletteSelect = async (kind: string) => {
        pickerParentIdRef.current = null;
        setPickerPosition(null);
        await handleNodeSelect(kind);
    };

    const handlePublish = async () => {
        if (!state.flowId) return;

        try {
            setIsPublishing(true);
            setPublishMessage(null);
            setPublishIssues([]);
            const updated = await publishFlow(state.flowId, 'Published from builder');
            setState((prev) => ({
                ...prev,
                flowMeta: prev.flowMeta
                    ? { ...prev.flowMeta, version: updated.version, is_active: true, isActive: true }
                    : prev.flowMeta,
            }));
            setPublishMessage('Published');
            setPublishIssues([]);
            setShowPublishModal(true);
        } catch (err) {
            if (err instanceof FlowPublishError) {
                setPublishMessage(err.message);
                setPublishIssues(err.issues.map((issue) => issue.message));
            } else {
                setPublishMessage(err instanceof Error ? err.message : 'Failed to publish flow');
                setPublishIssues([]);
            }
            setShowPublishModal(true);
        } finally {
            setIsPublishing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[100dvh] w-full items-center justify-center bg-[#f2f2f4]">
                <div className="text-lg text-[#8f8f8f]">Loading flow builder&hellip;</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-[#f2f2f4]">
                <h1 className="text-xl font-medium text-[#0f1012]">Flow Builder</h1>
                <div className="rounded-[10px] border border-[#b71c1c]/20 bg-[#ffebee]/40 px-4 py-3 text-[#b71c1c]">{error}</div>
                <button
                    className="rounded-[10px] bg-[#0f1012]/[0.05] px-4 py-2 text-sm text-[#0f1012] transition-colors hover:bg-[#0f1012]/[0.10]"
                    onClick={() => navigate('/flows')}
                >
                    Back to Flows
                </button>
            </div>
        );
    }

    const realNodeCount = state.nodes.length;
    const edgeCount = state.edges.length;
    const version = state.flowMeta?.version ?? 0;
    const isActive = state.flowMeta?.is_active || state.flowMeta?.isActive;

    return (
        <div className="flex h-[100dvh] w-full overflow-hidden bg-[#f2f2f4]">
            <div className="relative flex h-full w-full flex-col">
                {/* Top Toolbar */}
                <div className="pointer-events-none absolute left-4 right-4 top-4 z-40 flex items-center justify-between">
                    {/* Left */}
                    <div className="pointer-events-auto flex items-center gap-2">
                        <button
                            onClick={() => navigate('/flows')}
                            className="flex size-9 items-center justify-center rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd]/90 text-[#868788] shadow-card backdrop-blur-md transition-all hover:bg-[#fdfdfd] hover:text-[#0f1012]"
                            title="Back to flows"
                        >
                            <LuArrowLeft className="size-4" />
                        </button>

                        <div className="flex items-center gap-3 rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd]/90 px-4 py-2 shadow-card backdrop-blur-md">
                            <input
                                className="w-[240px] border-none bg-transparent text-base font-medium text-[#0f1012] outline-none placeholder:text-[#0f1012]/30 focus:ring-0"
                                value={state.flowMeta?.name || ''}
                                onChange={(e) => handleRename(e.target.value)}
                                placeholder="Untitled Flow"
                            />
                            <div className="h-4 w-px bg-[#0f1012]/[0.08]" />
                            {isSaving ? (
                                <span className="flex items-center gap-1.5 text-[11px] text-[#8f8f8f]">
                                    <div className="size-2 animate-pulse rounded-full bg-[#8f8f8f]" />
                                    Saving&hellip;
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 text-[11px] text-[#868788]">
                                    <FiCheck className="size-3.5 text-[#1b5e20]" strokeWidth={1.5} />
                                    Saved
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right */}
                    <div className="pointer-events-auto flex items-center gap-2">
                        {/* Templates */}
                        <div className="relative">
                            <button
                                onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                                disabled={isApplyingTemplate}
                                className="flex items-center gap-2 rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd]/90 px-3 py-2 text-sm font-medium text-[#0f1012] shadow-card backdrop-blur-md transition-all hover:bg-[#fdfdfd] disabled:opacity-50"
                            >
                                {isApplyingTemplate ? (
                                    <div className="size-4 animate-spin rounded-full border-2 border-[#0f1012]/30 border-t-[#0f1012]" />
                                ) : (
                                    <LuLayoutTemplate className="size-4 text-[#8f8f8f]" />
                                )}
                                Templates
                                <LuChevronDown
                                    className={`size-3 text-[#868788] transition-transform ${isTemplateDropdownOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {isTemplateDropdownOpen && (
                                <div className="absolute left-0 top-full z-50 mt-2 min-w-[280px] overflow-hidden rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd]/95 shadow-elevated backdrop-blur-md">
                                    <div className="border-b border-[#0f1012]/[0.06] bg-[#0f1012]/[0.02] p-2">
                                        <span className="text-xs font-medium uppercase tracking-wider text-[#868788]">Apply Template</span>
                                    </div>
                                    {templates.map((template) => {
                                        const CategoryIcon = LuServer;
                                        return (
                                            <button
                                                key={template.id}
                                                onClick={() => setShowTemplateConfirm(template)}
                                                className="flex w-full items-center gap-3 border-b border-[#0f1012]/[0.04] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#0f1012]/[0.04]"
                                            >
                                                <div className="flex size-8 items-center justify-center rounded-[6px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] text-[#8f8f8f]">
                                                    <CategoryIcon className="size-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium text-[#0f1012]">{template.name}</div>
                                                    <div className="truncate text-xs text-[#868788]">{template.nodes.length} nodes</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={openPalette}
                            className="flex items-center gap-2 rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd]/90 px-3 py-2 text-sm font-medium text-[#0f1012] shadow-card backdrop-blur-md transition-all hover:bg-[#fdfdfd]"
                        >
                            <LuPlus className="size-4 text-[#8f8f8f]" />
                            Add Node
                        </button>

                        <button
                            type="button"
                            onClick={handlePublish}
                            disabled={isPublishing}
                            className="flex items-center gap-2 rounded-[10px] bg-[#0f1012] px-4 py-2 text-sm font-medium text-white shadow-card transition-all hover:bg-[#020201] disabled:opacity-50"
                        >
                            {isPublishing ? (
                                <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                                <LuPlay className="size-4" />
                            )}
                            Publish
                        </button>
                    </div>
                </div>

                {/* Publish Modal */}
                {showPublishModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1012]/40 backdrop-blur-sm">
                        <div className="w-full max-w-sm rounded-[16px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] p-8 shadow-elevated">
                            <div className="flex flex-col items-center text-center">
                                {publishIssues.length === 0 ? (
                                    <>
                                        <div className="flex size-14 items-center justify-center rounded-full bg-[#e8f5e9] text-[#1b5e20]">
                                            <FiCheck className="size-7" strokeWidth={2.5} />
                                        </div>
                                        <h3 className="mt-5 text-xl font-medium text-[#0f1012]">Flow Published</h3>
                                        <p className="mt-1.5 text-sm text-[#868788]">
                                            {state.flowMeta?.name || 'Untitled'} is now live and ready for cases.
                                        </p>
                                        <div className="mt-6 flex w-full flex-col gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() => navigate('/flows')}
                                                className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-[#0f1012] px-4 text-sm font-medium text-white transition hover:bg-[#0f1012]/90"
                                            >
                                                <LuArrowLeft className="size-4" />
                                                Back to Flows
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowPublishModal(false)}
                                                className="flex h-10 w-full items-center justify-center rounded-[10px] border border-[#0f1012]/[0.08] bg-[#f2f2f4] px-4 text-sm font-medium text-[#0f1012] transition hover:bg-[#0f1012]/[0.05]"
                                            >
                                                Keep Editing
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex size-14 items-center justify-center rounded-full bg-[#ffebee] text-[#b71c1c]">
                                            <LuTriangleAlert className="size-7" />
                                        </div>
                                        <h3 className="mt-5 text-xl font-medium text-[#0f1012]">Cannot Publish Flow</h3>
                                        <p className="mt-1.5 text-sm text-[#868788]">{publishMessage}</p>
                                        <ul className="mt-4 w-full space-y-2 text-left">
                                            {publishIssues.map((issue, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-xs text-[#b71c1c]">
                                                    <span className="mt-0.5 size-1.5 flex-shrink-0 rounded-full bg-[#b71c1c]" />
                                                    {issue}
                                                </li>
                                            ))}
                                        </ul>
                                        <button
                                            type="button"
                                            onClick={() => setShowPublishModal(false)}
                                            className="mt-6 flex h-10 w-full items-center justify-center rounded-[10px] bg-[#0f1012] px-4 text-sm font-medium text-white transition hover:bg-[#0f1012]/90"
                                        >
                                            Close
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State Overlay */}
                {realNodeCount === 0 && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                        <div className="pointer-events-auto flex flex-col items-center gap-5 rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd]/95 p-8 shadow-elevated backdrop-blur-md min-w-[320px]">
                            <div className="flex size-12 items-center justify-center rounded-[10px] bg-[#0071e3]/10 text-[#0071e3]">
                                <LuZap className="size-6" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-medium text-[#0f1012]">Start building your flow</h3>
                                <p className="mt-1 text-sm text-[#868788]">Add your first step to automate this case workflow.</p>
                            </div>

                            {/* Template Selector */}
                            <div className="w-full relative">
                                <button
                                    onClick={() => setIsEmptyTemplateOpen(!isEmptyTemplateOpen)}
                                    disabled={isApplyingTemplate}
                                    className="flex w-full items-center justify-between gap-2 rounded-[10px] border border-[#0f1012]/[0.08] bg-[#0f1012]/[0.02] px-4 py-2.5 text-sm font-medium text-[#0f1012] transition hover:bg-[#0f1012]/[0.05] disabled:opacity-50"
                                >
                                    <span className="flex items-center gap-2">
                                        <LuLayoutTemplate className="size-4 text-[#8f8f8f]" />
                                        {isApplyingTemplate ? 'Applying template…' : 'Choose a template'}
                                    </span>
                                    <LuChevronDown
                                        className={`size-3 text-[#868788] transition-transform ${isEmptyTemplateOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {isEmptyTemplateOpen && (
                                    <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd]/95 shadow-elevated backdrop-blur-md">
                                        <div className="border-b border-[#0f1012]/[0.06] bg-[#0f1012]/[0.02] px-3 py-2">
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-[#868788]">Apply Template</span>
                                        </div>
                                        {templates.map((template) => (
                                            <button
                                                key={template.id}
                                                onClick={() => {
                                                    setShowTemplateConfirm(template);
                                                    setIsEmptyTemplateOpen(false);
                                                }}
                                                className="flex w-full items-center gap-3 border-b border-[#0f1012]/[0.04] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#0f1012]/[0.04]"
                                            >
                                                <div className="flex size-8 items-center justify-center rounded-[6px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] text-[#8f8f8f]">
                                                    <LuServer className="size-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium text-[#0f1012]">{template.name}</div>
                                                    <div className="truncate text-xs text-[#868788]">{template.nodes.length} nodes</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePaletteSelect('trigger')}
                                    className="flex items-center gap-2 rounded-[10px] border border-[#0f1012]/[0.08] bg-[#0f1012]/[0.02] px-4 py-2 text-sm font-medium text-[#0f1012] transition hover:bg-[#0f1012]/[0.05]"
                                >
                                    <LuZap className="size-4 text-[#1b5e20]" />
                                    Trigger
                                </button>
                                <button
                                    onClick={() => handlePaletteSelect('review')}
                                    className="flex items-center gap-2 rounded-[10px] border border-[#0f1012]/[0.08] bg-[#0f1012]/[0.02] px-4 py-2 text-sm font-medium text-[#0f1012] transition hover:bg-[#0f1012]/[0.05]"
                                >
                                    <LuClipboardCheck className="size-4 text-[#0071e3]" />
                                    Review
                                </button>
                                <button
                                    onClick={() => handlePaletteSelect('approval')}
                                    className="flex items-center gap-2 rounded-[10px] border border-[#0f1012]/[0.08] bg-[#0f1012]/[0.02] px-4 py-2 text-sm font-medium text-[#0f1012] transition hover:bg-[#0f1012]/[0.05]"
                                >
                                    <LuShieldCheck className="size-4 text-[#0071e3]" />
                                    Approval
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Template Confirmation */}
                {showTemplateConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1012]/20 backdrop-blur-sm">
                        <button
                            type="button"
                            aria-label="Close template confirmation"
                            className="absolute inset-0"
                            onClick={() => setShowTemplateConfirm(null)}
                        />
                        <div className="relative z-10 max-w-md rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] p-6 shadow-elevated">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-[10px] bg-[#ffebee]">
                                    <LuTriangleAlert className="size-5 text-[#b71c1c]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-[#0f1012]">Apply Template?</h3>
                                    <p className="text-sm text-[#8f8f8f]">This will replace all existing nodes</p>
                                </div>
                            </div>
                            <p className="mb-6 text-sm text-[#8f8f8f]">
                                Applying "<span className="font-medium text-[#0f1012]">{showTemplateConfirm.name}</span>" will remove all current
                                nodes and replace them with the template's {showTemplateConfirm.nodes.length} nodes.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowTemplateConfirm(null)}
                                    className="rounded-[10px] px-4 py-2 text-sm font-normal text-[#8f8f8f] transition-colors hover:bg-[#0f1012]/[0.05] hover:text-[#0f1012]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleApplyTemplate(showTemplateConfirm)}
                                    className="rounded-[10px] bg-[#0f1012] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#020201]"
                                >
                                    Apply Template
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Canvas */}
                <div className="flex-1" style={{ width: '100%', height: '100%', minHeight: 0 }} ref={flowWrapperRef}>
                    <ReactFlow
                        nodes={rfNodes}
                        edges={rfEdges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypesMap}
                        edgeTypes={edgeTypes}
                        onConnect={handleConnect}
                        onNodeDragStop={handleNodeDragStop}
                        onSelectionChange={handleSelectionChange}
                        onNodeClick={(_, node) => {
                            if (node.type === 'bankflow') {
                                setSelectedNodeId(Number(node.id));
                            }
                        }}
                        fitViewOptions={{ padding: 0.2 }}
                        minZoom={0.5}
                        maxZoom={1.5}
                        proOptions={{ hideAttribution: true }}
                        snapGrid={[SNAP_GRID, SNAP_GRID]}
                        snapToGrid={false} /* Only snap on drag stop, not during drag */
                    >
                        <Background color="#d1d1d6" gap={24} size={1} />
                        <MiniMap
                            nodeColor={(node) => {
                                if (node.type === 'ghost') return '#c7c7cc';
                                const meta = NODE_TYPE_MAP[(node.data as FlowNodeData)?.kind || ''];
                                return meta?.accent || '#868788';
                            }}
                            maskColor="rgba(242,242,244,0.72)"
                            pannable
                            zoomable
                            className="!bottom-12 !right-4 !border !border-[#0f1012]/[0.08] !bg-[#fdfdfd] !shadow-card !rounded-[10px]"
                        />
                        <Controls
                            position="bottom-left"
                            className="!bottom-12 !left-4 !m-0 !border !border-[#0f1012]/[0.08] !bg-[#fdfdfd] !shadow-card !rounded-[10px] !overflow-hidden"
                            showInteractive={false}
                        />
                    </ReactFlow>
                </div>

                {/* Bottom Status Bar */}
                <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
                    <div className="pointer-events-auto flex items-center gap-4 rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd]/90 px-4 py-2 shadow-card backdrop-blur-md">
                        <span className="text-[11px] font-medium text-[#0f1012]">{state.flowMeta?.name || 'Untitled'}</span>
                        <div className="h-3 w-px bg-[#0f1012]/[0.08]" />
                        <span className="text-[11px] text-[#868788]">
                            {realNodeCount} node{realNodeCount !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[11px] text-[#868788]">
                            {edgeCount} edge{edgeCount !== 1 ? 's' : ''}
                        </span>
                        <div className="h-3 w-px bg-[#0f1012]/[0.08]" />
                        <span className="text-[11px] text-[#868788]">v{version}</span>
                        {isActive && (
                            <>
                                <div className="h-3 w-px bg-[#0f1012]/[0.08]" />
                                <span className="flex items-center gap-1 text-[11px] font-medium text-[#1b5e20]">
                                    <span className="size-1.5 rounded-full bg-[#1b5e20]" />
                                    Live
                                </span>
                            </>
                        )}
                        <div className="h-3 w-px bg-[#0f1012]/[0.08]" />
                        {isSaving ? (
                            <span className="flex items-center gap-1.5 text-[11px] text-[#8f8f8f]">
                                <div className="size-1.5 animate-pulse rounded-full bg-[#8f8f8f]" />
                                Saving&hellip;
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[11px] text-[#868788]">
                                <FiCheck className="size-3 text-[#1b5e20]" strokeWidth={1.5} />
                                All changes saved
                            </span>
                        )}
                    </div>
                </div>

                <NodePicker
                    isOpen={nodePickerOpen}
                    onClose={() => setNodePickerOpen(false)}
                    onSelect={handleNodeSelect}
                    position={pickerPosition}
                />

                <ConfigPanel
                    isOpen={!!selectedNodeId}
                    node={(() => {
                        const found = state.nodes.find((n) => n.id === selectedNodeId);
                        if (!found) return null;
                        return {
                            id: found.id,
                            name: found.name || '',
                            kind: found.kind as NodeKind,
                            config: found.config || {},
                        };
                    })()}
                    onUpdate={async (nodeId, updates: { config?: Record<string, unknown>; name?: string }) => {
                        const newNodes = state.nodes.map((n: FlowGraphNode) => (n.id === nodeId ? { ...n, ...updates } : n));
                        setState((prev: BuilderState) => ({ ...prev, nodes: newNodes }));

                        try {
                            beginSave();
                            await updateFlowNode(state.flowId!, nodeId, updates);
                        } finally {
                            endSave();
                        }
                    }}
                    onDelete={async (nodeId) => {
                        if (!state.flowId) return;

                        const newNodes = state.nodes.filter((n) => n.id !== nodeId);
                        const newEdges = state.edges.filter((e) => e.from_node_id !== nodeId && e.to_node_id !== nodeId);

                        setState((prev) => ({
                            ...prev,
                            nodes: newNodes,
                            edges: newEdges,
                        }));

                        refreshRef.current(newNodes, newEdges);

                        try {
                            beginSave();
                            await deleteFlowNode(state.flowId!, nodeId);
                        } catch (e) {
                            console.error('Delete failed', e);
                            const graph = await fetchFlowGraph(state.flowId!);
                            setState((prev) => ({ ...prev, nodes: graph.nodes, edges: graph.edges }));
                            refreshRef.current(graph.nodes, graph.edges);
                        } finally {
                            endSave();
                        }
                    }}
                    onClose={() => setSelectedNodeId(null)}
                />
            </div>
        </div>
    );
};

const FlowBuilderPage: React.FC = () => {
    return (
        <ReactFlowProvider>
            <FlowBuilderContent />
        </ReactFlowProvider>
    );
};

export default FlowBuilderPage;
