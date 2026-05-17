import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as dagre from 'dagre';
import { FiCheck } from 'react-icons/fi';
import { LuLayoutTemplate, LuChevronDown, LuServer, LuTriangleAlert } from 'react-icons/lu';

import {
  fetchFlowGraph,
  createFlowNode,
  createFlowEdge,
  updateFlowNode,
  updateFlowNodePosition,
  deleteFlowEdge,
  deleteFlowNode,
  updateFlow,
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
  type EdgeProps,
  ReactFlowProvider,
  useReactFlow,
  getBezierPath,
  BaseEdge,
  type Node as RFNode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import PremiumNode from '../../components/builder/PremiumNode';
import GhostNode from '../../components/builder/GhostNode';
import Sidebar from '../../layout/sidebar';
import ConfigPanel from '../../components/builder/ConfigPanel';
import NodePicker from '../../components/builder/NodePicker';
import { templates, type FlowTemplate } from '../../data/templates';
import { DEFAULT_NODE_CONFIGS, type NodeKind } from '../../types/nodeConfigs';

type BuilderState = {
  flowId: number | null;
  flowMeta?: FlowGraphMeta;
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
};

const CustomEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = EMPTY_EDGE_STYLE,
  markerEnd,
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <circle r="3" fill="#9c9c9d">
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
};

const SuggestedEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const connectSuggestedEdge = () => {
    if (data?.onConnect) {
      data.onConnect();
    }
  };

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        onClick={connectSuggestedEdge}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="#363739"
        strokeWidth={2}
        strokeDasharray="8,4"
        style={{ opacity: 0.6, pointerEvents: 'none' }}
      />
      <foreignObject
        x={labelX - 12}
        y={labelY - 12}
        width={24}
        height={24}
        style={{ overflow: 'visible', cursor: 'pointer' }}
        onClick={connectSuggestedEdge}
      >
        <div
          className="flex size-6 items-center justify-center rounded-full border-2 border-white/[0.18] bg-[#07080a] text-base font-semibold text-[#9c9c9d] transition-colors hover:bg-white hover:text-[#040506]"
          title="Click to connect these nodes"
        >
          +
        </div>
      </foreignObject>
    </>
  );
};

const nodeTypesMap = {
  bankflow: PremiumNode,
  ghost: GhostNode,
};

const edgeTypes = {
  custom: CustomEdge,
  suggested: SuggestedEdge,
};

const EMPTY_EDGE_STYLE: React.CSSProperties = {};

export type FlowNodeData = {
  backendId?: number;
  name?: string | null;
  kind: string;
  config?: Record<string, unknown>;
  onAdd?: (event: React.MouseEvent) => void;
};

const nodeWidth = 240;
const nodeHeight = 100;

const getLayoutedElements = (nodes: RFNode<FlowNodeData>[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: (nodeWithPosition?.x ?? 100) - nodeWidth / 2 + 100,
        y: (nodeWithPosition?.y ?? 100) - nodeHeight / 2 + 100,
      },
    };
  });

  return { nodes: newNodes, edges };
};

function getFromNodeId(edge: FlowGraphEdge): number {
  const e = edge as Partial<{ fromNodeId: number; from_node_id: number }>;
  return e.fromNodeId ?? e.from_node_id ?? 0;
}

