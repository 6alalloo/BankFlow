import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FlowApi } from '../../api/flows';
import { createFlow, createFlowNode, createFlowEdge } from '../../api/flows';
import FlowListSidebar from './components/FlowListSidebar';
import FlowDetailPanel from './components/FlowDetailPanel';
import TemplateSelectionModal from '../../components/TemplateSelectionModal';
import type { FlowTemplate } from '../../data/templates';

type FlowSplitLayoutProps = {
    flows: FlowApi[];
    isLoading: boolean;
    isCreating: boolean;
    error: string | null;
    onCreate: () => void;
    onDelete: (wf: FlowApi) => void;
    onDuplicate?: (wf: FlowApi) => void;
    onFlowUpdated?: (wf: FlowApi) => void;
};

const FlowSplitLayout: React.FC<FlowSplitLayoutProps> = ({
    flows,
    isLoading,
    isCreating,
    error,
    onCreate,
    onDelete,
    onDuplicate,
    onFlowUpdated
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

    // Auto-select first flow if none selected and flows exist
    useEffect(() => {
        if (!initializedRef.current && flows.length > 0) {
            // Use setTimeout to avoid synchronous state update warning during effect
            const timer = setTimeout(() => {
                 setSelectedId(flows[0].id);
            }, 0);
            initializedRef.current = true;
            return () => clearTimeout(timer);
        }
    }, [flows]);

    // Derived State: Selected Flow
    const selectedFlow = useMemo(() => 
        flows.find(w => w.id === selectedId) || null
    , [flows, selectedId]);

    // Handler for creating flow from template
    const handleUseTemplate = async (template: FlowTemplate) => {
        try {
            setIsCreatingFromTemplate(true);

            // Create new flow with template name
            const newFlow = await createFlow({ name: template.name });
            const flowId = newFlow.id;

            // Create a mapping of template node IDs to actual node IDs
            const nodeIdMap: Record<string, number> = {};

            // Add nodes from template
            await Promise.all(template.nodes.map(async (templateNode) => {
                const nodeResponse = await createFlowNode(flowId, {
                    kind: templateNode.kind,
                    name: templateNode.name,
                    posX: templateNode.pos_x,
                    posY: templateNode.pos_y,
                    config: templateNode.config,
                });
                nodeIdMap[templateNode.id] = nodeResponse.id;
            }));

            // Add edges from template
            await Promise.all(template.edges.map(async (templateEdge) => {
                const fromNodeId = nodeIdMap[templateEdge.from];
                const toNodeId = nodeIdMap[templateEdge.to];

                if (fromNodeId && toNodeId) {
                    await createFlowEdge(flowId, {
                        fromNodeId: fromNodeId,
                        toNodeId: toNodeId,
                        label: templateEdge.label || undefined,
                        condition: templateEdge.condition || undefined,
                    });
                }
            }));

            setIsTemplateModalOpen(false);
            navigate(`/flows/${flowId}/builder`);
        } catch (error) {
            console.error("Failed to create flow from template", error);
            const message = error instanceof Error ? error.message : "Failed to create flow from template";
            alert(message);
        } finally {
            setIsCreatingFromTemplate(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-zinc-500">
                <div className="animate-spin size-6 border-2 border-cyan-500 border-t-transparent rounded-full mr-3"/>
                Loading flows?
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
            <div className="flex flex-col 2xl:flex-row h-[calc(100vh-64px)] overflow-auto 2xl:overflow-hidden bg-navy-950 text-zinc-200">
                {/* Left Pane: Sidebar List */}
                <div className="w-full 2xl:w-[520px] flex-shrink-0 h-[360px] 2xl:h-full">
                    <FlowListSidebar 
                        flows={flows}
                        activeFlowId={selectedId}
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
                <div className="flex-1 h-[calc(100vh-424px)] min-h-[640px] 2xl:h-full min-w-0">
                    <FlowDetailPanel
                        flow={selectedFlow}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                        onFlowUpdated={onFlowUpdated}
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

export default FlowSplitLayout;

