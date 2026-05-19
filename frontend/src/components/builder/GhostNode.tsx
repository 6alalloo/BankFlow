import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { LuPlus } from 'react-icons/lu';

const GhostNode = ({ data }: NodeProps) => {
    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (data.onAdd) data.onAdd(e);
    };

    return (
        <div className="group relative flex size-16 items-center justify-center">
            {/* Pulse rings */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#0071e3]/20 animate-pulse" />
            <div className="absolute inset-2 rounded-full border border-dashed border-[#0071e3]/10" />

            <button
                onClick={handleAdd}
                aria-label="Add Step"
                className="relative z-10 flex size-10 items-center justify-center rounded-full border border-dashed border-[#0071e3]/30 bg-[#fdfdfd] text-[#0071e3] shadow-sm transition-all duration-200 hover:scale-110 hover:border-[#0071e3]/50 hover:bg-[#0071e3]/5 hover:shadow-md"
                title="Add Step"
            >
                <LuPlus className="size-5" />
            </button>

            <Handle type="target" position={Position.Left} className="opacity-0" />
        </div>
    );
};

export default memo(GhostNode);