function getToNodeId(edge: FlowGraphEdge): number {
  const e = edge as Partial<{ toNodeId: number; to_node_id: number }>;
  return e.toNodeId ?? e.to_node_id ?? 0;
}

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

  const [rfNodes, setRfNodes, onNodesChange] =
    useNodesState<FlowNodeData>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<FlowGraphEdge>([]);
  const [nodePickerOpen, setNodePickerOpen] = useState(false);
  const [pickerParentId, setPickerParentId] = useState<number | null>(null);
  const [pickerPosition, setPickerPosition] = useState<{x: number, y: number} | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState<FlowTemplate | null>(null);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);

  const [pendingSaves, setPendingSaves] = useState(0);
  const beginSave = useCallback(() => setPendingSaves((n: number) => n + 1), []);
  const endSave = useCallback(
    () => setPendingSaves((n: number) => Math.max(0, n - 1)),
    []
  );
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
        setState(prev => ({ ...prev, nodes: graph.nodes, edges: graph.edges }));
        refreshRef.current(graph.nodes, graph.edges);
      } catch (e) {
        console.error(
          "[FlowBuilderPage] Failed to delete edge on server:",
          e
        );
      } finally {
        endSave();
      }
    },
    [state.flowId, beginSave, endSave, setRfEdges]
  );

  const mapToReactFlowEdge = useCallback(
    (edge: FlowGraphEdge): Edge => ({
      id: String(edge.id),
      source: String(getFromNodeId(edge)),
      target: String(getToNodeId(edge)),
      label: edge.label ?? undefined,
      type: "custom",
      data: { onDelete: handleEdgeDeleteClick },
    }),
    [handleEdgeDeleteClick]
  );

  const refreshVisualGraph = useCallback((backendNodes: FlowGraphNode[], backendEdges: FlowGraphEdge[]) => {
      const realNodes: RFNode<FlowNodeData>[] = backendNodes.map(n => ({
          id: String(n.id),
          type: 'bankflow',
          position: { x: n.pos_x || 0, y: n.pos_y || 0 },
          data: {
              backendId: n.id,
              name: n.name,
              kind: n.kind,
              config: n.config || {}
          }
      }));

      if (realNodes.length === 0) {
          const startGhost: RFNode<FlowNodeData> = {
            id: 'ghost-start',
            type: 'ghost',
            position: { x: 360, y: 240 },
            data: {
              kind: 'ghost',
              onAdd: (e: React.MouseEvent) => {
                if (e) setPickerPosition({ x: e.clientX + 20, y: e.clientY }); 
                setPickerParentId(null);
                setNodePickerOpen(true);
              }
            }
          };
          setRfNodes([startGhost]);
          setRfEdges([]);
          return;
      }

      const sourceIds = new Set(backendEdges.map(e => getFromNodeId(e)));
      const leafNodes = backendNodes.filter(n => !sourceIds.has(n.id));

      const ghostNodes: RFNode<FlowNodeData>[] = leafNodes.map(leaf => ({
          id: `ghost-${leaf.id}`,
          type: 'ghost',
          position: { x: (leaf.pos_x || 0) + 400, y: (leaf.pos_y || 0) }, 
          data: {
              kind: 'ghost',
              onAdd: (e: React.MouseEvent) => {
                  if (e) setPickerPosition({ x: e.clientX + 20, y: e.clientY });
                  setPickerParentId(leaf.id);
                  setNodePickerOpen(true);
              }
          }
      }));

      const realRfEdges = backendEdges.map(mapToReactFlowEdge);
      const ghostEdges: Edge[] = leafNodes.map(leaf => ({
          id: `e-ghost-${leaf.id}`,
          source: String(leaf.id),
          target: `ghost-${leaf.id}`,
          type: 'custom',
          animated: true,
          style: { stroke: '#363739', strokeDasharray: '5,5', opacity: 0.5 },
      }));

      const allNodes = [...realNodes, ...ghostNodes];
      const allEdges = [...realRfEdges, ...ghostEdges];

      const hasPositions = realNodes.some(n => n.position.x !== 0 || n.position.y !== 0);
      
      if (!hasPositions && realNodes.length > 0) {
          const layouted = getLayoutedElements(allNodes, allEdges);
          setRfNodes(layouted.nodes);
          setRfEdges(layouted.edges);
      } else {
          setRfNodes(allNodes);
          setRfEdges(allEdges);
      }
  }, [setRfNodes, setRfEdges, mapToReactFlowEdge]);

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
        if (!params.id) throw new Error("No ID");
        const numericId = Number(params.id);
        
        const graph = await fetchFlowGraph(numericId);
        if (cancelled) return;

        setState({
            flowId: numericId,
            flowMeta: graph.flow,
            nodes: graph.nodes,
            edges: graph.edges
        });
        
        refreshRef.current(graph.nodes, graph.edges);
      } catch (e) {
         if(!cancelled) setError(e instanceof Error ? e.message : "Failed to load flow");
      } finally {
         if(!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [params.id]);

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
      setState(prev => ({ ...prev, flowMeta: updatedMeta }));

      try {
          await updateFlow(state.flowId, { name: newName });
      } catch (e) {
          console.error("Rename failed", e);
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

      const nodeIdMap: Record<string, number> = {};

      await Promise.all(template.nodes.map(async (templateNode) => {
        const nodeResponse = await createFlowNode(flowId, {
          kind: templateNode.kind,
          name: templateNode.name,
          posX: templateNode.pos_x,
          posY: templateNode.pos_y,
          config: templateNode.config,
        });
        nodeIdMap[templateNode.id] = nodeResponse.id;
      }));

      await Promise.all(template.edges.map(async (templateEdge) => {
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
      }));

      await updateFlow(flowId, { name: template.name });

      const graph = await fetchFlowGraph(flowId);
      setState(prev => ({
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
      console.error("Failed to apply template:", e);
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: RFNode) => {
      const data = node.data as FlowNodeData | undefined;
      if (!data) return;

      const backendId = data.backendId;
      const { x, y } = node.position;

      if (!backendId) return;

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        console.warn(`[FlowBuilderPage] Invalid position values for node ${backendId}: (${x}, ${y})`);
        return;
      }

      const nodeExists = state.nodes.some(n => n.id === backendId);
      if (!nodeExists) {
        console.warn(`[FlowBuilderPage] Node ${backendId} not found in state, skipping position update`);
        return;
      }

      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === backendId ? { ...n, pos_x: x, pos_y: y } : n
        ),
      }));

      if (state.flowId) {
        try {
          beginSave();
          await updateFlowNodePosition(state.flowId!, backendId, x, y);
        } catch (e) {
          console.error("[FlowBuilderPage] Failed to persist node position:", e);
        } finally {
          endSave();
        }
      }
    },
    [state.flowId, state.nodes, beginSave, endSave]
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
        setState(prev => ({ ...prev, nodes: graph.nodes, edges: graph.edges }));
        refreshRef.current(graph.nodes, graph.edges);
      } catch (err) {
        console.error("[FlowBuilderPage] Failed to create edge:", err);
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
          
          let posX = 100;
          let posY = 100;

          if (pickerPosition) {
              const projected = project({ x: pickerPosition.x, y: pickerPosition.y });
              posX = projected.x;
              posY = projected.y;
          } else if (pickerParentId) {
             const parent = state.nodes.find(n => n.id === pickerParentId);
             if (parent) {
                 posX = parent.pos_x + 300;
                 posY = parent.pos_y;
             }
          }

          if (isFirstNode) {
              posX = 200;
              posY = 200;
          }

          const newNode = await createFlowNode(state.flowId, {
              kind,
              posX, 
              posY,
              config: DEFAULT_NODE_CONFIGS[kind as NodeKind] ?? {},
          });

          if (pickerParentId) {
            await createFlowEdge(state.flowId, {
                fromNodeId: pickerParentId,
                toNodeId: newNode.id
            });
          }

          const graph = await fetchFlowGraph(state.flowId);
          setState(prev => ({ ...prev, nodes: graph.nodes, edges: graph.edges })); 
          refreshRef.current(graph.nodes, graph.edges);

          if (isFirstNode) {
              setTimeout(() => {
                  fitView({ padding: 0.5, maxZoom: 0.85, duration: 400 });
              }, 150);
          }

      } catch (e) {
          console.error("Failed to add node", e);
      } finally {
          endSave();
      }
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center bg-[#040506]"
        style={{ width: '100vw', height: '100vh' }}
      >
        <div className="text-[#9c9c9d] text-lg">Loading flow builder...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 bg-[#040506]"
        style={{ width: '100vw', height: '100vh' }}
      >
        <h1 className="text-xl font-semibold text-white">Flow Builder</h1>
        <div className="px-4 py-3 bg-[#452324]/40 border border-[#ff6363]/20 rounded-lg text-[#ff6363]">{error}</div>
        <button
          className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg text-white text-sm transition-colors"
          onClick={() => navigate("/flows")}
        >
          Back to Flows
        </button>
      </div>
    );
  }

  return (
    <div className="flex size-screen overflow-hidden bg-[#040506]">
        <Sidebar />

        <div className="flex-1 flex flex-col relative min-w-0">
            
            {/* Header Overlay */}
            <div className="absolute top-4 left-4 z-40 flex items-center gap-4">
                <div className="bg-[#07080a]/90 backdrop-blur border border-white/[0.08] rounded-xl px-4 py-2 flex items-center gap-3 shadow-xl">
                    <input 
                        className="bg-transparent border-none text-white font-semibold text-lg focus:ring-0 placeholder-white/30 w-[300px] outline-none"
                        value={state.flowMeta?.name || ''}
                        onChange={e => handleRename(e.target.value)}
                        placeholder="Untitled Flow"
                    />
                    <div className="h-4 w-px bg-white/[0.08]" />
                    <div className="flex items-center gap-2 text-xs text-[#6a6b6c]">
                        {isSaving ? (
                            <span className="flex items-center gap-1 text-[#9c9c9d]"><div className="size-2 rounded-full bg-[#9c9c9d] animate-pulse"/> Saving...</span>
                        ) : (
                            <span className="flex items-center gap-1"><FiCheck className="text-[#59d499]"/> Saved</span>
                        )}
                    </div>
                </div>
                
                {/* Template Dropdown */}
                <div className="relative">
                    <button 
                        onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                        disabled={isApplyingTemplate}
                        className="bg-[#111214] hover:bg-[#1b1c1e] transition shadow-lg px-3 py-2 rounded-xl text-white font-medium flex items-center gap-2 text-sm disabled:opacity-50 border border-white/[0.08]"
                    >
                        {isApplyingTemplate ? (
                            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <LuLayoutTemplate className="size-4" />
                        )}
                        Templates
                        <LuChevronDown className={`size-3 transition-transform ${isTemplateDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isTemplateDropdownOpen && (
                        <div className="absolute top-full mt-2 left-0 bg-[#111214] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden min-w-[280px] z-50">
                            <div className="p-2 border-b border-white/[0.08] bg-white/[0.02]">
                                <span className="text-xs font-medium text-[#6a6b6c] uppercase tracking-wider">Apply Template</span>
                            </div>
                            {templates.map((template) => {
                                const CategoryIcon = LuServer;
                                return (
                                    <button
                                        key={template.id}
                                        onClick={() => setShowTemplateConfirm(template)}
                                        className="w-full px-4 py-3 text-left hover:bg-white/[0.03] transition-colors flex items-center gap-3 border-b border-white/[0.04] last:border-b-0"
                                    >
                                        <div className="size-8 rounded-lg flex items-center justify-center bg-[#07080a] text-[#9c9c9d] border border-white/[0.08]">
                                            <CategoryIcon className="size-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-white">{template.name}</div>
                                            <div className="text-xs text-[#6a6b6c] truncate">{template.nodes.length} nodes</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Template Confirmation Modal */}
            {showTemplateConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040506]/60 backdrop-blur-sm">
                    <button type="button" aria-label="Close template confirmation" className="absolute inset-0" onClick={() => setShowTemplateConfirm(null)} />
                    <div className="bg-[#111214] border border-white/[0.08] rounded-2xl p-6 max-w-md shadow-2xl relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="size-10 rounded-xl bg-[#ff6363]/10 flex items-center justify-center">
                                <LuTriangleAlert className="size-5 text-[#ff6363]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Apply Template?</h3>
                                <p className="text-sm text-[#9c9c9d]">This will replace all existing nodes</p>
                            </div>
                        </div>
                        <p className="text-sm text-[#9c9c9d] mb-6">
                            Applying "<span className="font-medium text-white">{showTemplateConfirm.name}</span>" will remove all current nodes and replace them with the template's {showTemplateConfirm.nodes.length} nodes.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowTemplateConfirm(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleApplyTemplate(showTemplateConfirm)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#e6e6e6] text-[#2f3031] hover:bg-white transition-colors"
                            >
                                Apply Template
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Canvas */}
            <div className="flex-1 size-full" ref={flowWrapperRef}>
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
                >
                    <Background color="#1b1c1e" gap={20} size={1} />
                    <MiniMap
                        nodeColor={(node) => (node.type === 'ghost' ? '#363739' : '#9c9c9d')}
                        maskColor="rgba(4,5,6,0.72)"
                        pannable
                        zoomable
                        className="!bg-[#07080a] !border !border-white/[0.08] !rounded-xl"
                    />
                    <Controls className="glass-panel" position="bottom-left" />
                </ReactFlow>
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
                    const found = state.nodes.find(n => n.id === selectedNodeId);
                    if (!found) return null;
                    return {
                        id: found.id,
                        name: found.name || '',
                        kind: found.kind as NodeKind,
                        config: found.config || {}
                    };
                })()}
                onUpdate={async (nodeId, updates: { config?: Record<string, unknown>; name?: string }) => {
                     const newNodes = state.nodes.map((n: FlowGraphNode) => n.id === nodeId ? { ...n, ...updates } : n);
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

                     const newNodes = state.nodes.filter(n => n.id !== nodeId);
                     const newEdges = state.edges.filter(e => e.from_node_id !== nodeId && e.to_node_id !== nodeId);

                     setState(prev => ({
                        ...prev,
                        nodes: newNodes,
                        edges: newEdges
                     }));

                     refreshRef.current(newNodes, newEdges);

                     try {
                         beginSave();
                         await deleteFlowNode(state.flowId!, nodeId);
                     } catch(e) {
                         console.error("Delete failed", e);
                         const graph = await fetchFlowGraph(state.flowId!);
                         setState(prev => ({ ...prev, nodes: graph.nodes, edges: graph.edges }));
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
