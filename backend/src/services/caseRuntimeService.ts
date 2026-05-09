import { Prisma } from "@prisma/client";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { toInputJson } from "../lib/json";

type RuntimeNode = {
  node_key: string;
  kind: string;
  name?: string | null;
  config_json?: unknown;
};

type RuntimeEdge = {
  from_node_key: string;
  to_node_key: string;
  label?: string | null;
  priority?: number;
  condition_json?: unknown;
};

type RuntimeGraph = {
  nodes?: RuntimeNode[];
  edges?: RuntimeEdge[];
};

type RuntimeContext = {
  caseId: number;
  actorUserId?: number | null;
  data?: Record<string, unknown>;
  decision?: string | null;
};

const blockingTaskKinds = new Set(["review", "data_capture", "document_collection", "decision_followup", "escalation_followup"]);
const nonBlockingKinds = new Set(["trigger", "intake", "variable", "logger", "notification", "email", "http", "integration", "database", "datetime", "wait"]);

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const normalizeGraph = (graph: Prisma.JsonValue): RuntimeGraph => {
  const raw = asObject(graph);
  const nodes = Array.isArray(raw.nodes) ? (raw.nodes as RuntimeNode[]) : [];
  const edges = Array.isArray(raw.edges) ? (raw.edges as RuntimeEdge[]) : [];

  return { nodes, edges };
};

const getNodeKey = (node: RuntimeNode): string => node.node_key || (node as unknown as { nodeKey?: string }).nodeKey || "";

const getNodeConfig = (node: RuntimeNode): Record<string, unknown> =>
  asObject(node.config_json ?? (node as unknown as { config?: unknown }).config);

const getEntryNode = (graph: RuntimeGraph): RuntimeNode | null => {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const incoming = new Set(edges.map((edge) => edge.to_node_key));

  return nodes.find((node) => node.kind === "trigger") ?? nodes.find((node) => !incoming.has(getNodeKey(node))) ?? null;
};

const getNextEdges = (graph: RuntimeGraph, nodeKey: string): RuntimeEdge[] =>
  (graph.edges ?? [])
    .filter((edge) => edge.from_node_key === nodeKey)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

const chooseNextNode = (graph: RuntimeGraph, nodeKey: string, decision?: string | null): RuntimeNode | null => {
  const edges = getNextEdges(graph, nodeKey);
  if (edges.length === 0) return null;

  const selected =
    (decision &&
      edges.find((edge) => {
        const label = edge.label?.toLowerCase();
        return label === decision.toLowerCase();
      })) ||
    edges[0];

  return (graph.nodes ?? []).find((node) => getNodeKey(node) === selected.to_node_key) ?? null;
};

