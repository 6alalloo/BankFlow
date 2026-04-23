import React, { useState } from 'react';
import {
    LuMail, LuGlobe, LuSplit, LuDatabase, LuClock, LuX, LuZap, LuInfo, LuTerminal, LuCalendar, LuBox
} from 'react-icons/lu';
import { motion, AnimatePresence } from 'framer-motion';

type NodePickerProps = {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (kind: string) => void;
    position?: { x: number; y: number } | null;
};

const NODE_TYPES = [
    { kind: 'trigger', label: 'Trigger', icon: LuZap, color: 'text-yellow-400', description: "Starts the flow. Configure your case intake values here." },
    { kind: 'email', label: 'Send Email', icon: LuMail, color: 'text-blue-400', description: "Sends an email notification to a recipient." },
    { kind: 'http', label: 'HTTP Request', icon: LuGlobe, color: 'text-green-400', description: "Makes an external API call (GET, POST, etc)." },
    { kind: 'condition', label: 'Condition', icon: LuSplit, color: 'text-purple-400', description: "Branches flow based on logic (If/Else)." },
    { kind: 'database', label: 'Database', icon: LuDatabase, color: 'text-rose-400', description: "Creates, updates, or looks up a case record." },
    { kind: 'variable', label: 'Set Variable', icon: LuBox, color: 'text-teal-400', description: "Store and manipulate data for use in later steps." },
    { kind: 'wait', label: 'Delay / Wait', icon: LuClock, color: 'text-amber-400', description: "Pauses the workflow for a set duration." },
    { kind: 'datetime', label: 'Date / Time', icon: LuCalendar, color: 'text-orange-400', description: "Format, calculate, or get current date/time." },
    { kind: 'logger', label: 'Logger', icon: LuTerminal, color: 'text-slate-300', description: "Writes an audit-style log entry for traceability." },
];

const NodePicker: React.FC<NodePickerProps> = ({ isOpen, onClose, onSelect, position }) => {
    const [hoveredInfo, setHoveredInfo] = useState<{text: string, x: number, y: number} | null>(null);

    if (!isOpen) return null;

    // Default to center if no position provided
    const style = position 
        ? { position: 'absolute' as const, left: position.x, top: position.y, transform: 'translate(20px, -50%)' }
        : {};

    const containerClasses = position
        ? "z-50 w-[300px] overflow-visible" // overflow-visible needed for tooltip
        : "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm";

    const content = (
        <motion.div 
            initial={{ opacity: 0, scale: 0.9, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: -10 }}
            className="bg-navy-900 border border-white/10 rounded-2xl shadow-2xl w-[460px] relative z-50" 
            onClick={e => e.stopPropagation()}
            style={position ? style : {}}
        >
            <div className="flex items-center justify-between p-3 border-b border-white/5 bg-white/5">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Add Step</span>
                <button onClick={onClose} className="text-slate-400 hover:text-white">
                    <LuX />
                </button>
            </div>
            
            <div className="p-3 grid grid-cols-2 gap-2 max-h-[360px] overflow-y-auto custom-scrollbar">
                {NODE_TYPES.map(t => (
                    <div key={t.kind} className="group relative flex items-center p-2.5 rounded-lg hover:bg-white/5 transition-all">
                        {/* Main Button Area */}
                        <button
                            onClick={() => onSelect(t.kind)}
                            className="flex items-center gap-3 flex-1 text-left"
                        >
                            <div className={`p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors ${t.color}`}>
                                <t.icon className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-medium text-slate-200 group-hover:text-white truncate">{t.label}</span>
                        </button>

                        {/* Info Icon & Tooltip Trigger */}
                        <div 
                            className="relative ml-1.5 p-1"
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredInfo({
                                    text: t.description,
                                    x: rect.left - 10, // Show to left
                                    y: rect.top + (rect.height / 2)
                                });
                            }}
                            onMouseLeave={() => setHoveredInfo(null)}
                        >
                            <LuInfo className="w-3.5 h-3.5 text-slate-500 hover:text-blue-400 cursor-help" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Portal-like Tooltip (Fixed Position) */}
            <AnimatePresence>
                {hoveredInfo && (
                    <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="fixed z-[100] w-48 p-3 bg-slate-800 border border-white/10 rounded-lg shadow-xl pointer-events-none"
                        style={{ 
                            left: hoveredInfo.x, 
                            top: hoveredInfo.y, 
                            transform: 'translate(-100%, -50%)' // Center vertically, move left
                        }}
                    >
                         {/* Arrow */}
                         <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-slate-800 border-r border-t border-white/10 rotate-45 transform"></div>
                         <p className="text-xs text-slate-300 leading-relaxed">{hoveredInfo.text}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );

    return (
        <AnimatePresence>
            {position ? (
                // Wrapper for positioning context, handling clicks, etc.
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-[60]">
                     <div className="pointer-events-auto">
                        {content}
                     </div>
                     {/* Backdrop to close on click outside */}
                     <div className="absolute inset-0 z-40" onClick={onClose} />
                </div>
            ) : (
                // Modal Mode
                <div className={containerClasses} onClick={onClose}>
                    {content}
                </div>
            )}
        </AnimatePresence>
    );
};

export default NodePicker;
