import * as dagre from "dagre";
import type React from "react";
import type { Edge, Node as RFNode } from "reactflow";

import type { FlowGraphEdge } from "../../api/flows";
import GhostNode from "../../components/builder/GhostNode";
import PremiumNode from "../../components/builder/PremiumNode";
import { CustomEdge, SuggestedEdge } from "./flowBuilderEdges";

export const SNAP_GRID = 20;

export const snap = (val: number) => Math.round(val / SNAP_GRID) * SNAP_GRID;

export type FlowNodeData = {
  backendId?: number;
  name?: string | null;
  kind: string;
  config?: Record<string, unknown>;
  onAdd?: (event: React.MouseEvent) => void;
  onAddAfter?: () => void;
};

const nodeWidth = 240;
const nodeHeight = 100;

export const nodeTypesMap = {
  bankflow: PremiumNode,
  ghost: GhostNode,
};

export const edgeTypes = {
  custom: CustomEdge,
  suggested: SuggestedEdge,
};

export const getLayoutedElements = (nodes: RFNode<FlowNodeData>[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 100 });

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
        x: snap((nodeWithPosition?.x ?? 100) - nodeWidth / 2 + 100),
        y: snap((nodeWithPosition?.y ?? 100) - nodeHeight / 2 + 100),
      },
    };
  });

  return { nodes: newNodes, edges };
};

export function getFromNodeId(edge: FlowGraphEdge): number {
  const e = edge as Partial<{ fromNodeId: number; from_node_id: number }>;
  return e.fromNodeId ?? e.from_node_id ?? 0;
}

export function getToNodeId(edge: FlowGraphEdge): number {
  const e = edge as Partial<{ toNodeId: number; to_node_id: number }>;
  return e.toNodeId ?? e.to_node_id ?? 0;
}
