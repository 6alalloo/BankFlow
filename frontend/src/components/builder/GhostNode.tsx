import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { LuPlus } from 'react-icons/lu';
import clsx from 'clsx';

const GhostNode = ({ data }: NodeProps) => {
    // data.onAdd is passed from the builder page to handle the click
    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (data.onAdd) data.onAdd();
    };

    return (
        <div className="group relative flex items-center justify-center w-12 h-12">
            {/* Pulsating Ring */}
            <div className="absolute inset-0 rounded-full bg-cyan-glow/20 animate-ping opacity-20 group-hover:opacity-40" />

            <button
                onClick={handleAdd}
                className={clsx(
                    "relative z-10 w-8 h-8 rounded-full flex items-center justify-center",
                    "bg-navy-900 border border-cyan-glow/30 text-cyan-glow",
                    "transition-all duration-200 transform",
                    "hover:scale-110 hover:bg-cyan-glow hover:text-navy-950 hover:shadow-glow-sm"
                )}
                title="Add Step"
            >
                <LuPlus className="w-5 h-5" />
            </button>

            {/* Invisible Handles */}
            <Handle type="target" position={Position.Left} className="opacity-0" />
        </div>
    );
};

export default memo(GhostNode);
