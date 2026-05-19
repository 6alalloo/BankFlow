import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchFlows,
  createFlow,
  deleteFlow,
  duplicateFlow,
} from "../../api/flows";
import type { FlowApi } from "../../api/flows";
import FlowSplitLayout from "./FlowSplitLayout";

// Custom Delete Modal
type DeleteModalProps = {
    flow: FlowApi | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
};

const DeleteConfirmationModal: React.FC<DeleteModalProps> = ({ flow, isOpen, onClose, onConfirm, isDeleting }) => {
    if (!isOpen || !flow) return null;

    return (
        <>
            <button type="button" aria-label="Close delete confirmation" className="fixed inset-0 bg-[#0f1012]/20 backdrop-blur-sm z-40" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm">
                <div className="bg-[#fdfdfd] border border-[#0f1012]/[0.08] rounded-[10px] shadow-elevated overflow-hidden p-6">
                    <h3 className="text-lg font-medium text-[#0f1012] mb-2">Delete Flow?</h3>
                    <p className="text-[#8f8f8f] text-sm mb-6 leading-relaxed">
                        Are you sure you want to delete <span className="text-[#0f1012] font-medium">{flow.name}</span>? This action cannot be undone.
                    </p>
                        
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            disabled={isDeleting}
                            className="px-4 py-2 text-[#868788] hover:text-[#0f1012] text-sm font-normal transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-[#b71c1c] hover:bg-[#b71c1c]/90 text-white text-sm font-medium rounded-[10px] flex items-center gap-2 transition-all"
                        >
                            {isDeleting ? "Deleting?" : "Delete Flow"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

/** ---------- Main page component ---------- **/

const FlowsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [flows, setFlows] = useState<FlowApi[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Delete Modal State
  const [flowToDelete, setFlowToDelete] = useState<FlowApi | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create State
  const [isCreating, setIsCreating] = useState(false);

  // Duplicate State
  const isDuplicatingRef = useRef(false);

  // Load Flows
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const apiFlows = await fetchFlows();
        setFlows(apiFlows);
      } catch (err) {
        console.error("[Flows] Failed to load flows", err);
        setLoadError("Failed to load flows. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  // Handlers
  const handleCreateFlow = async () => {
    try {
      setIsCreating(true);
      const created = await createFlow({
        name: "New Flow",
        description: "Empty flow. Add nodes to build your case flow.",
        isActive: false, // Default to inactive/draft
      });
      // Add to list and navigate
      setFlows((prev) => [created, ...prev]);
      navigate(`/flows/${created.id}/builder`);
    } catch (err) {
        alert("Failed to create flow. See console.");
        console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRequest = (wf: FlowApi) => {
      setFlowToDelete(wf);
      setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
      if (!flowToDelete) return;
      try {
          setIsDeleting(true);
          await deleteFlow(flowToDelete.id);
          // Remove from list
          setFlows(prev => prev.filter(w => w.id !== flowToDelete.id));
          setIsDeleteModalOpen(false);
          setFlowToDelete(null);
      } catch (err) {
          console.error("Failed to delete flow", err);
          alert("Failed to delete flow");
      } finally {
          setIsDeleting(false);
      }
  };

  const handleDuplicate = async (wf: FlowApi) => {
      try {
          isDuplicatingRef.current = true;
          const duplicated = await duplicateFlow(wf.id);
          // Add to list and navigate to builder
          setFlows((prev) => [duplicated, ...prev]);
          navigate(`/flows/${duplicated.id}/builder`);
      } catch (err) {
          console.error("Failed to duplicate flow", err);
          alert("Failed to duplicate flow. See console for details.");
      } finally {
          isDuplicatingRef.current = false;
      }
  };

  const handleFlowUpdated = (updated: FlowApi) => {
      setFlows((prev) => prev.map((flow) => flow.id === updated.id ? updated : flow));
  };

  return (
    <>
        <FlowSplitLayout
            flows={flows}
            isLoading={isLoading}
            isCreating={isCreating}
            error={loadError}
            onCreate={handleCreateFlow}
            onDelete={handleDeleteRequest}
            onDuplicate={handleDuplicate}
            onFlowUpdated={handleFlowUpdated}
        />

        <DeleteConfirmationModal 
            flow={flowToDelete}
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleConfirmDelete}
            isDeleting={isDeleting}
        />
    </>
  );
};

export default FlowsListPage;
