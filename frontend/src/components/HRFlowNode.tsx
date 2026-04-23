import React, { useMemo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { WorkflowGraphConfig } from "../api/workflows";
import { getConfigPreview } from "../utils/expressionLabels";

export type HRFlowNodeData = {
  backendId: number;
  name: string | null;
  kind: string;
  config?: WorkflowGraphConfig;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

const HRFlowNode: React.FC<NodeProps<HRFlowNodeData>> = ({ data, selected }) => {
  const configPreview = useMemo(() => {
    if (!isRecord(data.config)) {
      return 'Click to configure';
    }
    return getConfigPreview(data.kind, data.config);
  }, [data.config, data.kind]);

  return (
    <div
      className="hrflow-node"
      style={{
        borderRadius: "0.85rem",
        backgroundColor: "rgba(15,23,42,0.95)",
        border: selected ? "2px solid #3b82f6" : "1px solid rgba(148,163,184,0.5)",
        boxShadow: selected
          ? "0 0 0 1px rgba(59,130,246,0.7), 0 18px 35px rgba(15,23,42,0.9)"
          : "0 10px 25px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,1)",
        padding: "0.5rem 0.75rem",
        minWidth: 180,
        color: "#e5e7eb",
        fontSize: "0.78rem",
        position: "relative",
      }}
    >
      <div className="d-flex justify-content-between align-items-center mb-1">
        <span className="text-uppercase text-muted" style={{ fontSize: "0.65rem" }}>
          {data.kind}
        </span>
        <span className="badge bg-primary" style={{ fontSize: "0.65rem" }}>
          #{data.backendId}
        </span>
      </div>

      <div className="fw-semibold">
        {data.name && data.name.trim().length > 0 ? data.name : "Untitled node"}
      </div>

      <div className="mt-1 text-muted" style={{ fontSize: "0.7rem", maxWidth: 200 }}>
        {configPreview}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          borderRadius: "999px",
          border: "2px solid #38bdf8",
          backgroundColor: "#0f172a",
        }}
      />

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10,
          height: 10,
          borderRadius: "999px",
          border: "2px solid #a855f7",
          backgroundColor: "#0f172a",
        }}
      />
    </div>
  );
};

export default HRFlowNode;
