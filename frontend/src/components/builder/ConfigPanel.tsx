import React, { useEffect, useState, useCallback, useEffectEvent } from 'react';
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

    const handlePanelKeyDown = useEffectEvent((e: KeyboardEvent) => {
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
    });

    // Keyboard navigation handler
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => handlePanelKeyDown(e);

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

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

    let formContent: React.ReactNode;
    if (bankingRuntimeNodeKinds.has(node.kind)) {
        formContent = <BankingRuntimeConfigForm node={node} localConfig={localConfig} handleChange={handleChange} />;
    } else if (legacyUtilityNodeKinds.has(node.kind)) {
        formContent = <LegacyUtilityConfigForm node={node} localConfig={localConfig} databaseTables={databaseTables} handleChange={handleChange} />;
    } else {
        formContent = (
            <div className="p-4 rounded-[10px] bg-[#f2f2f4] border border-[#0f1012]/[0.08] text-[#8f8f8f] text-sm">
                Configuration for <strong>{node.kind}</strong> is not yet available.
            </div>
        );
    }

    return (
        <>
            <LazyMotion features={domAnimation}>
            <m.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-4 top-4 bottom-4 w-[420px] bg-[#fdfdfd]/95 backdrop-blur-xl border border-[#0f1012]/[0.08] rounded-[10px] shadow-elevated z-40 flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[#0f1012]/[0.08] bg-[#f2f2f4]">
                    <div>
                        <h2 className="text-lg font-medium text-[#0f1012]">{node.name || 'Configure Step'}</h2>
                        <span className="text-xs text-[#8f8f8f] uppercase tracking-wider font-medium">{node.kind.replace('_', ' ')}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[#0f1012]/[0.05] rounded-[6px] text-[#868788] hover:text-[#0f1012] transition-colors"
                    >
                        <LuX className="size-5" />
                    </button>
                </div>

                {/* Content (Form) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    {/* Node-specific forms */}
                    {formContent}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[#0f1012]/[0.08] bg-transparent space-y-2">
                    {/* Keyboard hints */}
                    <div className="flex justify-center gap-3 text-[9px] text-[#868788] font-mono">
                        <span><kbd className="px-1 py-0.5 bg-[#f2f2f4] border border-[#0f1012]/[0.08] rounded-[4px] text-[#868788] font-mono">Esc</kbd> Close</span>
                        <span><kbd className="px-1 py-0.5 bg-[#f2f2f4] border border-[#0f1012]/[0.08] rounded-[4px] text-[#868788] font-mono">Ctrl+S</kbd> Save</span>
                        <span><kbd className="px-1 py-0.5 bg-[#f2f2f4] border border-[#0f1012]/[0.08] rounded-[4px] text-[#868788] font-mono">Tab</kbd> Navigate</span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleDeleteClick}
                            className="flex-1 px-3 py-2 rounded-[10px] text-xs font-normal bg-transparent border border-[#b71c1c]/20 text-[#b71c1c] hover:bg-[#ffebee] transition-colors flex items-center justify-center gap-1.5"
                            tabIndex={0}
                        >
                            <LuTrash2 className="size-3.5" />
                            Delete
                        </button>

                        <button
                            onClick={handleSave}
                            className="flex-[2] px-3 py-2 rounded-[10px] text-xs font-medium bg-[#0f1012] text-white hover:bg-[#020201] transition-all flex items-center justify-center gap-1.5"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1012]/20 backdrop-blur-sm">
                    <div className="bg-[#fdfdfd] border border-[#0f1012]/[0.08] rounded-[10px] p-6 w-[400px] shadow-elevated space-y-4">
                        <h3 className="text-xl font-medium text-[#0f1012]">Delete Step?</h3>
                        <p className="text-[#8f8f8f] text-sm">
                            Are you sure you want to delete this step? This action cannot be undone and will remove connected edges.
                        </p>
                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded-[10px] text-sm font-normal text-[#8f8f8f] hover:text-[#0f1012] hover:bg-[#0f1012]/[0.05] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-[10px] text-sm font-medium bg-[#ffebee] border border-[#b71c1c]/20 text-[#b71c1c] hover:bg-[#ffebee]/80 transition-colors"
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
