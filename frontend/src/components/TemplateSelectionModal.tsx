import React, { useState } from 'react';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { LuX, LuArrowRight, LuBriefcaseBusiness, LuZap, LuMail, LuDatabase, LuClock, LuTerminal, LuGlobe, LuSplit, LuBox } from 'react-icons/lu';
import { templates, type FlowTemplate } from '../data/templates';

interface TemplateSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: FlowTemplate) => void;
    isCreating?: boolean;
}

const categoryConfig = {
    general: { icon: LuBriefcaseBusiness },
};

const nodeIcons: Record<string, React.ElementType> = {
    trigger: LuZap,
    email: LuMail,
    http: LuGlobe,
    condition: LuSplit,
    database: LuDatabase,
    variable: LuBox,
    wait: LuClock,
    logger: LuTerminal,
};

const TemplateSelectionModal: React.FC<TemplateSelectionModalProps> = ({
    isOpen,
    onClose,
    onSelectTemplate,
    isCreating = false,
}) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSelect = (template: FlowTemplate) => {
        setSelectedId(template.id);
        onSelectTemplate(template);
    };

    return (
        <LazyMotion features={domAnimation}>
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1012]/20 backdrop-blur-sm">
                <button type="button" aria-label="Close template chooser" className="absolute inset-0" onClick={onClose} />
                <m.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-[#fdfdfd] border border-[#0f1012]/[0.08] rounded-[10px] w-[800px] max-h-[85vh] shadow-elevated flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-[#0f1012]/[0.08] bg-[#0f1012]/[0.02]">
                        <div>
                            <h2 className="text-xl font-medium text-[#0f1012]">Choose a Template</h2>
                            <p className="text-sm text-[#8f8f8f] mt-1">Start with a case-flow starter instead of a blank canvas</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[#0f1012]/[0.05] rounded-[6px] text-[#868788] hover:text-[#0f1012] transition-colors"
                        >
                            <LuX className="size-5" />
                        </button>
                    </div>

                    {/* Template Grid */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <div className="grid grid-cols-2 gap-4">
                            {templates.map((template) => {
                                const config = categoryConfig[template.category];
                                const CategoryIcon = config.icon;
                                const isSelected = selectedId === template.id;
                                const isLoading = isCreating && isSelected;

                                return (
                                    <m.div
                                        key={template.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`relative p-5 rounded-[10px] border cursor-pointer transition-all duration-300 group ${
                                            isSelected
                                                ? 'border-[#0f1012]/[0.18] bg-[#f2f2f4] shadow-card'
                                                : 'border-[#0f1012]/[0.08] bg-[#0f1012]/[0.02] hover:border-[#0f1012]/[0.14] hover:bg-[#0f1012]/[0.04]'
                                        }`}
                                        onClick={() => !isCreating && handleSelect(template)}
                                    >
                                        {isLoading && (
                                            <div className="absolute inset-0 bg-[#f2f2f4]/90 rounded-[10px] flex items-center justify-center z-10">
                                                <div className="flex items-center gap-3 text-[#0f1012]">
                                                    <div className="size-5 border-2 border-[#0f1012]/30 border-t-[#0f1012] rounded-full animate-spin" />
                                                    <span className="text-sm font-medium">Creating flow&hellip;</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium uppercase tracking-wider bg-[#f2f2f4] text-[#8f8f8f] border border-[#0f1012]/[0.08] mb-3">
                                            <CategoryIcon className="size-3" />
                                            {template.category}
                                        </div>

                                        <h3 className="text-lg font-medium text-[#0f1012] mb-2">
                                            {template.name}
                                        </h3>

                                        <p className="text-sm text-[#8f8f8f] mb-4 line-clamp-2">
                                            {template.description}
                                        </p>

                                        <div className="flex items-center gap-1.5 mb-4">
                                            {template.nodes.slice(0, 5).map((node) => {
                                                const NodeIcon = nodeIcons[node.kind] || LuBox;
                                                return (
                                                    <div
                                                        key={`${template.id}-${node.id}`}
                                                        className="size-7 rounded-[6px] bg-[#f2f2f4] border border-[#0f1012]/[0.08] flex items-center justify-center"
                                                        title={node.name}
                                                    >
                                                        <NodeIcon className="size-3.5 text-[#868788]" />
                                                    </div>
                                                );
                                            })}
                                            {template.nodes.length > 5 && (
                                                <div className="size-7 rounded-[6px] bg-[#f2f2f4] border border-[#0f1012]/[0.08] flex items-center justify-center text-xs text-[#868788]">
                                                    +{template.nodes.length - 5}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-[#868788]">
                                                {template.nodes.length} nodes &bull; {template.edges.length} connections
                                            </span>
                                            <div className={`flex items-center gap-1 text-sm font-medium transition-all ${
                                                isSelected ? 'text-[#0f1012]' : 'text-[#868788] group-hover:text-[#0f1012]'
                                            }`}>
                                                Use Template
                                                <LuArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                                            </div>
                                        </div>
                                    </m.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-[#0f1012]/[0.08] bg-[#0f1012]/[0.02] flex items-center justify-between">
                        <p className="text-xs text-[#868788]">
                            Templates provide a starting point. You can customize after creation.
                        </p>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-[10px] text-sm font-normal text-[#8f8f8f] hover:text-[#0f1012] hover:bg-[#0f1012]/[0.05] transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </m.div>
            </div>
        </AnimatePresence>
        </LazyMotion>
    );
};

export default TemplateSelectionModal;
