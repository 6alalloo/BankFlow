import React, { useEffect, useState, useCallback } from 'react';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { LuX, LuTrash2, LuCheck } from 'react-icons/lu';
import { fetchDatabaseTables, type DatabaseTable } from '../../api/flows';
import type { NodeKind } from '../../types/nodeConfigs';
import { useNodeConfigDraft } from './useNodeConfigDraft';
import { BankingRuntimeConfigForm } from './BankingRuntimeConfigForms';
import { LegacyUtilityConfigForm } from './LegacyUtilityConfigForms';

// Node structure from the flow builder
interface FlowNode {
    id: number;
    name: string;
    kind: NodeKind;
    config: Record<string, unknown>;
}

type ConfigPanelProps = {
    isOpen: boolean;
    node: FlowNode | null;
    onClose: () => void;
    onUpdate: (id: number, update: { config?: Record<string, unknown>; name?: string }) => void;
    onDelete: (id: number) => void;
};

const bankingRuntimeNodeKinds = new Set<NodeKind>([
    'review',
    'data_capture',
    'document_collection',
    'approval_support',
    'decision_followup',
    'escalation_followup',
    'approval',
    'routing',
    'sla',
    'timer',
    'escalation',
    'status_update',
]);

const legacyUtilityNodeKinds = new Set<NodeKind>([
    'trigger',
    'email',
    'http',
    'database',
    'condition',
    'wait',
    'logger',
    'datetime',
    'variable',
]);

const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, node, onClose, onUpdate, onDelete }) => {
    const { localConfig, handleChange, saveNow } = useNodeConfigDraft(node, onUpdate);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [databaseTables, setDatabaseTables] = useState<DatabaseTable[]>([]);
    const firstInputRef = React.useRef<HTMLInputElement>(null);

    // Fetch database tables on mount
    useEffect(() => {
        fetchDatabaseTables()
            .then(setDatabaseTables)
            .catch(console.error);
    }, []);

    // Focus first input when panel opens
    useEffect(() => {
        if (isOpen && firstInputRef.current) {
            const timer = setTimeout(() => {
                firstInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Keyboard navigation handler
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showDeleteConfirm) {
                    setShowDeleteConfirm(false);
                } else {
                    onClose();
                }
                e.preventDefault();
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (node) {
                    onUpdate(node.id, { config: localConfig });
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (node) {
                    onUpdate(node.id, { config: localConfig });
                    onClose();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showDeleteConfirm, node, localConfig, onClose, onUpdate]);

    const handleSave = useCallback(() => {
        if (node) {
            saveNow();
            onClose();
        }
    }, [node, saveNow, onClose]);

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        if (node) {
            onDelete(node.id);
            onClose();
        }
        setShowDeleteConfirm(false);
    };

    if (!isOpen || !node) return null;

    // Render form based on node kind
    const renderForm = () => {
        if (bankingRuntimeNodeKinds.has(node.kind)) {
            return <BankingRuntimeConfigForm node={node} localConfig={localConfig} handleChange={handleChange} />;
        }

        if (legacyUtilityNodeKinds.has(node.kind)) {
            return <LegacyUtilityConfigForm node={node} localConfig={localConfig} databaseTables={databaseTables} handleChange={handleChange} />;
        }

        return (
            <div className="p-4 rounded-lg bg-raycast-surface-2 border border-white/10 text-zinc-300 text-sm">
                Configuration for <strong>{node.kind}</strong> is not yet available.
            </div>
        );
    };

    return (
        <>
            <LazyMotion features={domAnimation}>
            <m.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-4 top-4 bottom-4 w-[420px] bg-raycast-surface-1/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-raycast-ring z-40 flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-raycast-surface-2">
                    <div>
                        <h2 className="text-lg font-semibold text-white">{node.name || 'Configure Step'}</h2>
                        <span className="text-xs text-raycast-text-secondary uppercase tracking-wider font-semibold">{node.kind.replace('_', ' ')}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    >
                        <LuX className="size-5" />
                    </button>
                </div>

                {/* Content (Form) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    {/* Node-specific forms */}
                    {renderForm()}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-transparent space-y-2">
                    {/* Keyboard hints */}
                    <div className="flex justify-center gap-3 text-[9px] text-zinc-500 font-mono">
                        <span><kbd className="px-1 py-0.5 bg-raycast-surface-2 border border-white/10 rounded text-zinc-400 font-mono">Esc</kbd> Close</span>
                        <span><kbd className="px-1 py-0.5 bg-raycast-surface-2 border border-white/10 rounded text-zinc-400 font-mono">Ctrl+S</kbd> Save</span>
                        <span><kbd className="px-1 py-0.5 bg-raycast-surface-2 border border-white/10 rounded text-zinc-400 font-mono">Tab</kbd> Navigate</span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleDeleteClick}
                            className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-transparent border border-[#ff6363]/20 text-[#ff6363] hover:bg-[#ff6363]/10 transition-colors flex items-center justify-center gap-1.5"
                            tabIndex={0}
                        >
                            <LuTrash2 className="size-3.5" />
                            Delete
                        </button>

                        <button
                            onClick={handleSave}
                            className="flex-[2] px-3 py-2 rounded-lg text-xs font-semibold bg-[#e6e6e6] text-[#2f3031] hover:bg-white transition-all flex items-center justify-center gap-1.5"
                            tabIndex={0}
                        >
                            <LuCheck className="size-3.5" />
                            Done
                        </button>
                    </div>
                </div>
            </m.div>
            </LazyMotion>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-raycast-surface-1 border border-white/10 rounded-2xl p-6 w-[400px] shadow-raycast-highlight space-y-4">
                        <h3 className="text-xl font-semibold text-white">Delete Step?</h3>
                        <p className="text-zinc-300 text-sm">
                            Are you sure you want to delete this step? This action cannot be undone and will remove connected edges.
                        </p>
                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#ff6363]/10 border border-[#ff6363]/30 text-[#ff6363] hover:bg-[#ff6363]/20 transition-colors"
                            >
                                Delete Step
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ConfigPanel;
