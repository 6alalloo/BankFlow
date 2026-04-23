/**
 * Workflow Execution Orchestration Service
 *
 * Manages the complete workflow execution lifecycle:
 * 1. Pre-process CV parser nodes
 * 2. Compile HRFlow graph to n8n workflow
 * 3. Upsert and activate workflow in n8n
 * 4. Trigger execution via webhook
 * 5. Track execution status and capture step-by-step results
 *
 * This service coordinates between HRFlow's database, the n8n engine,
 * and external services like the CV parser.
 */

import prisma from "../lib/prisma";
import {
  callN8nExecute,
  upsertN8nWorkflow,
  activateN8nWorkflow,
  getN8nExecutionForWorkflow,
} from "./n8nService";
import { compileToN8n } from "./n8nCompiler";
import * as auditService from "./auditService";
import { config } from "../config/appConfig";
import { parseCV, type CVParseResult } from "./cvParserService";
import logger from "../lib/logger";

type ExecutionFilters = {
  status?: string;
  workflowId?: number;
};

type ExecuteWorkflowInput = {
  workflowId: number;
  triggerType?: string;
  input?: unknown;
};

type ExecutionFinalStatus = "completed" | "engine_error" | "failed";
type StepStatus = "completed" | "skipped" | "failed";

type ErrorWithCode = Error & { code?: string };

type RunContextPayload = {
  input: unknown | null;
  engine: {
    n8n: unknown | null;
    n8nWorkflowId?: string | null;
    n8nCreated?: boolean | null;
    webhookPath?: string | null;
    webhookUrl?: string | null;
    blockedUrls?: unknown;
  };
};

function safeParseJson<T = unknown>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function makeCodedError(message: string, code: string): ErrorWithCode {
  const err: ErrorWithCode = new Error(message);
  err.code = code;
  return err;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function getErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const maybe = (err as { code?: unknown }).code;
    return typeof maybe === "string" ? maybe : undefined;
  }
  return undefined;
}

function normalizeObject(input: unknown): Record<string, unknown> | null {
  if (input == null) return null;
  if (typeof input !== "object") return null;
  if (Array.isArray(input)) return null;
  return input as Record<string, unknown>;
}

function looksLikeEmployee(obj: Record<string, unknown>): boolean {
  return (
    typeof obj.email === "string" ||
    typeof obj.name === "string" ||
    typeof obj.department === "string" ||
    typeof obj.role === "string"
  );
}

/**
 * Build webhook execution body with normalized employee data structure.
 * Supports multiple input formats and falls back to trigger config if input is empty.
 * Creates both nested and flat employee fields for flexible n8n variable access.
 *
 * @param input - User-provided execution input
 * @param triggerConfigFallback - Trigger node config for default values
 * @returns Normalized execution body with employee data
 */
function buildDemoExecuteBody(input: unknown, triggerConfigFallback: Record<string, unknown> | null) {
  const obj = normalizeObject(input);
  const result: Record<string, unknown> = {};

  let employeeData: Record<string, unknown> | null = null;

  if (obj && typeof obj.employee === "object" && obj.employee && !Array.isArray(obj.employee)) {
    employeeData = obj.employee as Record<string, unknown>;
  } else if (obj && looksLikeEmployee(obj)) {
    employeeData = obj;
  } else if (triggerConfigFallback) {
    const tc = triggerConfigFallback;
    if (typeof tc.employee === "object" && tc.employee && !Array.isArray(tc.employee)) {
      employeeData = tc.employee as Record<string, unknown>;
    } else if (looksLikeEmployee(tc)) {
      employeeData = tc;
    }
  }

  // Populate both nested (employee.name) and flat (name) structures for flexible access.
  if (employeeData) {
    result.employee = employeeData;
    Object.assign(result, employeeData);
  } else {
    result.employee = {};
  }

  // Merge any additional root properties from original input.
  if (obj) {
      Object.assign(result, obj);
  }

  return result;
}

function getWebhookBaseUrl(): string {
  return config.n8n.webhookBaseUrl;
}

