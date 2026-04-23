import React from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import type { WorkflowApi } from '../../../api/workflows';

type WorkflowCardProps = {
    workflow: WorkflowApi;
    isActive: boolean;
    onClick: () => void;
};

const formatTime = (value?: string | null) => {
    if (!value) return "--:--";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "--:--";
    return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const WorkflowCard: React.FC<WorkflowCardProps> = ({ workflow, isActive, onClick }) => {
    return (
        <motion.div
            layoutId={`workflow-card-${workflow.id}`}
            onClick={onClick}
            className={`
                group relative flex items-center gap-4 px-4 py-3 rounded-none clip-path-polygon cursor-pointer border-l-2 transition-all duration-300
                ${isActive 
                    ? 'bg-gradient-to-r from-cyan-900/40 to-blue-900/20 border-l-cyan-400 border-t border-b border-r border-white/5 shadow-[0_0_30px_rgba(34,211,238,0.15)] z-10' 
                    : 'bg-white/5 border-l-transparent border-t border-b border-r border-white/5 hover:bg-white/10 hover:border-l-cyan-400/50'
                }
            `}
            style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 85%, 95% 100%, 0 100%)' // Cyber-corner cut
            }}
        >
             {/* Tech Background Grid (Subtle) */}
            {isActive && <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />}

            {/* 1. Status Indicator ( Glowing Hexagon or similar? Let's stick to a sharp pill) */}
             <div className={`
                flex items-center justify-center w-8 h-8 rounded-sm bg-black/40 border flex-shrink-0 relative overflow-hidden
                ${workflow.is_active 
                    ? 'border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]' 
                    : 'border-slate-700 text-slate-600'}
            `}>
                {workflow.is_active && <div className="absolute inset-0 bg-cyan-400/20 animate-pulse" />}
                {workflow.is_active ? <FiCheckCircle size={14} /> : <FiAlertCircle size={14} />}
            </div>

            {/* 2. Content */}
            <div className="flex-1 min-w-0 flex flex-col gap-1 z-10">
                 <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-sm font-bold tracking-wide uppercase truncate ${isActive ? 'text-cyan-100 drop-shadow-md' : 'text-slate-400 group-hover:text-cyan-200 transition-colors'}`}>
                        {workflow.name}
                    </h3>
                     <span className={`text-[10px] font-mono text-cyan-500/80 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                        &lt;{formatTime(workflow.updated_at)}&gt;
                    </span>
                 </div>
                 
                 <div className="flex items-center gap-2">
                     <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${workflow.is_active ? 'text-cyan-400' : 'text-slate-600'}`}>
                        {workflow.is_active ? 'ONLINE' : 'OFFLINE'}
                     </span>
                     <div className="h-px bg-white/10 flex-1" />
                 </div>
            </div>

            {/* Active Indication Glitch Bar (Right) */}
            {isActive && (
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
            )}
        </motion.div>
    );
};

export default WorkflowCard;
