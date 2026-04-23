import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkflowApi } from '../../api/workflows';
import { createWorkflow, createWorkflowNode, createWorkflowEdge } from '../../api/workflows';
import WorkflowListSidebar from './components/WorkflowListSidebar';
import WorkflowDetailPanel from './components/WorkflowDetailPanel';
import TemplateSelectionModal from '../../components/TemplateSelectionModal';
import type { WorkflowTemplate } from '../../data/templates';

type WorkflowSplitLayoutProps = {
    workflows: WorkflowApi[];
    isLoading: boolean;
    isCreating: boolean;
    error: string | null;
    onCreate: () => void;
    onRun: (wf: WorkflowApi) => void;
    onDelete: (wf: WorkflowApi) => void;
    onDuplicate?: (wf: WorkflowApi) => void;
};

const WorkflowSplitLayout: React.FC<WorkflowSplitLayoutProps> = ({
    workflows,
    isLoading,
    isCreating,
    error,
    onCreate,
    onRun,
    onDelete,
    onDuplicate
}) => {
    const navigate = useNavigate();
    
    // UI State
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    
    // Template Modal State
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);
    
    // Track initialization
    const initializedRef = React.useRef(false);

    // Auto-select first workflow if none selected and workflows exist
    useEffect(() => {
        if (!initializedRef.current && workflows.length > 0) {
            // Use setTimeout to avoid synchronous state update warning during effect
            setTimeout(() => {
                 setSelectedId(workflows[0].id);
            }, 0);
            initializedRef.current = true;
        }
    }, [workflows]);

    // Derived State: Selected Workflow
    const selectedWorkflow = useMemo(() => 
        workflows.find(w => w.id === selectedId) || null
    , [workflows, selectedId]);

    // Handler for creating workflow from template
    const handleUseTemplate = async (template: WorkflowTemplate) => {
        try {
            setIsCreatingFromTemplate(true);

            // Create new workflow with template name
            const newWorkflow = await createWorkflow({ name: template.name });
            const workflowId = newWorkflow.id;

            // Create a mapping of template node IDs to actual node IDs
            const nodeIdMap: Record<string, number> = {};

            // Add nodes from template
            for (const templateNode of template.nodes) {
                const nodeResponse = await createWorkflowNode(workflowId, {
                    kind: templateNode.kind,
                    name: templateNode.name,
                    posX: templateNode.pos_x,
                    posY: templateNode.pos_y,
                    config: templateNode.config,
                });
                nodeIdMap[templateNode.id] = nodeResponse.id;
            }

            // Add edges from template
            for (const templateEdge of template.edges) {
                const fromNodeId = nodeIdMap[templateEdge.from];
                const toNodeId = nodeIdMap[templateEdge.to];

                if (fromNodeId && toNodeId) {
                    await createWorkflowEdge(workflowId, {
                        fromNodeId: fromNodeId,
                        toNodeId: toNodeId,
                        label: templateEdge.label || undefined,
                        condition: templateEdge.condition || undefined,
                    });
                }
            }

            setIsTemplateModalOpen(false);
            navigate(`/workflows/${workflowId}/builder`);
        } catch (error) {
            console.error("Failed to create workflow from template", error);
            const message = error instanceof Error ? error.message : "Failed to create workflow from template";
            alert(message);
        } finally {
            setIsCreatingFromTemplate(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500">
                <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full mr-3"/>
                Loading workflows...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full text-rose-500">
                Error: {error}
            </div>
        );
    }

    return (
        <>
            <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-navy-950 text-slate-200">
                {/* Left Pane: Sidebar List */}
                <div className="w-[600px] flex-shrink-0 h-full">
                    <WorkflowListSidebar 
                        workflows={workflows}
                        activeWorkflowId={selectedId}
                        onSelect={setSelectedId}
                        onCreate={onCreate}
                        onOpenTemplates={() => setIsTemplateModalOpen(true)}
                        isCreating={isCreating}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        filterStatus={filterStatus}
                        onFilterChange={setFilterStatus}
                    />
                </div>

                {/* Right Pane: Details */}
                <div className="flex-1 h-full min-w-0">
                    <WorkflowDetailPanel
                        workflow={selectedWorkflow}
                        onRun={onRun}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                    />
                </div>
            </div>

            {/* Template Selection Modal */}
            <TemplateSelectionModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onSelectTemplate={handleUseTemplate}
                isCreating={isCreatingFromTemplate}
            />
        </>
    );
};

export default WorkflowSplitLayout;

