import React from 'react';
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import type { FlowApi } from '../../../api/flows';

type FlowCardProps = {
    flow: FlowApi;
    isActive: boolean;
    onClick: () => void;
};

const formatTime = (value?: string | null) => {
    if (!value) return "--:--";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "--:--";
    return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const FlowCard: React.FC<FlowCardProps> = ({ flow, isActive, onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`
                group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer border transition-all duration-200
                ${isActive 
                    ? 'bg-[#111214] border-white/[0.18] shadow-[rgba(255,255,255,0.05)_0px_1px_0px_0px_inset,rgba(255,255,255,0.18)_0px_0px_0px_1px,rgba(0,0,0,0.2)_0px_-1px_0px_0px_inset] z-10' 
                    : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.08]'
                }
            `}
        >
            <div className={`
                flex items-center justify-center size-7 rounded-md bg-[#07080a] border flex-shrink-0
                ${flow.is_active 
                    ? 'border-white/[0.18] text-white' 
                    : 'border-white/[0.08] text-[#6a6b6c]'}
            `}>
                {flow.is_active ? <FiCheckCircle size={14} /> : <FiAlertCircle size={14} />}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-0.5 z-10">
                 <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-sm font-medium tracking-wide truncate ${isActive ? 'text-white' : 'text-[#9c9c9d] group-hover:text-white transition-colors'}`}>
                        {flow.name}
                    </h3>
                     <span className={`text-[10px] font-mono text-[#6a6b6c] flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                        {formatTime(flow.updated_at)}
                    </span>
                 </div>
                 
                 <div className="flex items-center gap-2">
                     <span className={`text-[9px] font-semibold uppercase tracking-[0.15em] ${flow.is_active ? 'text-[#59d499]' : 'text-[#6a6b6c]'}`}>
                        {flow.is_active ? 'ONLINE' : 'OFFLINE'}
                     </span>
                     <div className="h-px bg-white/[0.08] flex-1" />
                 </div>
            </div>
        </div>
    );
};

export default FlowCard;