export async function getAllExecutions(filters: ExecutionFilters = {}) {
  const { status, workflowId } = filters;

  const where: Record<string, unknown> = {};
  if (status && status.trim().length > 0) where.status = status.trim();
  if (typeof workflowId === "number") where.workflow_id = workflowId;

  return prisma.executions.findMany({
    where,
    select: {
      id: true,
      workflow_id: true,
      trigger_type: true,
      status: true,
      started_at: true,
      finished_at: true,
      duration_ms: true,
      error_message: true,
      workflows: { select: { id: true, name: true } },
    },
    orderBy: { started_at: "desc" },
  });
}

export async function getExecutionById(id: number) {
  return prisma.executions.findUnique({
    where: { id },
    select: {
      id: true,
      workflow_id: true,
      trigger_type: true,
      status: true,
      run_context: true,
      started_at: true,
      finished_at: true,
      duration_ms: true,
      error_message: true,
      workflows: { select: { id: true, name: true } },
    },
  });
}

export async function getExecutionStepsByExecutionId(executionId: number) {
  return prisma.execution_steps.findMany({
    where: { execution_id: executionId },
    select: {
      id: true,
      execution_id: true,
      node_id: true,
      status: true,
      input_json: true,
      output_json: true,
      logs: true,
      started_at: true,
      finished_at: true,
      workflow_nodes: { select: { id: true, name: true, kind: true } },
    },
    orderBy: { started_at: "asc" },
  });
}

/**
 * Execute a workflow by compiling it to n8n and triggering via webhook.
 * This is the main entry point for all workflow executions (manual, scheduled, webhook).
 *
 * Orchestrates the complete execution flow including CV parsing, compilation,
 * n8n activation, webhook trigger, and execution tracking.
 *
 * @param params - Workflow ID, trigger type, and input data
 * @returns Execution record with steps and n8n result
 * @throws Error with specific code if workflow not found or engine error occurs
 */
