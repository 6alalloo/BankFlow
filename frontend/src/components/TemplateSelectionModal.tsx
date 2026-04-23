import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuX, LuArrowRight, LuBriefcaseBusiness, LuZap, LuMail, LuDatabase, LuClock, LuTerminal, LuGlobe, LuSplit, LuBox } from 'react-icons/lu';
import { templates, type WorkflowTemplate } from '../data/templates';

interface TemplateSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: WorkflowTemplate) => void;
    isCreating?: boolean;
}

// Category icons and colors
const categoryConfig = {
    general: { icon: LuBriefcaseBusiness, color: 'text-cyan-400', bgColor: 'bg-cyan-400/10', borderColor: 'border-cyan-400/30' },
};

// Node kind icons
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

    const handleSelect = (template: WorkflowTemplate) => {
        setSelectedId(template.id);
        onSelectTemplate(template);
    };

    return (
        <AnimatePresence>
            <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-navy-900 border border-white/10 rounded-2xl w-[800px] max-h-[85vh] shadow-2xl flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-cyan-950/30 to-transparent">
                        <div>
                            <h2 className="text-xl font-bold text-white">Choose a Template</h2>
                            <p className="text-sm text-slate-400 mt-1">Start with a case-flow starter instead of a blank canvas</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <LuX className="w-5 h-5" />
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
                                    <motion.div
                                        key={template.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`relative p-5 rounded-xl border cursor-pointer transition-all duration-300 group shadow-sm ${
                                            isSelected
                                                ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.2)]'
                                                : `border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 hover:shadow-[0_0_24px_rgba(15,23,42,0.6)] hover:-translate-y-0.5`
                                        }`}
                                        onClick={() => !isCreating && handleSelect(template)}
                                    >
                                        {/* Loading Overlay */}
                                        {isLoading && (
                                            <div className="absolute inset-0 bg-navy-900/80 rounded-xl flex items-center justify-center z-10">
                                                <div className="flex items-center gap-3 text-cyan-400">
                                                    <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-sm font-medium">Creating workflow...</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Category Badge */}
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${config.bgColor} ${config.color} ${config.borderColor} border mb-3`}>
                                            <CategoryIcon className="w-3 h-3" />
                                            {template.category}
                                        </div>

                                        {/* Template Name */}
                                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                                            {template.name}
                                        </h3>

                                        {/* Description */}
                                        <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                                            {template.description}
                                        </p>

                                        {/* Node Preview */}
                                        <div className="flex items-center gap-1.5 mb-4">
                                            {template.nodes.slice(0, 5).map((node, idx) => {
                                                const NodeIcon = nodeIcons[node.kind] || LuBox;
                                                return (
                                                    <div
                                                        key={idx}
                                                        className="w-7 h-7 rounded-lg bg-navy-950 border border-white/10 flex items-center justify-center"
                                                        title={node.name}
                                                    >
                                                        <NodeIcon className="w-3.5 h-3.5 text-slate-400" />
                                                    </div>
                                                );
                                            })}
                                            {template.nodes.length > 5 && (
                                                <div className="w-7 h-7 rounded-lg bg-navy-950 border border-white/10 flex items-center justify-center text-xs text-slate-500">
                                                    +{template.nodes.length - 5}
                                                </div>
                                            )}
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-500">
                                                {template.nodes.length} nodes • {template.edges.length} connections
                                            </span>
                                            <div className={`flex items-center gap-1 text-sm font-medium transition-all ${
                                                isSelected ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'
                                            }`}>
                                                Use Template
                                                <LuArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-white/10 bg-navy-950/50 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            Templates provide a starting point. You can customize after creation.
                        </p>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default TemplateSelectionModal;
