import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlay } from "react-icons/fi";
import {
  fetchWorkflows,
  executeWorkflow,
  createWorkflow,
  deleteWorkflow,
  duplicateWorkflow,
} from "../../api/workflows";
import type { WorkflowApi } from "../../api/workflows";
import WorkflowSplitLayout from "./WorkflowSplitLayout";

type CaseRunFormData = {
  name: string;
  email: string;
  department: string;
  role: string;
  startDate: string;
  managerEmail: string;
};

const EMPTY_FORM: CaseRunFormData = {
  name: "",
  email: "",
  department: "",
  role: "",
  startDate: "",
  managerEmail: "",
};

const SAMPLE_DATA: CaseRunFormData = {
  name: "Case-AML-1042",
  email: "alerts@bankflow.local",
  department: "Financial Crime Operations",
  role: "AML Alert Review",
  startDate: new Date().toISOString().split('T')[0],
  managerEmail: "supervisor@bankflow.local",
};

// Input field component - defined OUTSIDE of render
const FormInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder: string;
}> = ({ label, value, onChange, type = "text", placeholder }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">{label}</label>
    <input
      type={type}
      className="w-full bg-black/30 text-sm text-white border border-white/10 rounded-lg px-3 py-2 focus:border-cyan-500/50 focus:outline-none transition-all placeholder:text-slate-600"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

// Custom Delete Modal
type DeleteModalProps = {
    workflow: WorkflowApi | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
};

const DeleteConfirmationModal: React.FC<DeleteModalProps> = ({ workflow, isOpen, onClose, onConfirm, isDeleting }) => {
    if (!isOpen || !workflow) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1060]" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1070] w-full max-w-sm">
                <div className="bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl overflow-hidden p-6">
                    <h3 className="text-lg font-bold text-white mb-2">Delete Workflow?</h3>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        Are you sure you want to delete <span className="text-white font-medium">{workflow.name}</span>? This action cannot be undone.
                    </p>
                        
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            disabled={isDeleting}
                            className="px-4 py-2 text-slate-300 hover:text-white text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-900/20 flex items-center gap-2 transition-all"
                        >
                            {isDeleting ? "Deleting..." : "Delete Workflow"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

// Execute Modal
type RunModalProps = {
  workflow: WorkflowApi | null;
  isOpen: boolean;
  formData: CaseRunFormData;
  onFormChange: (data: CaseRunFormData) => void;
  onClose: () => void;
  onConfirmRun: () => void;
  isRunning: boolean;
  error: string | null;
};

const ExecuteWorkflowModal: React.FC<RunModalProps> = ({
  workflow,
  isOpen,
  formData,
  onFormChange,
  onClose,
  onConfirmRun,
  isRunning,
  error,
}) => {
  if (!isOpen || !workflow) return null;

  const handleFieldChange = (field: keyof CaseRunFormData, value: string) => {
    onFormChange({ ...formData, [field]: value });
  };

  const fillSampleData = () => {
    onFormChange(SAMPLE_DATA);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[1040]"
        onClick={onClose}
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1050] w-full max-w-md">
        <div className="bg-navy-900 text-white border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-white/5">
            <div>
              <h5 className="text-lg font-bold">Run Workflow</h5>
              <p className="text-xs text-slate-500">{workflow.name}</p>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-white transition-colors"
              onClick={onClose}
              disabled={isRunning}
            >
                &times;
            </button>
          </div>

          <div className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm">
                {error}
              </div>
            )}

            {/* Quick Action */}
            <div className="flex items-center justify-between bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium text-white">Use Sample Data</p>
                <p className="text-[10px] text-slate-500">Fill with sample case intake data</p>
              </div>
              <button
                type="button"
                onClick={fillSampleData}
                className="px-3 py-1.5 text-xs font-bold text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/10 transition-colors"
              >
                Fill Sample
              </button>
            </div>

            {/* Case Intake Form */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormInput 
                  label="Case Name" 
                  value={formData.name}
                  onChange={(v) => handleFieldChange('name', v)}
                  placeholder="Case-AML-1042" 
                />
                <FormInput 
                  label="Contact Email" 
                  value={formData.email}
                  onChange={(v) => handleFieldChange('email', v)}
                  type="email" 
                  placeholder="alerts@bankflow.local" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormInput 
                  label="Queue" 
                  value={formData.department}
                  onChange={(v) => handleFieldChange('department', v)}
                  placeholder="Financial Crime Operations" 
                />
                <FormInput 
                  label="Case Type" 
                  value={formData.role}
                  onChange={(v) => handleFieldChange('role', v)}
                  placeholder="AML Alert Review" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormInput 
                  label="Requested Date" 
                  value={formData.startDate}
                  onChange={(v) => handleFieldChange('startDate', v)}
                  type="date" 
                  placeholder="" 
                />
                <FormInput 
                  label="Escalation Email" 
                  value={formData.managerEmail}
                  onChange={(v) => handleFieldChange('managerEmail', v)}
                  type="email" 
                  placeholder="supervisor@bankflow.local" 
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-black/20 border-t border-white/5 flex justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              onClick={onClose}
              disabled={isRunning}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-cyan-900/20 flex items-center gap-2 transition-all disabled:opacity-50"
              onClick={onConfirmRun}
              disabled={isRunning}
            >
              <FiPlay className="w-4 h-4" />
              {isRunning ? "Running..." : "Run Workflow"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/** ---------- Main page component ---------- **/

const WorkflowsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [workflows, setWorkflows] = useState<WorkflowApi[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Run Modal State - now uses form data instead of JSON text
  const [selectedWorkflowForRun, setSelectedWorkflowForRun] = useState<WorkflowApi | null>(null);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [runFormData, setRunFormData] = useState<CaseRunFormData>(EMPTY_FORM);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // Delete Modal State
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowApi | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create State
  const [isCreating, setIsCreating] = useState(false);

  // Duplicate State
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isDuplicating, setIsDuplicating] = useState(false);

  // Load Workflows
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const apiWorkflows = await fetchWorkflows();
        setWorkflows(apiWorkflows);
      } catch (err) {
        console.error("[Workflows] Failed to load workflows", err);
        setLoadError("Failed to load workflows. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  // Handlers
  const handleOpenRunModal = (wf: WorkflowApi) => {
    setSelectedWorkflowForRun(wf);
    setRunFormData(EMPTY_FORM);
    setRunError(null);
    setIsRunModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isRunning) return;
    setIsRunModalOpen(false);
  };

  const handleCreateWorkflow = async () => {
    try {
      setIsCreating(true);
      const created = await createWorkflow({
        name: "New Workflow",
        description: "Empty workflow. Add nodes to build your flow.",
        isActive: false, // Default to inactive/draft
      });
      // Add to list and navigate
      setWorkflows((prev) => [created, ...prev]);
      navigate(`/workflows/${created.id}/builder`);
    } catch (err) {
        alert("Failed to create workflow. See console.");
        console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRequest = (wf: WorkflowApi) => {
      setWorkflowToDelete(wf);
      setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
      if (!workflowToDelete) return;
      try {
          setIsDeleting(true);
          await deleteWorkflow(workflowToDelete.id);
          // Remove from list
          setWorkflows(prev => prev.filter(w => w.id !== workflowToDelete.id));
          setIsDeleteModalOpen(false);
          setWorkflowToDelete(null);
      } catch (err) {
          console.error("Failed to delete workflow", err);
          alert("Failed to delete workflow");
      } finally {
          setIsDeleting(false);
      }
  };

  const handleDuplicate = async (wf: WorkflowApi) => {
      try {
          setIsDuplicating(true);
          const duplicated = await duplicateWorkflow(wf.id);
          // Add to list and navigate to builder
          setWorkflows((prev) => [duplicated, ...prev]);
          navigate(`/workflows/${duplicated.id}/builder`);
      } catch (err) {
          console.error("Failed to duplicate workflow", err);
          alert("Failed to duplicate workflow. See console for details.");
      } finally {
          setIsDuplicating(false);
      }
  };

  const handleConfirmRun = async () => {
    if (!selectedWorkflowForRun) return;

    const hasAnyData = Object.values(runFormData).some(v => v.trim() !== '');
    const inputObj = hasAnyData ? runFormData : null;

    try {
      setIsRunning(true);
      setRunError(null);
      await executeWorkflow(selectedWorkflowForRun.id, inputObj, "manual");
      setIsRunModalOpen(false);
    } catch (err) {
      console.error("[Workflows] Failed to run workflow", err);
      setRunError("Failed to run workflow. Please try again.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
        <WorkflowSplitLayout
            workflows={workflows}
            isLoading={isLoading}
            isCreating={isCreating}
            error={loadError}
            onCreate={handleCreateWorkflow}
            onRun={handleOpenRunModal}
            onDelete={handleDeleteRequest}
            onDuplicate={handleDuplicate}
        />

        {/* Execute Modal - now with form instead of JSON */}
        <ExecuteWorkflowModal
            workflow={selectedWorkflowForRun}
            isOpen={isRunModalOpen}
            formData={runFormData}
            onFormChange={setRunFormData}
            onClose={handleCloseModal}
            onConfirmRun={handleConfirmRun}
            isRunning={isRunning}
            error={runError}
        />

        <DeleteConfirmationModal 
            workflow={workflowToDelete}
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleConfirmDelete}
            isDeleting={isDeleting}
        />
    </>
  );
};

export default WorkflowsListPage;