export async function executeWorkflow(params: ExecuteWorkflowInput) {
  const { workflowId, triggerType, input } = params;

  let workflow = await prisma.workflows.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) throw makeCodedError("Workflow not found", "WORKFLOW_NOT_FOUND");

  // Auto-activate inactive workflows for better builder UX.
  if (!workflow.is_active) {
    workflow = await prisma.workflows.update({
      where: { id: workflowId },
      data: { is_active: true },
    });
  }

  const [nodesRaw, edgesRaw] = await Promise.all([
    prisma.workflow_nodes.findMany({
      where: { workflow_id: workflowId },
      orderBy: { id: "asc" },
    }),
    prisma.workflow_edges.findMany({
      where: { workflow_id: workflowId },
      orderBy: { id: "asc" },
    }),
  ]);

  if (nodesRaw.length === 0) {
    throw makeCodedError("Workflow has no nodes", "WORKFLOW_HAS_NO_NODES");
  }

  // Pre-process CV parser nodes before n8n execution (async CV parsing).
  // Only supports local file uploads via fileId.
  const cvParserResults = new Map<number, CVParseResult>();
  for (const node of nodesRaw) {
    if (node.kind === "cv_parser" || node.kind === "cv_parse") {
      const nodeConfig = safeParseJson<Record<string, unknown>>(node.config_json, {});
      const fileId = nodeConfig.fileId as string | undefined;

      if (fileId) {
        logger.info('Parsing CV from uploaded file', { nodeId: node.id, fileId });
        const result = await parseCV(fileId);
        cvParserResults.set(node.id, result);
        logger.info('CV parse result', {
          nodeId: node.id,
          success: result.success,
          error: result.success ? undefined : result.error
        });
      } else {
        logger.warn('No file uploaded for cv_parser node', { nodeId: node.id });
        cvParserResults.set(node.id, {
          success: false,
          source: "file",
          data: {
            name: null,
            email: null,
            phone: null,
            skills: [],
            experience_years: null,
            education: [],
          },
          error: "No file uploaded for CV parser",
        });
      }
    }
  }

  const startTime = new Date();

  const runContextPayload: RunContextPayload & { cvParserResults?: Record<number, CVParseResult> } = {
    input: input ?? null,
    engine: {
      n8n: null,
      n8nWorkflowId: null,
      n8nCreated: null,
      webhookPath: null,
      webhookUrl: null,
    },
  };

  const execution = await prisma.executions.create({
    data: {
      workflow_id: workflowId,
      trigger_type:
        typeof triggerType === "string" && triggerType.trim().length > 0
          ? triggerType.trim()
          : "manual",
      status: "running",
      run_context: JSON.stringify(runContextPayload),
      started_at: startTime,
      finished_at: null,
      duration_ms: null,
      error_message: null,
      n8n_execution_id: null,
    },
  });

  // Log execution start for audit trail.
  await auditService.logAuditEvent({
    eventType: "execution_started",
    userId: workflow.owner_user_id || 1,
    targetType: "execution",
    targetId: execution.id,
    details: {
      workflowId,
      workflowName: workflow.name,
      triggerType: triggerType ?? "manual",
    },
  });

  let n8nResult: unknown | null = null;
  let finalStatus: ExecutionFinalStatus = "failed";
  let errorMessage: string | null = null;

  const webhookPath = `/webhook/hrflow-${workflowId}-execute`;
  const webhookUrl = `${getWebhookBaseUrl()}${webhookPath}`;

  try {
    // Compile HRFlow graph to n8n workflow JSON with URL validation.
    const compiled = await compileToN8n({
      hrflowWorkflowId: workflowId,
      workflowName: workflow.name,
      webhookPath,
      userId: workflow.owner_user_id || undefined,
      nodes: nodesRaw.map((n) => ({
        id: n.id,
        kind: n.kind,
        name: n.name ?? null,
        config: safeParseJson<Record<string, unknown>>(n.config_json, {}),
        posX: n.pos_x,
        posY: n.pos_y,
      })),
      edges: edgesRaw.map((e) => ({
        id: e.id,
        fromNodeId: e.from_node_id,
        toNodeId: e.to_node_id,
        priority: e.priority ?? 0,
        label: e.label ?? null,
        condition: safeParseJson<Record<string, unknown>>(e.condition_json, {}),
      })),
    });

    // Upsert workflow in n8n by name for idempotent updates.
    const n8nName = `HRFlow: ${workflow.name} (#${workflowId})`;
    const upsert = await upsertN8nWorkflow({
      name: n8nName,
      nodes: compiled.nodes,
      connections: compiled.connections,
    });

    runContextPayload.engine.n8nWorkflowId = upsert.id;
    runContextPayload.engine.n8nCreated = upsert.created;
    runContextPayload.engine.webhookPath = webhookPath;
    runContextPayload.engine.webhookUrl = webhookUrl;

    // Persist n8n workflow ID and webhook path for future executions.
    await prisma.workflows.update({
      where: { id: workflowId },
      data: {
        n8n_workflow_id: upsert.id,
        n8n_webhook_path: webhookPath,
      },
    });

    // Activate workflow in n8n to register webhook endpoint.
    await activateN8nWorkflow(upsert.id);

    // Trigger execution via webhook with normalized employee data.
    const triggerNode = nodesRaw.find((n) => n.kind === "trigger");
    const triggerConfig = triggerNode
      ? safeParseJson<Record<string, unknown>>(triggerNode.config_json, {})
      : null;

    const body = buildDemoExecuteBody(input, triggerConfig);

    n8nResult = await callN8nExecute(webhookUrl, body);

    finalStatus = "completed";
  } catch (err: unknown) {
    const code = getErrorCode(err);
    logger.error('Workflow execution failed', {
      workflowId,
      executionId: execution.id,
      errorCode: code,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });

    if (code === "N8N_UNREACHABLE" || code === "N8N_HTTP_ERROR" || code === "N8N_MISSING_API_KEY") {
      finalStatus = "engine_error";
    } else {
      finalStatus = "failed";
    }

    errorMessage = getErrorMessage(err) || "Failed to execute workflow via n8n";

    // Preserve blocked URL details for better error reporting
    if (code === "URL_BLOCKED" && err && typeof err === "object" && "blockedUrls" in err) {
      runContextPayload.engine.blockedUrls = (err as any).blockedUrls;
    }
  }

  const finishedTime = new Date();
  const durationMs = finishedTime.getTime() - startTime.getTime();

  runContextPayload.engine.n8n = n8nResult;

  // Attach CV parser results to run context for UI display.
  if (cvParserResults.size > 0) {
    runContextPayload.cvParserResults = Object.fromEntries(cvParserResults);
  }

  const updatedExecution = await prisma.executions.update({
    where: { id: execution.id },
    data: {
      status: finalStatus,
      run_context: JSON.stringify(runContextPayload),
      finished_at: finishedTime,
      duration_ms: durationMs,
      error_message: errorMessage,
    },
  });

  // Log execution completion or failure for audit trail.
  await auditService.logAuditEvent({
    eventType: finalStatus === "completed" ? "execution_completed" : "execution_failed",
    userId: workflow.owner_user_id || 1,
    targetType: "execution",
    targetId: updatedExecution.id,
    details: {
      workflowId,
      workflowName: workflow.name,
      status: finalStatus,
      durationMs,
      triggerType,
    },
  });

  // Extract output data from n8n webhook response (array of items with json).
  let n8nOutputData: Record<string, unknown> = {};
  let n8nOutputRaw: unknown[] = [];

  if (n8nResult) {
    if (Array.isArray(n8nResult)) {
      n8nOutputRaw = n8nResult;
      // Extract final output from last item in execution result.
      const lastItem = n8nResult[n8nResult.length - 1];
      if (lastItem && typeof lastItem === "object") {
        if ("json" in lastItem && typeof lastItem.json === "object") {
          n8nOutputData = lastItem.json as Record<string, unknown>;
        } else {
          n8nOutputData = lastItem as Record<string, unknown>;
        }
      }
    } else if (typeof n8nResult === "object") {
      n8nOutputData = n8nResult as Record<string, unknown>;
    }
  }

  // Retrieve per-node outputs from n8n execution for detailed step tracking.
  // Fetch this even on failure to determine which specific node failed.
  type PerNodeData = { data: Record<string, unknown>; error?: string; executionStatus: "success" | "error" | "unknown" };
  let perNodeOutputs: Map<string, PerNodeData> = new Map();
  let failedNodeName: string | undefined;
  const n8nWorkflowId = runContextPayload.engine.n8nWorkflowId;

  if (n8nWorkflowId) {
    try {
      // Brief delay to allow n8n to finalize execution data.
      await new Promise((resolve) => setTimeout(resolve, 500));

      logger.debug('Fetching per-node outputs from n8n', {
        executionId: execution.id,
        n8nWorkflowId,
        finalStatus
      });
      const executionData = await getN8nExecutionForWorkflow(n8nWorkflowId);

      if (executionData?.nodeOutputs) {
        logger.debug('Retrieved node outputs from n8n', {
          executionId: execution.id,
          nodeCount: executionData.nodeOutputs.size,
          failedNodeName: executionData.failedNodeName
        });
        failedNodeName = executionData.failedNodeName;
        for (const [nodeName, nodeData] of executionData.nodeOutputs) {
          logger.debug('Node output retrieved', {
            executionId: execution.id,
            nodeName,
            executionStatus: nodeData.executionStatus,
            error: nodeData.error,
            dataPreview: JSON.stringify(nodeData.data).slice(0, 200)
          });
          perNodeOutputs.set(nodeName, {
            data: nodeData.data,
            error: nodeData.error,
            executionStatus: nodeData.executionStatus
          });
        }
      } else {
        logger.debug('No node outputs in execution data', {
          executionId: execution.id,
          hasExecutionData: !!executionData
        });
      }
    } catch (err) {
      logger.warn('Could not fetch per-node outputs from n8n', {
        executionId: execution.id,
        n8nWorkflowId,
        error: err instanceof Error ? err.message : String(err)
      });
      // Fallback: use webhook response data for step outputs.
    }
  }

  // Construct trigger input data from config or execution input.
  const triggerNode = nodesRaw.find((n) => n.kind === "trigger");
  const triggerConfig = triggerNode
    ? safeParseJson<Record<string, unknown>>(triggerNode.config_json, {})
    : {};
  const inputData = buildDemoExecuteBody(input, triggerConfig);

  // Generate stable node name matching n8nCompiler convention.
  const getStableNodeName = (node: { id: number; name: string | null; kind: string }) => {
    const name = node.name ?? node.kind;
    return `HRFlow ${node.id} ${name}`.replace(/\s+/g, " ").trim();
  };

  // If we have an error but no n8n execution data (compilation error),
  // try to parse the error message to identify which node caused the failure.
  // Error format: "Node 'kind' (ID: 123): error message"
  let failedNodeId: number | undefined;
  if (finalStatus !== "completed" && !failedNodeName && errorMessage) {
    const nodeIdMatch = errorMessage.match(/\(ID:\s*(\d+)\)/i);
    if (nodeIdMatch) {
      failedNodeId = parseInt(nodeIdMatch[1], 10);
      logger.debug('Parsed failed node ID from error message', {
        executionId: execution.id,
        failedNodeId,
        errorMessage
      });
    }
  }

  // Build execution step records with inputs, outputs, and logs.
  // Track whether we've encountered a failed node to mark subsequent nodes as skipped.
  let encounteredFailure = false;

  const stepsData = nodesRaw.map((node, index) => {
    const stepInput = index === 0 ? inputData : n8nOutputData;

    // Attempt to retrieve node-specific output from n8n execution.
    const stableNodeName = getStableNodeName(node);
    const perNodeData = perNodeOutputs.get(stableNodeName);
    let stepOutput: Record<string, unknown> = perNodeData?.data || {};
    const nodeError = perNodeData?.error;
    const nodeExecutionStatus = perNodeData?.executionStatus;

    // Inject CV parser results for CV parser nodes.
    let cvParserFailed = false;
    let cvParserError: string | undefined;
    if ((node.kind === "cv_parser" || node.kind === "cv_parse") && cvParserResults.has(node.id)) {
      const cvResult = cvParserResults.get(node.id)!;
      stepOutput = {
        ...cvResult.data,
        _hrflow: {
          nodeType: "cv_parser",
          cvParsed: cvResult.success,
          source: cvResult.source,
          filename: cvResult.filename,
          error: cvResult.error,
        },
      };
      // Track if CV parsing failed
      if (!cvResult.success) {
        cvParserFailed = true;
        cvParserError = cvResult.error;
      }
    } else if (Object.keys(stepOutput).length === 0) {
      // Fallback: use webhook response if per-node data unavailable.
      if (n8nOutputRaw.length > index) {
        const nodeResult = n8nOutputRaw[index];
        if (nodeResult && typeof nodeResult === "object") {
          if ("json" in nodeResult && typeof (nodeResult as Record<string, unknown>).json === "object") {
            stepOutput = (nodeResult as Record<string, unknown>).json as Record<string, unknown>;
          } else {
            stepOutput = nodeResult as Record<string, unknown>;
          }
        }
      } else {
        stepOutput = n8nOutputData;
      }
    }

    // Determine step status based on per-node execution data.
    let stepStatus: StepStatus;
    const isThisNodeFailed =
      cvParserFailed ||
      nodeExecutionStatus === "error" ||
      stableNodeName === failedNodeName ||
      (failedNodeId !== undefined && node.id === failedNodeId);

    if (isThisNodeFailed) {
      // This node failed (CV parser, n8n error, or parsed from error message)
      stepStatus = "failed";
      encounteredFailure = true;
    } else if (finalStatus === "completed") {
      // Overall execution succeeded and this node didn't fail
      stepStatus = "completed";
    } else if (encounteredFailure) {
      // A previous node in execution order failed, so this node was skipped
      stepStatus = "skipped";
    } else if (nodeExecutionStatus === "success") {
      // This node completed successfully before another node failed
      stepStatus = "completed";
    } else if (perNodeData) {
      // We have data for this node, so it ran
      stepStatus = "completed";
    } else {
      // No data for this node - it was skipped (compilation error or never reached)
      stepStatus = "skipped";
    }

    // Generate descriptive log message based on node type and step status.
    let logMessage: string;
    if (stepStatus === "completed") {
      const hrflowMeta = stepOutput._hrflow as Record<string, unknown> | undefined;
      if (hrflowMeta?.log) {
        const logData = hrflowMeta.log as Record<string, unknown>;
        logMessage = `[${logData.level ?? "info"}] ${logData.message ?? "Logged"}`;
      } else if (node.kind === "trigger") {
        logMessage = `Trigger executed - Employee: ${(stepOutput.employee as Record<string, unknown>)?.name ?? "Unknown"}`;
      } else if (node.kind === "email") {
        // Get email from trigger node's output (first node in the workflow)
        const triggerOutput = index > 0 ? inputData : stepOutput;
        const employeeData = triggerOutput.employee as Record<string, unknown> | undefined;
        const recipientEmail = employeeData?.email || triggerOutput.email || "Unknown";
        logMessage = `Email sent to ${recipientEmail}`;
      } else if (node.kind === "cv_parse" || node.kind === "cv_parser") {
        const cvMeta = stepOutput._hrflow as Record<string, unknown> | undefined;
        if (cvMeta?.cvParsed) {
          const name = stepOutput.name || "Unknown";
          const skills = Array.isArray(stepOutput.skills) ? stepOutput.skills.length : 0;
          logMessage = `CV parsed successfully - Candidate: ${name}, Skills found: ${skills}`;
        } else {
          logMessage = `CV parsing failed - ${cvMeta?.error || "Unknown error"}`;
        }
      } else {
        logMessage = `Executed node ${node.name ?? node.kind} (order ${index + 1}) via n8n`;
      }
    } else if (stepStatus === "failed") {
      logMessage = cvParserError || nodeError || errorMessage || `Node ${node.name ?? node.kind} failed during execution`;
    } else {
      // Skipped - provide context based on whether we know why
      if (encounteredFailure) {
        logMessage = `Skipped - previous node failed`;
      } else if (failedNodeId !== undefined || failedNodeName) {
        logMessage = `Skipped - workflow did not reach this node`;
      } else {
        logMessage = `Skipped - execution did not complete`;
      }
    }

    return {
      execution_id: updatedExecution.id,
      node_id: node.id,
      status: stepStatus,
      input_json: JSON.stringify(stepInput),
      output_json: JSON.stringify(stepOutput),
      logs: logMessage,
      started_at: startTime,
      finished_at: finishedTime,
    };
  });

  if (stepsData.length > 0) {
    await prisma.execution_steps.createMany({ data: stepsData });
  }

  // Check if any step failed - if so, update overall execution status to "failed"
  const hasFailedStep = stepsData.some(step => step.status === "failed");
  let finalExecution = updatedExecution;

  if (hasFailedStep && updatedExecution.status === "completed") {
    // A step failed (e.g., CV parser) but the n8n execution succeeded
    // Update the overall execution status to reflect the step failure
    const failedStepData = stepsData.find(step => step.status === "failed");
    finalExecution = await prisma.executions.update({
      where: { id: updatedExecution.id },
      data: {
        status: "failed",
        error_message: failedStepData?.logs || "A workflow step failed during execution",
      },
    });

    logger.info('Updated execution status to failed due to step failure', {
      executionId: updatedExecution.id,
      failedStepLog: failedStepData?.logs
    });
  }

  const steps = await prisma.execution_steps.findMany({
    where: { execution_id: updatedExecution.id },
    select: {
      id: true,
      execution_id: true,
      node_id: true,
      status: true,
      input_json: true,
      output_json: true,
      logs: true,
      started_at: true,
      finished_at: true,
      workflow_nodes: { select: { id: true, name: true, kind: true } },
    },
    orderBy: { id: "asc" },
  });

  return {
    execution: finalExecution,
    steps,
    n8nResult,
  };
}

export async function deleteExecution(id: number) {
  const existing = await prisma.executions.findUnique({
    where: { id },
    select: {
      id: true,
      workflow_id: true,
      trigger_type: true,
      status: true,
    },
  });

  if (!existing) return null;

  await prisma.executions.delete({
    where: { id },
  });

  return existing;
}