const parseDueAt = (config: Record<string, unknown>): Date | undefined => {
  const dueInHours = Number(config.dueInHours ?? config.due_in_hours ?? config.slaHours ?? config.sla_hours);
  if (Number.isFinite(dueInHours) && dueInHours > 0) {
    return new Date(Date.now() + dueInHours * 60 * 60 * 1000);
  }

  const dueAt = config.dueAt ?? config.due_at;
  if (typeof dueAt === "string") {
    const parsed = new Date(dueAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return undefined;
};

const parseTaskType = (kind: string, config: Record<string, unknown>) => {
  const configured = String(config.taskType ?? config.task_type ?? kind);
  const allowed = new Set([
    "review",
    "data_capture",
    "approval_support",
    "document_collection",
    "decision_followup",
    "escalation_followup",
  ]);

  return allowed.has(configured) ? configured : "review";
};

const getValueByPath = (source: Record<string, unknown>, path: string): unknown =>
  path.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);

export const evaluateCondition = (config: Record<string, unknown>, data: Record<string, unknown>): string | null => {
  const field = String(config.field ?? config.path ?? "");
  const operator = String(config.operator ?? "equals");
  const expected = config.value ?? config.expected;
  const trueOutcome = String(config.trueOutcome ?? config.true_outcome ?? "true");
  const falseOutcome = String(config.falseOutcome ?? config.false_outcome ?? "false");

  if (!field) return null;

  const actual = getValueByPath(data, field);
  let passed = false;
  switch (operator) {
    case "equals":
    case "eq":
      passed = actual === expected;
      break;
    case "not_equals":
    case "neq":
      passed = actual !== expected;
      break;
    case "gt":
    case "greater_than":
      passed = Number(actual) > Number(expected);
      break;
    case "gte":
    case "greater_than_or_equal":
      passed = Number(actual) >= Number(expected);
      break;
    case "lt":
    case "less_than":
      passed = Number(actual) < Number(expected);
      break;
    case "lte":
    case "less_than_or_equal":
      passed = Number(actual) <= Number(expected);
      break;
    case "contains":
      passed = String(actual ?? "").includes(String(expected ?? ""));
      break;
    case "exists":
      passed = actual !== undefined && actual !== null && actual !== "";
      break;
    default:
      passed = false;
  }

  return passed ? trueOutcome : falseOutcome;
};

async function createBlockingTask(tx: Prisma.TransactionClient, context: RuntimeContext, node: RuntimeNode) {
  const config = getNodeConfig(node);
  const nodeKey = getNodeKey(node);
  const existingOpenTask = await tx.case_tasks.findFirst({
    where: {
      case_id: context.caseId,
      flow_node_key: nodeKey,
      status: { in: ["pending", "assigned", "claimed", "overdue"] },
    },
  });

  if (existingOpenTask) {
    return { blocked: true, taskId: existingOpenTask.id, reason: "existing_task" };
  }

  const task = await tx.case_tasks.create({
    data: {
      case_id: context.caseId,
      flow_node_key: nodeKey,
      task_type: parseTaskType(node.kind, config) as never,
      title: String(config.title ?? node.name ?? "Review case"),
      status: config.assignedUserId || config.assigned_user_id ? "assigned" : "pending",
      assigned_user_id: Number(config.assignedUserId ?? config.assigned_user_id) || null,
      assigned_team_id: Number(config.assignedTeamId ?? config.assigned_team_id) || null,
      claim_policy: config.claimPolicy === "direct_assign" || config.claim_policy === "direct_assign" ? "direct_assign" : "claim_required",
      due_at: parseDueAt(config),
      input_json: toInputJson({ nodeConfig: config, caseData: context.data ?? {} }),
    },
  });

  await tx.cases.update({
    where: { id: context.caseId },
    data: {
      status: "pending_action",
      current_node_key: getNodeKey(node),
      current_task_id: task.id,
      assignee_user_id: task.assigned_user_id,
      assignee_team_id: task.assigned_team_id,
    },
  });

  await tx.case_events.create({
    data: {
      case_id: context.caseId,
      task_id: task.id,
      flow_node_key: getNodeKey(node),
      actor_user_id: context.actorUserId ?? null,
      event_type: "task_created",
      summary: `Task created: ${task.title}`,
      data_json: toInputJson({ taskId: task.id, nodeKind: node.kind }),
    },
  });

  return { blocked: true, taskId: task.id };
}

async function createApproval(tx: Prisma.TransactionClient, context: RuntimeContext, node: RuntimeNode) {
  const config = getNodeConfig(node);
  const nodeKey = getNodeKey(node);
  const existingOpenApproval = await tx.case_approvals.findFirst({
    where: {
      case_id: context.caseId,
      flow_node_key: nodeKey,
      status: "requested",
    },
  });

  if (existingOpenApproval) {
    return { blocked: true, approvalId: existingOpenApproval.id, reason: "existing_approval" };
  }

  const approval = await tx.case_approvals.create({
    data: {
      case_id: context.caseId,
      flow_node_key: nodeKey,
      approval_label: String(config.label ?? config.title ?? node.name ?? "Approval required"),
      requested_from_user_id: Number(config.requestedFromUserId ?? config.requested_from_user_id) || null,
      requested_from_role_id: Number(config.requestedFromRoleId ?? config.requested_from_role_id) || null,
      requested_from_team_id: Number(config.requestedFromTeamId ?? config.requested_from_team_id ?? config.assignedTeamId) || null,
      due_at: parseDueAt(config),
      required_comment: Boolean(config.requiredComment ?? config.required_comment),
    },
  });

  await tx.cases.update({
    where: { id: context.caseId },
    data: {
      status: "pending_approval",
      current_node_key: getNodeKey(node),
      current_task_id: null,
    },
  });

  await tx.case_events.create({
    data: {
      case_id: context.caseId,
      flow_node_key: getNodeKey(node),
      actor_user_id: context.actorUserId ?? null,
      event_type: "approval_requested",
      summary: `Approval requested: ${approval.approval_label}`,
      data_json: toInputJson({ approvalId: approval.id }),
    },
  });

  return { blocked: true, approvalId: approval.id };
}

async function recordNonBlockingNode(tx: Prisma.TransactionClient, context: RuntimeContext, node: RuntimeNode) {
  const isAutomation = node.kind === "http" || node.kind === "email" || node.kind === "integration";
  const eventType = isAutomation ? "automation_requested" : "status_updated";
  const config = getNodeConfig(node);
  const correlationId = isAutomation ? String(config.correlationId ?? config.correlation_id ?? crypto.randomUUID()) : null;

  await tx.case_events.create({
    data: {
      case_id: context.caseId,
      flow_node_key: getNodeKey(node),
      actor_user_id: context.actorUserId ?? null,
      event_type: eventType,
      summary: isAutomation ? `Automation requested: ${node.name ?? node.kind}` : `Runtime visited ${node.name ?? node.kind}`,
      data_json: toInputJson({ nodeKind: node.kind, nodeConfig: config, correlationId }),
    },
  });
}

async function applyRouting(tx: Prisma.TransactionClient, context: RuntimeContext, node: RuntimeNode) {
  const config = getNodeConfig(node);
  const assigneeUserId = Number(config.assignedUserId ?? config.assigned_user_id) || null;
  const assigneeTeamId = Number(config.assignedTeamId ?? config.assigned_team_id) || null;

  await tx.cases.update({
    where: { id: context.caseId },
    data: {
      current_node_key: getNodeKey(node),
      assignee_user_id: assigneeUserId,
      assignee_team_id: assigneeTeamId,
    },
  });

  await tx.case_events.create({
    data: {
      case_id: context.caseId,
      flow_node_key: getNodeKey(node),
      actor_user_id: context.actorUserId ?? null,
      event_type: "status_updated",
      summary: "Case assignment updated",
      data_json: toInputJson({ assigneeUserId, assigneeTeamId }),
    },
  });
}

async function applyStatusUpdate(tx: Prisma.TransactionClient, context: RuntimeContext, node: RuntimeNode) {
  const config = getNodeConfig(node);
  const status = typeof config.status === "string" ? config.status : null;
  const allowedStatuses = new Set(["intake", "in_review", "pending_approval", "pending_action", "escalated", "resolved", "closed", "cancelled"]);
  const data: Prisma.casesUpdateInput = {
    current_node_key: getNodeKey(node),
    ...(config.outcome !== undefined && { outcome_json: toInputJson({ outcome: config.outcome }) }),
  };

  if (status && allowedStatuses.has(status)) {
    data.status = status as never;
    if (status === "resolved") data.resolved_at = new Date();
    if (status === "closed") data.closed_at = new Date();
  }

  await tx.cases.update({ where: { id: context.caseId }, data });
  await tx.case_events.create({
    data: {
      case_id: context.caseId,
      flow_node_key: getNodeKey(node),
      actor_user_id: context.actorUserId ?? null,
      event_type: status === "resolved" ? "case_resolved" : "status_updated",
      summary: status ? `Case status updated to ${status}` : "Case metadata updated",
      data_json: toInputJson({ status, outcome: config.outcome }),
    },
  });

  return status && ["resolved", "closed", "cancelled"].includes(status) ? status : null;
}

async function applyEscalation(tx: Prisma.TransactionClient, context: RuntimeContext, node: RuntimeNode) {
  const config = getNodeConfig(node);
  const escalation = await tx.case_escalations.create({
    data: {
      case_id: context.caseId,
      flow_node_key: getNodeKey(node),
      escalation_type: String(config.escalationType ?? config.escalation_type ?? "runtime"),
      reason: String(config.reason ?? node.name ?? "Case escalated"),
      from_user_id: context.actorUserId ?? null,
      to_user_id: Number(config.toUserId ?? config.to_user_id) || null,
      to_team_id: Number(config.toTeamId ?? config.to_team_id) || null,
    },
  });

  await tx.cases.update({
    where: { id: context.caseId },
    data: {
      status: "escalated",
      current_node_key: getNodeKey(node),
      assignee_user_id: escalation.to_user_id,
      assignee_team_id: escalation.to_team_id,
    },
  });

  await tx.case_events.create({
    data: {
      case_id: context.caseId,
      flow_node_key: getNodeKey(node),
      actor_user_id: context.actorUserId ?? null,
      event_type: "escalation_triggered",
      summary: escalation.reason,
      data_json: toInputJson({ escalationId: escalation.id }),
    },
  });

  return escalation;
}

async function runFromNode(tx: Prisma.TransactionClient, context: RuntimeContext, graph: RuntimeGraph, startNode: RuntimeNode | null) {
  let node = startNode;
  const visited = new Set<string>();

  while (node) {
    const nodeKey = getNodeKey(node);
    if (!nodeKey || visited.has(nodeKey)) {
      await tx.case_events.create({
        data: {
          case_id: context.caseId,
          actor_user_id: context.actorUserId ?? null,
          event_type: "automation_failed",
          summary: "Runtime stopped because the flow graph contains a loop or invalid node",
          data_json: toInputJson({ nodeKey }),
        },
      });
      return { blocked: false, reason: "invalid_graph" };
    }

    visited.add(nodeKey);

    if (node.kind === "approval") {
      return createApproval(tx, context, node);
    }

    if (blockingTaskKinds.has(node.kind)) {
      return createBlockingTask(tx, context, node);
    }

    if (node.kind === "condition" || node.kind === "decision") {
      const outcome = context.decision ?? evaluateCondition(getNodeConfig(node), context.data ?? {});
      await tx.case_events.create({
        data: {
          case_id: context.caseId,
          flow_node_key: nodeKey,
          actor_user_id: context.actorUserId ?? null,
          event_type: "status_updated",
          summary: `Branch evaluated${outcome ? `: ${outcome}` : ""}`,
          data_json: toInputJson({ outcome, nodeConfig: getNodeConfig(node) }),
        },
      });
      node = chooseNextNode(graph, nodeKey, outcome);
      continue;
    }

    if (node.kind === "routing") {
      await applyRouting(tx, context, node);
      node = chooseNextNode(graph, nodeKey, context.decision);
      continue;
    }

    if (node.kind === "status_update") {
      const terminalStatus = await applyStatusUpdate(tx, context, node);
      if (terminalStatus) {
        return { blocked: false, reason: terminalStatus };
      }
      node = chooseNextNode(graph, nodeKey, context.decision);
      continue;
    }

    if (node.kind === "escalation") {
      const escalation = await applyEscalation(tx, context, node);
      const nextNode = chooseNextNode(graph, nodeKey, context.decision);
      if (!nextNode) {
        return { blocked: true, escalationId: escalation.id, reason: "escalated" };
      }
      node = nextNode;
      continue;
    }

    if (!nonBlockingKinds.has(node.kind)) {
      return createBlockingTask(tx, context, { ...node, kind: "review" });
    }

    await recordNonBlockingNode(tx, context, node);
    node = chooseNextNode(graph, nodeKey, context.decision);
  }

  await tx.cases.update({
    where: { id: context.caseId },
    data: {
      status: "resolved",
      current_node_key: null,
      current_task_id: null,
      resolved_at: new Date(),
    },
  });

  await tx.case_events.create({
    data: {
      case_id: context.caseId,
      actor_user_id: context.actorUserId ?? null,
      event_type: "case_resolved",
      summary: "Case runtime completed",
    },
  });

  return { blocked: false, reason: "completed" };
}

export async function startCaseRuntime(caseId: number, actorUserId?: number | null) {
  return prisma.$transaction(async (tx) => {
    const caseRecord = await tx.cases.findUnique({ where: { id: caseId } });
    if (!caseRecord) return null;
    if (["closed", "cancelled", "resolved"].includes(caseRecord.status)) {
      return { blocked: false, reason: "case_not_active" };
    }

    const graph = normalizeGraph(caseRecord.flow_snapshot_json);
    return runFromNode(tx, { caseId, actorUserId, data: asObject(caseRecord.case_data_json) }, graph, getEntryNode(graph));
  });
}

export async function advanceCaseRuntimeFromNode(
  caseId: number,
  fromNodeKey: string,
  actorUserId?: number | null,
  decision?: string | null
) {
  return prisma.$transaction(async (tx) => {
    const caseRecord = await tx.cases.findUnique({ where: { id: caseId } });
    if (!caseRecord) return null;
    if (["closed", "cancelled", "resolved"].includes(caseRecord.status)) {
      return { blocked: false, reason: "case_not_active" };
    }
    if (caseRecord.current_node_key !== fromNodeKey) {
      await tx.case_events.create({
        data: {
          case_id: caseId,
          flow_node_key: fromNodeKey,
          actor_user_id: actorUserId ?? null,
          event_type: "automation_failed",
          summary: "Runtime advance rejected because the source node is stale",
          data_json: toInputJson({ expectedNodeKey: caseRecord.current_node_key, fromNodeKey }),
        },
      });
      return { blocked: false, reason: "stale_node" };
    }

    const graph = normalizeGraph(caseRecord.flow_snapshot_json);
    const nextNode = chooseNextNode(graph, fromNodeKey, decision);
    return runFromNode(tx, { caseId, actorUserId, data: asObject(caseRecord.case_data_json), decision }, graph, nextNode);
  });
}
