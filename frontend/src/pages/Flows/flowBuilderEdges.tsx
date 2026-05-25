import { BaseEdge, getBezierPath, type EdgeProps } from "reactflow";
import type React from "react";

const EMPTY_EDGE_STYLE: React.CSSProperties = {};

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = EMPTY_EDGE_STYLE,
  markerEnd,
  label,
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

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {label && (
        <foreignObject
          x={labelX - 30}
          y={labelY - 14}
          width={60}
          height={28}
          style={{ overflow: "visible", pointerEvents: "none" }}
        >
          <div className="flex h-full items-center justify-center">
            <span className="rounded-[6px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] px-2 py-0.5 text-[11px] font-medium text-[#0f1012] shadow-sm">
              {label}
            </span>
          </div>
        </foreignObject>
      )}
      <circle r="3" fill="#c7c7cc">
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
      </circle>
      {data?.onDelete && (
        <foreignObject
          x={labelX - 10}
          y={labelY - 10}
          width={20}
          height={20}
          style={{ overflow: "visible" }}
        >
          <button
            onClick={() => data.onDelete(String(id))}
            className="nodrag nopan flex size-5 items-center justify-center rounded-full border border-[#0f1012]/[0.08] bg-[#fdfdfd] text-[10px] text-[#868788] opacity-0 shadow-sm transition-opacity hover:border-[#b71c1c]/30 hover:bg-[#ffebee] hover:text-[#b71c1c]"
            style={{ pointerEvents: "auto" }}
            title="Delete connection"
          >
            &times;
          </button>
        </foreignObject>
      )}
    </>
  );
};

export const SuggestedEdge = ({
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
        style={{ cursor: "pointer" }}
        onClick={connectSuggestedEdge}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="#c7c7cc"
        strokeWidth={2}
        strokeDasharray="8,4"
        style={{ opacity: 0.6, pointerEvents: "none" }}
      />
      <foreignObject
        x={labelX - 12}
        y={labelY - 12}
        width={24}
        height={24}
        style={{ overflow: "visible", cursor: "pointer" }}
        onClick={connectSuggestedEdge}
      >
        <div
          className="flex size-6 items-center justify-center rounded-full border-2 border-[#0f1012]/[0.12] bg-[#fdfdfd] text-base font-medium text-[#868788] shadow-sm transition-colors hover:border-[#0f1012]/[0.24] hover:bg-[#0f1012] hover:text-white"
          title="Click to connect these nodes"
        >
          +
        </div>
      </foreignObject>
    </>
  );
};
