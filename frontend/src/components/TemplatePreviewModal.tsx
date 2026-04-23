
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuX, LuArrowRight, LuCircleCheck, LuGlobe, LuMail, LuDatabase, LuSplit, LuClock, LuTerminal, LuBox, LuCalendar, LuZap } from 'react-icons/lu';
import type { WorkflowTemplate } from '../data/templates';

interface TemplatePreviewModalProps {
    isOpen: boolean;
    template: WorkflowTemplate | null;
    onClose: () => void;
    onUseTemplate: (template: WorkflowTemplate) => void;
}

// Icon mapping for node kinds
const nodeIcons: Record<string, React.ElementType> = {
    trigger: LuZap,
    email: LuMail,
    http: LuGlobe,
    condition: LuSplit,
    database: LuDatabase,
    variable: LuBox,
    wait: LuClock,
    datetime: LuCalendar,
    logger: LuTerminal,
};

// Color mapping for node kinds
const nodeColors: Record<string, string> = {
    trigger: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    email: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    http: 'text-green-400 bg-green-400/10 border-green-400/20',
    condition: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    database: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    variable: 'text-teal-400 bg-teal-400/10 border-teal-400/20',
    wait: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    datetime: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    logger: 'text-slate-300 bg-slate-400/10 border-slate-400/20',
};

const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
    isOpen,
    template,
    onClose,
    onUseTemplate,
}) => {
    if (!isOpen || !template) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-navy-900 border border-white/10 rounded-2xl w-[700px] max-h-[85vh] shadow-2xl flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                        <div>
                            <span className={`text-xs font-bold uppercase tracking-wider ${
                                template.category === 'general' ? 'text-cyan-400' : 'text-slate-400'
                            }`}>
                                Case Flow Template
                            </span>
                            <h2 className="text-xl font-bold text-white mt-1">{template.name}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <LuX className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {/* Description */}
                        <div>
                            <p className="text-slate-300 text-sm leading-relaxed">{template.description}</p>
                        </div>

                        {/* Use Case */}
                        <div className="p-4 rounded-xl bg-cyan-glow/5 border border-cyan-glow/20">
                            <h3 className="text-sm font-bold text-cyan-glow mb-2">When to Use</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">{template.useCase}</p>
                        </div>

                        {/* Workflow Preview */}
                        <div>
                            <h3 className="text-sm font-bold text-white mb-3">Workflow Steps</h3>
                            <div className="space-y-2">
                                {template.nodes.map((node, index) => {
                                    const Icon = nodeIcons[node.kind] || LuBox;
                                    const colors = nodeColors[node.kind] || 'text-slate-400 bg-slate-400/10 border-slate-400/20';
                                    const isLast = index === template.nodes.length - 1;

                                    return (
                                        <div key={node.id} className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg border ${colors}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-sm font-medium text-white">{node.name}</span>
                                                <span className="text-xs text-slate-500 ml-2">({node.kind})</span>
                                            </div>
                                            {!isLast && (
                                                <LuArrowRight className="w-4 h-4 text-slate-500" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Required Configuration */}
                        <div>
                            <h3 className="text-sm font-bold text-white mb-3">Required Configuration</h3>
                            <ul className="space-y-2">
                                {template.requiredConfig.map((item, index) => (
                                    <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                                        <LuCircleCheck className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Node Count Summary */}
                        <div className="flex gap-4 text-xs text-slate-400">
                            <span>{template.nodes.length} nodes</span>
                            <span>{template.edges.length} connections</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/10 bg-transparent flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onUseTemplate(template)}
                            className="px-5 py-2.5 rounded-lg text-sm font-bold bg-cyan-glow text-navy-950 hover:bg-white hover:scale-[1.02] transition-all shadow-glow-sm flex items-center gap-2"
                        >
                            Use This Template
                            <LuArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default TemplatePreviewModal;
