import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { LuPlus } from 'react-icons/lu';

const GhostNode = ({ data }: NodeProps) => {
    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (data.onAdd) data.onAdd();
    };

    return (
        <div className="group relative flex items-center justify-center size-12">
            <button
                onClick={handleAdd}
                className="relative z-10 size-8 rounded-full flex items-center justify-center bg-[#07080a] border border-dashed border-white/[0.12] text-[#6a6b6c] transition-all duration-200 hover:scale-110 hover:bg-[#111214] hover:text-white hover:border-white/[0.18]"
                title="Add Step"
            >
                <LuPlus className="size-4" />
            </button>

            <Handle type="target" position={Position.Left} className="opacity-0" />
        </div>
    );
};

export default memo(GhostNode);
