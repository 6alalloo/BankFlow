import React from 'react';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { LuX, LuArrowRight, LuCircleCheck, LuGlobe, LuMail, LuDatabase, LuSplit, LuClock, LuTerminal, LuBox, LuCalendar, LuZap } from 'react-icons/lu';
import type { FlowTemplate } from '../data/templates';

interface TemplatePreviewModalProps {
    isOpen: boolean;
    template: FlowTemplate | null;
    onClose: () => void;
    onUseTemplate: (template: FlowTemplate) => void;
}

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

const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
    isOpen,
    template,
    onClose,
    onUseTemplate,
}) => {
    if (!isOpen || !template) return null;

    return (
        <LazyMotion features={domAnimation}>
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040506]/60 backdrop-blur-sm">
                <m.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#111214] border border-white/[0.08] rounded-2xl w-[700px] max-h-[85vh] shadow-2xl flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/[0.08] bg-white/[0.02]">
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#9c9c9d]">
                                Case Flow Template
                            </span>
                            <h2 className="text-xl font-semibold text-white mt-1">{template.name}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/[0.05] rounded-lg text-[#6a6b6c] hover:text-white transition-colors"
                        >
                            <LuX className="size-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        <div>
                            <p className="text-[#9c9c9d] text-sm leading-relaxed">{template.description}</p>
                        </div>

                        <div className="p-4 rounded-xl bg-[#07080a] border border-white/[0.08]">
                            <h3 className="text-sm font-semibold text-white mb-2">When to Use</h3>
                            <p className="text-sm text-[#9c9c9d] leading-relaxed">{template.useCase}</p>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-white mb-3">Flow Steps</h3>
                            <div className="space-y-2">
                                {template.nodes.map((node, index) => {
                                    const Icon = nodeIcons[node.kind] || LuBox;
                                    const isLast = index === template.nodes.length - 1;

                                    return (
                                        <div key={node.id} className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg border border-white/[0.08] bg-[#07080a] text-[#9c9c9d]">
                                                <Icon className="size-4" />
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-sm font-medium text-white">{node.name}</span>
                                                <span className="text-xs text-[#6a6b6c] ml-2">({node.kind})</span>
                                            </div>
                                            {!isLast && (
                                                <LuArrowRight className="size-4 text-[#6a6b6c]" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-white mb-3">Required Configuration</h3>
                            <ul className="space-y-2">
                                {template.requiredConfig.map((item) => (
                                    <li key={item} className="flex items-start gap-2 text-sm text-[#9c9c9d]">
                                        <LuCircleCheck className="size-4 text-[#59d499] mt-0.5 flex-shrink-0" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex gap-4 text-xs text-[#6a6b6c]">
                            <span>{template.nodes.length} nodes</span>
                            <span>{template.edges.length} connections</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/[0.08] bg-transparent flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-lg text-sm font-medium text-[#9c9c9d] hover:text-white hover:bg-white/[0.05] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onUseTemplate(template)}
                            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#e6e6e6] text-[#2f3031] hover:bg-white hover:scale-[1.02] transition-all flex items-center gap-2"
                        >
                            Use This Template
                            <LuArrowRight className="size-4" />
                        </button>
                    </div>
                </m.div>
            </div>
        </AnimatePresence>
        </LazyMotion>
    );
};

export default TemplatePreviewModal;
