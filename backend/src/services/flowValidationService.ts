type DraftNode = {
  node_key: string;
  kind: string;
  name: string | null;
  config_json?: unknown;
};

type DraftEdge = {
  edge_key: string;
  from_node_key: string;
  to_node_key: string;
  label: string | null;
  priority: number;
};

type DraftGraph = {
  nodes: DraftNode[];
  edges: DraftEdge[];
};

export type FlowValidationIssue = {
  code: string;
  message: string;
  nodeKey?: string;
  edgeKey?: string;
};

export type FlowValidationResult = {
  valid: boolean;
  issues: FlowValidationIssue[];
};

const getNodeLabel = (node: DraftNode): string => node.name || node.kind || node.node_key;

const supportedNodeKinds = new Set([
  "trigger",
  "intake",
  "review",
  "data_capture",
  "approval",
  "decision",
  "condition",
  "routing",
  "document_collection",
  "notification",
  "logger",
  "status_update",
  "wait",
  "variable",
  "database",
  "datetime",
  "approval_support",
  "timer",
  "sla",
  "escalation",
  "integration",
  "email",
  "http",
]);

const assignmentKinds = new Set(["review", "data_capture", "document_collection", "routing", "approval_support"]);
const branchKinds = new Set(["condition", "decision"]);
const caseStatuses = new Set(["intake", "in_review", "pending_approval", "pending_action", "escalated", "resolved", "closed", "cancelled"]);

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const hasAny = (config: Record<string, unknown>, keys: string[]) =>
  keys.some((key) => config[key] !== undefined && config[key] !== null && config[key] !== "");

const isPositiveNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
};

const getConfiguredOutcomes = (config: Record<string, unknown>): string[] => {
  if (Array.isArray(config.outcomes)) {
    return config.outcomes
      .map((outcome) => {
        if (typeof outcome === "string") return outcome;
        if (outcome && typeof outcome === "object") {
          const raw = outcome as Record<string, unknown>;
          return String(raw.key ?? raw.label ?? raw.value ?? "");
        }
        return "";
      })
      .filter(Boolean);
  }

  const trueOutcome = config.trueOutcome ?? config.true_outcome;
  const falseOutcome = config.falseOutcome ?? config.false_outcome;
  return [trueOutcome, falseOutcome].filter((outcome): outcome is string => typeof outcome === "string" && outcome.trim().length > 0);
};

const addIssue = (
  issues: FlowValidationIssue[],
  code: string,
  message: string,
  details: Pick<FlowValidationIssue, "nodeKey" | "edgeKey"> = {}
) => {
  issues.push({ code, message, ...details });
};

const findReachableNodes = (entryNodeKey: string, graph: DraftGraph): Set<string> => {
  const outgoing = new Map<string, DraftEdge[]>();
  for (const edge of graph.edges) {
    outgoing.set(edge.from_node_key, [...(outgoing.get(edge.from_node_key) ?? []), edge]);
  }

  const reachable = new Set<string>();
  const stack = [entryNodeKey];

  while (stack.length > 0) {
    const nodeKey = stack.pop();
    if (!nodeKey || reachable.has(nodeKey)) continue;

    reachable.add(nodeKey);
    for (const edge of outgoing.get(nodeKey) ?? []) {
      stack.push(edge.to_node_key);
    }
  }

  return reachable;
};

