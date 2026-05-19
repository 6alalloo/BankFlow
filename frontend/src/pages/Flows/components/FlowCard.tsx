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
                group relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] cursor-pointer transition-all duration-200
                ${isActive 
                    ? 'bg-[#0f1012]/[0.06] border border-[#0f1012]/[0.10] z-10' 
                    : 'bg-transparent border border-transparent hover:bg-[#0f1012]/[0.03] hover:border-[#0f1012]/[0.06]'
                }
            `}
        >
            {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#0071e3] rounded-r-full" />}
            <div className={`
                flex items-center justify-center size-7 rounded-[6px] bg-[#fdfdfd] border flex-shrink-0
                ${flow.is_active 
                    ? 'border-[#0f1012]/[0.14] text-[#0f1012]' 
                    : 'border-[#0f1012]/[0.06] text-[#868788]'}
            `}>
                {flow.is_active ? <FiCheckCircle size={14} strokeWidth={1.5} /> : <FiAlertCircle size={14} strokeWidth={1.5} />}
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-0.5 z-10">
                 <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-sm font-normal tracking-tight truncate ${isActive ? 'text-[#0f1012]' : 'text-[#8f8f8f] group-hover:text-[#0f1012] transition-colors'}`}>
                        {flow.name}
                    </h3>
                     <span className={`text-[10px] text-[#868788] flex-shrink-0 tabular-nums ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                        {formatTime(flow.updated_at)}
                    </span>
                 </div>
                 
                 <div className="flex items-center gap-2">
                     <span className={`text-[9px] font-normal uppercase tracking-[0.15em] ${flow.is_active ? 'text-[#1b5e20]' : 'text-[#868788]'}`}>
                        {flow.is_active ? 'ONLINE' : 'OFFLINE'}
                     </span>
                     <div className="h-px bg-[#0f1012]/[0.06] flex-1" />
                 </div>
            </div>
        </div>
    );
};

export default FlowCard;
