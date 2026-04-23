import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FiCheck, FiX, FiClock, FiBox, FiActivity, FiCpu, FiMessageSquare, FiUser, FiMail, FiPhone, FiBook, FiAward } from "react-icons/fi";
import {
  LuMail, LuGlobe, LuSplit, LuDatabase, LuClock, LuFileText, LuZap, LuTerminal, LuCalendar, LuBox
} from "react-icons/lu";
import {
  fetchExecutionWithSteps,
  type ExecutionDetailResponse,
  type ExecutionStep,
} from "../../api/executions";
import { executeWorkflow } from "../../api/workflows";

// Node kind to icon/color mapping (matches builder)
const NODE_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  trigger: { icon: LuZap, color: 'text-yellow-400', label: 'Trigger' },
  cv_parser: { icon: LuFileText, color: 'text-indigo-400', label: 'CV Parser' },
  cv_parse: { icon: LuFileText, color: 'text-indigo-400', label: 'CV Parser' },
  email: { icon: LuMail, color: 'text-blue-400', label: 'Send Email' },
  http: { icon: LuGlobe, color: 'text-green-400', label: 'HTTP Request' },
  condition: { icon: LuSplit, color: 'text-purple-400', label: 'Condition' },
  database: { icon: LuDatabase, color: 'text-rose-400', label: 'Database' },
  variable: { icon: LuBox, color: 'text-teal-400', label: 'Set Variable' },
  wait: { icon: LuClock, color: 'text-amber-400', label: 'Delay / Wait' },
  datetime: { icon: LuCalendar, color: 'text-orange-400', label: 'Date / Time' },
  logger: { icon: LuTerminal, color: 'text-slate-300', label: 'Logger' },
};

const getNodeConfig = (kind: string | undefined) => {
  if (!kind) return { icon: FiBox, color: 'text-slate-400', label: 'Unknown' };
  return NODE_TYPE_CONFIG[kind.toLowerCase()] || { icon: FiBox, color: 'text-slate-400', label: kind };
};


const ExecutionDetailPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<ExecutionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<ExecutionStep | null>(null);
  const [rerunning, setRerunning] = useState(false);

  const executionId = params.id ? Number(params.id) : NaN;

  const load = useCallback(async () => {
    if (!executionId || Number.isNaN(executionId)) return;
    try {
      setLoading(true);
      const result = await fetchExecutionWithSteps(executionId);
      setData(result);
      if (result.steps.length > 0) {
        const failedStep = result.steps.find(s => s.status === 'failed');
        setSelectedStep(failedStep || result.steps[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => { void load(); }, [load]);

  const handleRerun = async () => {
    if (!data) return;
    setRerunning(true);
    try {
      const res = await executeWorkflow(data.execution.workflow_id, null, "manual");
      if (res?.execution?.id) navigate(`/executions/${res.execution.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setRerunning(false);
    }
  };

  // Early returns AFTER all hooks
  if (loading) return <div className="flex h-full items-center justify-center text-slate-500">Loading details...</div>;
  if (!data) return <div className="p-10 text-center text-slate-500">Execution not found</div>;

  const { execution, steps } = data;
  const isSuccess = execution.status === 'completed';

  return (
    <div className="h-full flex flex-col bg-navy-950 text-white overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* 1. Header Area */}
      <div className="px-8 py-6 border-b border-white/5 bg-navy-950/50 backdrop-blur-md z-10 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link to="/executions" className="text-slate-500 hover:text-white transition-colors text-sm font-medium flex items-center gap-1">
              Executions <FiActivity />
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400 text-sm">Run #{execution.id}</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            {execution.workflows?.name || "Untitled Workflow"}
            <span className="text-slate-500 text-lg font-normal">#{execution.id}</span>
          </h1>
          <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
            <span className="flex items-center gap-1.5">
              <FiActivity className="text-blue-400"/> Triggered by <b className="text-slate-300 uppercase">{execution.trigger_type || 'Manual'}</b>
            </span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1.5">
              <FiClock className="text-purple-400"/> {execution.duration_ms ? `${(execution.duration_ms/1000).toFixed(2)}s` : '0s'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* BIG STATUS PILL */}
          <div className={`
            px-6 py-2 rounded-full border shadow-[0_0_30px_rgba(0,0,0,0.3)] backdrop-blur-sm
            flex items-center gap-3 text-lg font-bold tracking-widest uppercase
            ${isSuccess 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-900/20' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-900/20'}
          `}>
            {isSuccess ? 'Success' : 'Failed'}
            {isSuccess ? <FiCheck className="w-6 h-6 border-2 border-current rounded-full p-0.5" /> : <FiX className="w-6 h-6 border-2 border-current rounded-full p-0.5" />}
          </div>

          <button 
            onClick={handleRerun}
            disabled={rerunning}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-white transition-all flex items-center gap-2"
          >
            {rerunning ? <FiActivity className="animate-spin" /> : <FiActivity />} Re-run
          </button>
        </div>
      </div>

      {/* Error Message Banner */}
      {!isSuccess && execution.error_message && (
        <div className="px-8 py-4 border-b border-rose-500/20 bg-rose-500/5 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-start gap-3">
            <FiX className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-rose-300 mb-1">Error Details</h4>
              <p className="text-sm text-rose-200/90 break-words">{execution.error_message}</p>

              {/* Special handling for URL blocking errors */}
              {(execution.error_message.includes('non-whitelisted domains') ||
                (execution.error_message.includes('URL') && execution.error_message.includes('blocked'))) && (
                <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <p className="text-xs text-orange-300 mb-2">
                    <strong className="text-orange-200">⚠️ URL Blocked:</strong> This workflow contains HTTP requests to domains that are not in your allow-list.
                  </p>
                  <p className="text-xs text-slate-400">
                    <strong className="text-slate-300">To fix this:</strong>
                  </p>
                  <ol className="text-xs text-slate-400 ml-4 mt-1 space-y-1 list-decimal">
                    <li>Go to Security → Domain Allow-List</li>
                    <li>Add the blocked domain to the allow-list</li>
                    <li>Try running the workflow again</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Split Content */}
      <div className="flex-1 flex overflow-hidden z-10">
        
        {/* LEFT: Timeline Panel */}
        <div className="w-[300px] border-r border-white/5 bg-navy-900/20 backdrop-blur-sm flex flex-col">
          <div className="p-3 border-b border-white/5">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Steps</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            <div className="relative pl-3 space-y-4">
              {/* Vertical Line */}
              <div className="absolute left-[24px] top-3 bottom-3 w-px bg-white/5 z-0" />

              {steps.map((step) => {
                const isSelected = selectedStep?.id === step.id;
                const isStepSuccess = step.status === 'completed';
                const isStepFailed = step.status === 'failed';
                const nodeKind = step.workflow_nodes?.kind;
                const nodeConfig = getNodeConfig(nodeKind);
                const NodeIcon = nodeConfig.icon;
                
                return (
                  <div 
                    key={step.id} 
                    onClick={() => setSelectedStep(step)}
                    className={`relative z-10 cursor-pointer group flex items-start gap-3 p-2.5 rounded-lg border transition-all duration-200
                      ${isSelected 
                        ? 'bg-blue-600/10 border-blue-500/30 shadow-lg shadow-blue-900/10' 
                        : 'bg-navy-950/40 border-white/5 hover:bg-white/5 hover:border-white/10'}
                    `}
                  >
                    {/* Node Type Icon */}
                    <div className={`
                      mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 shadow-sm bg-white/5
                      ${isStepSuccess ? 'border-emerald-500/30' : ''}
                      ${isStepFailed ? 'border-rose-500/30' : ''}
                      ${!isStepSuccess && !isStepFailed ? 'border-white/10' : ''}
                    `}>
                      <NodeIcon className={`w-3.5 h-3.5 ${nodeConfig.color}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className={`text-xs font-bold mb-0.5 ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                        {step.workflow_nodes?.name || nodeConfig.label}
                      </h4>
                      <div className="flex items-center gap-2 text-[9px] text-slate-500">
                        <span className={`px-1.5 py-0.5 rounded bg-white/5 border border-white/10 uppercase font-mono ${nodeConfig.color}`}>
                          {nodeConfig.label}
                        </span>
                        <span className="font-mono">{new Date(step.started_at || '').toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div className={`
                      w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-1
                      ${isStepSuccess ? 'bg-emerald-500 text-navy-950' : ''}
                      ${isStepFailed ? 'bg-rose-500 text-white' : ''}
                      ${!isStepSuccess && !isStepFailed ? 'bg-slate-600 text-slate-400' : ''}
                    `}>
                      {isStepSuccess && <FiCheck size={10} strokeWidth={3} />}
                      {isStepFailed && <FiX size={10} strokeWidth={3} />}
                    </div>
                    
                    {isSelected && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <FiActivity className="text-blue-400 animate-pulse w-3 h-3" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Detail Viewer */}
        <div className="flex-1 overflow-y-auto bg-navy-950/40 p-6 custom-scrollbar relative">
          {selectedStep ? (
            <div className="max-w-4xl mx-auto space-y-5 animate-fade-in-up">
              {(() => {
                // Parse JSON data
                let inputData: Record<string, unknown> = {};
                let outputData: Record<string, unknown> = {};
                try {
                  inputData = selectedStep.input_json ? JSON.parse(selectedStep.input_json) : {};
                } catch { /* ignore */ }
                try {
                  outputData = selectedStep.output_json ? JSON.parse(selectedStep.output_json) : {};
                } catch { /* ignore */ }

                const hasErrorLog = selectedStep.status === 'failed' && selectedStep.logs;
                const employee = (inputData.employee || outputData.employee) as Record<string, string> | undefined;
                const hrflowMeta = outputData._hrflow as Record<string, unknown> | undefined;
                const logData = hrflowMeta?.log as Record<string, unknown> | undefined;
                const nodeType = selectedStep.workflow_nodes?.kind || hrflowMeta?.nodeType as string;

                // Helper to render a data row
                const DataRow = ({ label, value, icon }: { label: string; value: string | undefined; icon?: React.ReactNode }) => {
                  if (!value) return null;

                  // Only apply multiline formatting to specific fields (raw text)
                  const isRawText = label.toLowerCase() === 'raw text' || label.toLowerCase() === 'raw_text';

                  return (
                    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                      <div className="w-5 h-5 flex items-center justify-center text-slate-500">
                        {icon || <FiBox className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
                        <div className={`text-sm text-slate-300 ${isRawText ? 'whitespace-pre-line font-mono text-xs leading-relaxed max-h-32 overflow-y-auto' : 'truncate font-medium text-white'}`}>
                          {value}
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {/* Step Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border text-lg ${
                        selectedStep.status === 'completed' 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}>
                        {selectedStep.status === 'completed' ? <FiCheck /> : <FiX />}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedStep.workflow_nodes?.name || 'Step Details'}</h2>
                        <p className="text-slate-400 text-xs flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase">
                            {nodeType || 'node'}
                          </span>
                          {selectedStep.logs && !hasErrorLog && (
                            <span className="text-slate-500">{selectedStep.logs}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Error Display */}
                    {hasErrorLog && (
                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-2 text-rose-400 text-sm font-bold mb-2">
                          <FiX /> Error
                        </div>
                        <p className="text-rose-200 text-sm">{selectedStep.logs}</p>
                      </div>
                    )}

                    {/* Trigger Input Card */}
                    {employee && Object.keys(employee).length > 0 && (
                      <div className="bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                            <FiActivity /> Trigger Input
                          </span>
                        </div>
                        <div className="p-4">
                          <DataRow label="Case Name" value={employee.name} />
                          <DataRow label="Contact Email" value={employee.email} />
                          <DataRow label="Queue" value={employee.department} />
                          <DataRow label="Case Type" value={employee.role} />
                          <DataRow label="Requested Date" value={employee.startDate} />
                          <DataRow label="Escalation Email" value={employee.managerEmail} />
                        </div>
                      </div>
                    )}

                    {/* Log Info Card (for logger nodes) */}
                    {logData && (
                      <div className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                          <span className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                            <FiMessageSquare /> Log Output
                          </span>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                              logData.level === 'error' ? 'bg-rose-500/20 text-rose-400' :
                              logData.level === 'warn' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {String(logData.level || 'info')}
                            </span>
                            <span className="text-slate-500 text-xs">
                              {logData.timestamp ? new Date(String(logData.timestamp)).toLocaleString() : ''}
                            </span>
                          </div>
                          <p className="text-white text-sm font-medium">{String(logData.message || 'No message')}</p>
                        </div>
                      </div>
                    )}

                    {/* Email Info Card (for email nodes) */}
                    {nodeType === 'email' && (() => {
                      // Get email from either employee object or directly from outputData/inputData
                      const emailRecipient = (
                        (outputData.employee as Record<string, unknown> | undefined)?.email ||
                        outputData.email ||
                        (inputData.employee as Record<string, unknown> | undefined)?.email ||
                        inputData.email
                      ) as string | undefined;

                      if (!emailRecipient) return null;

                      return (
                        <div className="bg-gradient-to-br from-slate-500/5 to-slate-600/5 border border-slate-500/20 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <FiMail /> Email Sent
                            </span>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-500/20 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                <FiMail className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Recipient</div>
                                <div className="text-sm text-white font-medium truncate">{emailRecipient}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* CV Parser Output Card */}
                    {(nodeType === 'cv_parse' || nodeType === 'cv_parser') && Object.keys(outputData).length > 0 && (() => {
                      // Backend already spreads cvResult.data directly into stepOutput (see executionService.ts line 479)
                      // So outputData.name is available directly, not under outputData.data
                      
                      // Extract name - CV parser returns full name like "Talal Hawaj"
                      const rawName = String(outputData.name || outputData.full_name || 'Unknown Candidate');
                      const nameParts = rawName.trim().split(/\s+/);
                      const firstName = nameParts[0] || 'Unknown';
                      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                      
                      const email = outputData.email ? String(outputData.email) : null;
                      const phone = outputData.phone ? String(outputData.phone) : null;
                      const skills = outputData.skills as unknown[] | undefined;
                      const education = outputData.education as unknown[] | string | undefined;
                      
                      return (
                        <div className="bg-gradient-to-br from-teal-500/5 to-emerald-500/5 border border-teal-500/20 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                            <span className="text-xs font-bold text-teal-400 uppercase tracking-widest flex items-center gap-2">
                              <FiUser /> CV Parse Results
                            </span>
                          </div>
                          <div className="p-4 space-y-4">
                            {/* Candidate Name & Contact */}
                            <div className="flex items-start gap-4">
                              <div className="w-14 h-14 bg-teal-500/20 rounded-xl flex items-center justify-center text-teal-400 text-2xl font-bold shrink-0">
                                {firstName.charAt(0).toUpperCase()}{lastName.charAt(0).toUpperCase() || ''}
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-white">
                                  {firstName} <span className="text-teal-300">{lastName}</span>
                                </h3>
                                <div className="flex flex-wrap gap-3 mt-2 text-sm">
                                  {email && (
                                    <span className="flex items-center gap-1.5 text-slate-400">
                                      <FiMail className="text-teal-400 w-4 h-4" /> {email}
                                    </span>
                                  )}
                                  {phone && (
                                    <span className="flex items-center gap-1.5 text-slate-400">
                                      <FiPhone className="text-teal-400 w-4 h-4" /> {phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Skills */}
                            {skills && skills.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wide mb-2">
                                  <FiAward className="text-teal-400" /> Skills
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {skills.map((skill, i) => (
                                    <span key={i} className="px-2 py-1 bg-teal-500/10 border border-teal-500/20 rounded-lg text-xs text-teal-300">
                                      {String(skill)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Education - Show full sentences */}
                            {education && (
                              <div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wide mb-2">
                                  <FiBook className="text-teal-400" /> Education
                                </div>
                                <div className="space-y-2">
                                  {Array.isArray(education)
                                    ? education.map((edu, i) => (
                                        <div key={i} className="py-2 px-3 bg-white/5 rounded-lg border border-white/5">
                                          <p className="text-sm text-slate-300 leading-relaxed">
                                            {typeof edu === 'object' ? JSON.stringify(edu) : String(edu)}
                                          </p>
                                        </div>
                                      ))
                                    : (
                                      <div className="py-2 px-3 bg-white/5 rounded-lg border border-white/5">
                                        <p className="text-sm text-slate-300 leading-relaxed">
                                          {typeof education === 'object' ? JSON.stringify(education) : String(education)}
                                        </p>
                                      </div>
                                    )
                                  }
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Generic Output Card (for other data, excludes CV parser fields when cv_parse node) */}
                    {(() => {
                      // Fields to exclude from generic output (technical/internal fields)
                      const excludeKeys = [
                        '_hrflow', 'employee', 'raw_text', 'experience_years', 'source',
                        'filename', 'success', 'parsed_at', 'parser_version', 'raw_response',
                        'metadata', 'debug', 'internal_id', 'processing_time', 'file_hash',
                        'headers', 'params', 'query', 'body', 'webhookurl', 'executionmode',
                        'webhookUrl', 'executionMode', 'request', 'response', 'statusCode',
                        'timestamp', 'duration', 'error_stack', 'stack_trace', 'raw',
                        // Email SMTP technical fields
                        'accepted', 'rejected', 'ehlo', 'envelopetime', 'envelopeTime',
                        'messagetime', 'messageTime', 'messagesize', 'messageSize',
                        'envelope', 'messageid', 'messageId', 'response_code', 'smtp_response',
                        // Logger internal fields
                        'level', 'log_level', 'logLevel'
                      ];

                      // If this is a CV parser node, also exclude CV-specific fields
                      if (nodeType === 'cv_parse' || nodeType === 'cv_parser') {
                        excludeKeys.push('name', 'full_name', 'email', 'phone', 'skills', 'education',
                          'experience', 'work_history', 'work_experience', 'summary');
                      }

                      const remainingKeys = Object.keys(outputData).filter(k => !excludeKeys.includes(k));

                      if (remainingKeys.length === 0) return null;

                      return (
                        <div className="bg-[#0B0E14] border border-white/10 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                              <FiCpu /> {(nodeType === 'cv_parse' || nodeType === 'cv_parser') ? 'Additional Data' : 'Output Data'}
                            </span>
                          </div>
                          <div className="p-4 space-y-1">
                            {remainingKeys.map((key) => (
                              <DataRow
                                key={key}
                                label={key.replace(/_/g, ' ').replace(/\./g, ' › ')}
                                value={typeof outputData[key] === 'object' ? JSON.stringify(outputData[key]) : String(outputData[key])}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Empty State */}
                    {!employee && !logData && Object.keys(outputData).filter(k => k !== '_hrflow').length === 0 && !hasErrorLog && (
                      <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-8 text-center">
                        <FiBox className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                        <p className="text-slate-500 text-sm">No data to display for this step</p>
                        <p className="text-slate-600 text-xs mt-1">This node passed data through without changes</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <FiActivity size={48} className="mb-4 opacity-20" />
              <p className="text-sm">Select a step from the timeline to view data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionDetailPage;