const findCycleNodeKeys = (entryNodeKey: string, graph: DraftGraph): Set<string> => {
  const outgoing = new Map<string, DraftEdge[]>();
  for (const edge of graph.edges) {
    outgoing.set(edge.from_node_key, [...(outgoing.get(edge.from_node_key) ?? []), edge]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleNodes = new Set<string>();

  const visit = (nodeKey: string) => {
    if (visiting.has(nodeKey)) {
      cycleNodes.add(nodeKey);
      return;
    }

    if (visited.has(nodeKey)) return;

    visiting.add(nodeKey);
    for (const edge of outgoing.get(nodeKey) ?? []) {
      visit(edge.to_node_key);
      if (cycleNodes.has(edge.to_node_key)) {
        cycleNodes.add(nodeKey);
      }
    }
    visiting.delete(nodeKey);
    visited.add(nodeKey);
  };

  visit(entryNodeKey);
  return cycleNodes;
};

export function validateDraftFlowGraph(graph: DraftGraph): FlowValidationResult {
  const issues: FlowValidationIssue[] = [];

  if (graph.nodes.length === 0) {
    addIssue(issues, "empty_graph", "Cannot publish a flow with no nodes.");
    return { valid: false, issues };
  }

  const nodeKeys = new Set<string>();
  const duplicateNodeKeys = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.node_key) {
      addIssue(issues, "missing_node_key", `Node "${getNodeLabel(node)}" is missing a node key.`);
      continue;
    }

    if (nodeKeys.has(node.node_key)) duplicateNodeKeys.add(node.node_key);
    nodeKeys.add(node.node_key);
  }

  for (const nodeKey of duplicateNodeKeys) {
    addIssue(issues, "duplicate_node_key", `Node key "${nodeKey}" is used more than once.`, { nodeKey });
  }

  const edgeKeys = new Set<string>();
  const duplicateEdgeKeys = new Set<string>();
  const incomingCounts = new Map<string, number>();
  const outgoingCounts = new Map<string, number>();

  for (const edge of graph.edges) {
    if (!edge.edge_key) {
      addIssue(issues, "missing_edge_key", "An edge is missing an edge key.");
    } else if (edgeKeys.has(edge.edge_key)) {
      duplicateEdgeKeys.add(edge.edge_key);
    }
    edgeKeys.add(edge.edge_key);

    if (!nodeKeys.has(edge.from_node_key)) {
      addIssue(issues, "invalid_edge_source", `Edge "${edge.edge_key}" starts from a missing node.`, {
        edgeKey: edge.edge_key,
      });
    }

    if (!nodeKeys.has(edge.to_node_key)) {
      addIssue(issues, "invalid_edge_target", `Edge "${edge.edge_key}" points to a missing node.`, {
        edgeKey: edge.edge_key,
      });
    }

    if (edge.from_node_key === edge.to_node_key) {
      addIssue(issues, "self_loop", `Edge "${edge.edge_key}" points back to the same node.`, {
        nodeKey: edge.from_node_key,
        edgeKey: edge.edge_key,
      });
    }

    incomingCounts.set(edge.to_node_key, (incomingCounts.get(edge.to_node_key) ?? 0) + 1);
    outgoingCounts.set(edge.from_node_key, (outgoingCounts.get(edge.from_node_key) ?? 0) + 1);
  }

  for (const edgeKey of duplicateEdgeKeys) {
    addIssue(issues, "duplicate_edge_key", `Edge key "${edgeKey}" is used more than once.`, { edgeKey });
  }

  const entryNodes = graph.nodes.filter((node) => node.kind === "trigger" || node.kind === "intake");
  if (entryNodes.length !== 1) {
    addIssue(
      issues,
      "invalid_entry_count",
      entryNodes.length === 0
        ? "A published flow must have exactly one Trigger or Intake node."
        : "A published flow can only have one Trigger or Intake node."
    );
  }

  const entryNode = entryNodes[0];
  if (!entryNode) {
    return { valid: false, issues };
  }

  if ((incomingCounts.get(entryNode.node_key) ?? 0) > 0) {
    addIssue(issues, "entry_has_incoming_edge", "The entry node cannot have incoming edges.", {
      nodeKey: entryNode.node_key,
    });
  }

  if (graph.nodes.length > 1 && (outgoingCounts.get(entryNode.node_key) ?? 0) === 0) {
    addIssue(issues, "entry_has_no_outgoing_edge", "The entry node must connect to the next step.", {
      nodeKey: entryNode.node_key,
    });
  }

  const reachable = findReachableNodes(entryNode.node_key, graph);
  for (const node of graph.nodes) {
    if (!reachable.has(node.node_key)) {
      addIssue(issues, "unreachable_node", `Node "${getNodeLabel(node)}" is not reachable from the Trigger node.`, {
        nodeKey: node.node_key,
      });
    }
  }

  const cycleNodeKeys = findCycleNodeKeys(entryNode.node_key, graph);
  for (const nodeKey of cycleNodeKeys) {
    addIssue(issues, "cycle_detected", `The flow contains a cycle involving node "${nodeKey}".`, { nodeKey });
  }

  for (const node of graph.nodes) {
    const outgoingCount = outgoingCounts.get(node.node_key) ?? 0;
    if (!supportedNodeKinds.has(node.kind)) {
      addIssue(
        issues,
        "unsupported_node_kind",
        `Node "${getNodeLabel(node)}" uses unsupported kind "${node.kind}".`,
        { nodeKey: node.node_key }
      );
    }

    const config = asObject(node.config_json);
    if (assignmentKinds.has(node.kind) && !hasAny(config, ["assignedUserId", "assigned_user_id", "assignedTeamId", "assigned_team_id", "assignedRoleId", "assigned_role_id", "claimPolicy", "claim_policy"])) {
      addIssue(
        issues,
        "assignment_target_required",
        `Node "${getNodeLabel(node)}" must assign work to a user, team, role, or claim queue.`,
        { nodeKey: node.node_key }
      );
    }

    if (node.kind === "approval" && !hasAny(config, ["requestedFromUserId", "requested_from_user_id", "requestedFromRoleId", "requested_from_role_id", "requestedFromTeamId", "requested_from_team_id", "assignedTeamId", "assigned_team_id"])) {
      addIssue(
        issues,
        "approval_target_required",
        `Approval node "${getNodeLabel(node)}" must request a user, role, or team decision.`,
        { nodeKey: node.node_key }
      );
    }

    if ((node.kind === "sla" || node.kind === "timer") && !hasAny(config, ["dueInHours", "due_in_hours", "slaHours", "sla_hours", "dueAt", "due_at"])) {
      addIssue(
        issues,
        "sla_due_time_required",
        `SLA node "${getNodeLabel(node)}" must define a due time.`,
        { nodeKey: node.node_key }
      );
    }

    if ((node.kind === "sla" || node.kind === "timer") && hasAny(config, ["dueInHours", "due_in_hours", "slaHours", "sla_hours"])) {
      const value = config.dueInHours ?? config.due_in_hours ?? config.slaHours ?? config.sla_hours;
      if (!isPositiveNumber(value)) {
        addIssue(issues, "sla_due_time_invalid", `SLA node "${getNodeLabel(node)}" must use a positive due-time value.`, {
          nodeKey: node.node_key,
        });
      }
    }

    if (node.kind === "document_collection") {
      const requiredDocuments = config.requiredDocuments ?? config.required_documents;
      if (
        requiredDocuments !== undefined &&
        (!Array.isArray(requiredDocuments) ||
          requiredDocuments.length === 0 ||
          requiredDocuments.some((documentType) => typeof documentType !== "string" || !documentType.trim()))
      ) {
        addIssue(
          issues,
          "document_requirements_invalid",
          `Document collection node "${getNodeLabel(node)}" must use a non-empty list of document type keys.`,
          { nodeKey: node.node_key }
        );
      }
    }

    if (node.kind === "escalation" && !hasAny(config, ["toUserId", "to_user_id", "toTeamId", "to_team_id", "assignedUserId", "assigned_user_id", "assignedTeamId", "assigned_team_id"])) {
      addIssue(
        issues,
        "escalation_target_required",
        `Escalation node "${getNodeLabel(node)}" must target a user or team.`,
        { nodeKey: node.node_key }
      );
    }

    if (node.kind === "status_update") {
      const status = config.status;
      if (status !== undefined && (typeof status !== "string" || !caseStatuses.has(status))) {
        addIssue(
          issues,
          "status_update_invalid_status",
          `Status update node "${getNodeLabel(node)}" uses an unsupported case status.`,
          { nodeKey: node.node_key }
        );
      }
    }

    if (branchKinds.has(node.kind) && outgoingCount < 2) {
      addIssue(
        issues,
        "branch_node_needs_two_edges",
        `Branch node "${getNodeLabel(node)}" needs at least two outgoing edges.`,
        { nodeKey: node.node_key }
      );
    }

    if (branchKinds.has(node.kind)) {
      const outgoingLabels = graph.edges
        .filter((edge) => edge.from_node_key === node.node_key)
        .map((edge) => edge.label?.trim())
        .filter(Boolean);
      if (outgoingLabels.length !== outgoingCount) {
        addIssue(issues, "branch_edge_label_required", `Branch node "${getNodeLabel(node)}" requires labeled outgoing edges.`, {
          nodeKey: node.node_key,
        });
      }

      const labelSet = new Set(outgoingLabels.map((label) => label?.toLowerCase()));
      for (const outcome of getConfiguredOutcomes(config)) {
        if (!labelSet.has(outcome.toLowerCase())) {
          addIssue(
            issues,
            "branch_outcome_edge_missing",
            `Branch node "${getNodeLabel(node)}" has no outgoing edge labeled "${outcome}".`,
            { nodeKey: node.node_key }
          );
        }
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
