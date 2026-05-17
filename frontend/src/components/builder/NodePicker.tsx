import React, { useState } from 'react';
import {
    LuMail, LuGlobe, LuSplit, LuDatabase, LuClock, LuX, LuZap, LuInfo, LuTerminal, LuCalendar, LuBox,
    LuClipboardCheck, LuFileCheck, LuGitBranch, LuRoute, LuShieldCheck, LuTriangleAlert, LuUserCheck
} from 'react-icons/lu';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';

type NodePickerProps = {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (kind: string) => void;
    position?: { x: number; y: number } | null;
};

const NODE_TYPES = [
    { kind: 'trigger', label: 'Trigger', icon: LuZap, description: "Starts the flow. Configure your case intake values here." },
    { kind: 'review', label: 'Review Task', icon: LuClipboardCheck, description: "Creates a blocking operational review task." },
    { kind: 'data_capture', label: 'Data Capture', icon: LuDatabase, description: "Creates a task to collect structured case data." },
    { kind: 'document_collection', label: 'Documents', icon: LuFileCheck, description: "Creates a task for required case documents." },
    { kind: 'approval', label: 'Approval', icon: LuShieldCheck, description: "Requests an approval before the case can continue." },
    { kind: 'condition', label: 'Condition', icon: LuSplit, description: "Branches flow based on logic (If/Else)." },
    { kind: 'routing', label: 'Route Case', icon: LuRoute, description: "Updates the case assignee or queue." },
    { kind: 'sla', label: 'SLA Timer', icon: LuClock, description: "Sets the due date for the next blocking step." },
    { kind: 'escalation', label: 'Escalation', icon: LuTriangleAlert, description: "Escalates the case to a user or team." },
    { kind: 'status_update', label: 'Status Update', icon: LuGitBranch, description: "Updates case status or completes the runtime." },
    { kind: 'email', label: 'Send Email', icon: LuMail, description: "Records or requests an email notification." },
    { kind: 'http', label: 'HTTP Request', icon: LuGlobe, description: "Records or requests an external API call." },
    { kind: 'database', label: 'Database', icon: LuDatabase, description: "Records or requests a database operation." },
    { kind: 'variable', label: 'Set Variable', icon: LuBox, description: "Store and manipulate data for use in later steps." },
    { kind: 'wait', label: 'Delay / Wait', icon: LuClock, description: "Sets a due date for the next blocking step." },
    { kind: 'datetime', label: 'Date / Time', icon: LuCalendar, description: "Format, calculate, or get current date/time." },
    { kind: 'approval_support', label: 'Approval Prep', icon: LuUserCheck, description: "Creates a task to prepare an approval package." },
    { kind: 'logger', label: 'Logger', icon: LuTerminal, description: "Writes an audit-style log entry for traceability." },
];

const NodePicker: React.FC<NodePickerProps> = ({ isOpen, onClose, onSelect, position }) => {
    const [hoveredInfo, setHoveredInfo] = useState<{text: string, x: number, y: number} | null>(null);

    if (!isOpen) return null;

    const style = position 
        ? { position: 'absolute' as const, left: position.x, top: position.y, transform: 'translate(20px, -50%)' }
        : {};

    const containerClasses = position
        ? "z-50 w-[300px] overflow-visible"
        : "fixed inset-0 z-50 flex items-center justify-center bg-[#040506]/50 backdrop-blur-sm";

    const content = (
        <m.div 
            initial={{ opacity: 0, scale: 0.95, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: -10 }}
            className="bg-[#111214] border border-white/[0.08] rounded-2xl shadow-2xl w-[420px] relative z-50" 
            onClick={e => e.stopPropagation()}
            style={position ? style : {}}
        >
            <div className="flex items-center justify-between p-3 border-b border-white/[0.08] bg-white/[0.02]">
                <span className="text-xs font-semibold text-white uppercase tracking-wider">Add Step</span>
                <button onClick={onClose} className="text-[#6a6b6c] hover:text-white transition-colors">
                    <LuX size={16} />
                </button>
            </div>
            
            <div className="p-3 grid grid-cols-2 gap-1.5 max-h-[360px] overflow-y-auto custom-scrollbar">
                {NODE_TYPES.map(t => (
                    <div key={t.kind} className="group relative flex items-center p-2 rounded-lg hover:bg-white/[0.03] transition-all">
                        <button
                            type="button"
                            aria-label={`Add ${t.label} Step`}
                            onClick={() => onSelect(t.kind)}
                            className="flex items-center gap-3 flex-1 text-left"
                        >
                            <div className="p-1.5 rounded-md bg-white/[0.05] group-hover:bg-white/[0.08] transition-colors text-[#9c9c9d]">
                                <t.icon className="size-4" />
                            </div>
                            <span className="text-sm font-medium text-[#9c9c9d] group-hover:text-white truncate transition-colors">{t.label}</span>
                        </button>

                        <div 
                            className="relative ml-1 p-1"
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredInfo({
                                    text: t.description,
                                    x: rect.left - 10,
                                    y: rect.top + (rect.height / 2)
                                });
                            }}
                            onMouseLeave={() => setHoveredInfo(null)}
                        >
                            <LuInfo className="size-3 text-[#6a6b6c] hover:text-white cursor-help transition-colors" />
                        </div>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {hoveredInfo && (
                    <m.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="fixed z-50 w-48 p-3 bg-[#1b1c1e] border border-white/[0.08] rounded-lg shadow-xl pointer-events-none"
                        style={{ 
                            left: hoveredInfo.x, 
                            top: hoveredInfo.y, 
                            transform: 'translate(-100%, -50%)'
                        }}
                    >
                         <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 size-3 bg-[#1b1c1e] border-r border-t border-white/[0.08] rotate-45 transform"></div>
                         <p className="text-xs text-[#9c9c9d] leading-relaxed">{hoveredInfo.text}</p>
                    </m.div>
                )}
            </AnimatePresence>
        </m.div>
    );

    return (
        <LazyMotion features={domAnimation}>
            <AnimatePresence>
                {position ? (
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-50">
                         <div className="pointer-events-auto">
                            {content}
                         </div>
                         <button type="button" aria-label="Close node picker" className="absolute inset-0 z-40" onClick={onClose} />
                    </div>
                ) : (
                    <div className={containerClasses}>
                        <button type="button" aria-label="Close node picker" className="absolute inset-0" onClick={onClose} />
                        {content}
                    </div>
                )}
            </AnimatePresence>
        </LazyMotion>
    );
};

export default NodePicker;
