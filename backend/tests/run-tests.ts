import assert from "node:assert/strict";
import { validateDraftFlowGraph } from "../src/services/flowValidationService";
import { evaluateCondition } from "../src/services/caseRuntimeService";
import { canPublishFlow, canAdminister, canViewAllOperationalQueues, canViewAudit } from "../src/services/authorizationService";
import { parseBoolean, parseDate, parseNumber, parsePageQuery } from "../src/lib/query";

const graph = (nodes: any[], edges: any[]) => ({ nodes, edges });

const validBaseGraph = graph(
  [
    { node_key: "start", kind: "trigger", name: "Start", config_json: {} },
    {
      node_key: "review",
      kind: "review",
      name: "Review",
      config_json: { assignedTeamId: 1, claimPolicy: "claim_required" },
    },
  ],
  [{ edge_key: "e1", from_node_key: "start", to_node_key: "review", label: null, priority: 0 }]
);

{
  const result = validateDraftFlowGraph(validBaseGraph);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
}

{
  const result = validateDraftFlowGraph(
    graph(
      [
        { node_key: "start", kind: "trigger", name: "Start", config_json: {} },
        { node_key: "sla", kind: "sla", name: "Eight hour SLA", config_json: { dueInHours: 8 } },
        {
          node_key: "review",
          kind: "review",
          name: "Review",
          config_json: { assignedTeamId: 1, claimPolicy: "claim_required" },
        },
      ],
      [
        { edge_key: "e1", from_node_key: "start", to_node_key: "sla", label: null, priority: 0 },
        { edge_key: "e2", from_node_key: "sla", to_node_key: "review", label: null, priority: 0 },
      ]
    )
  );
  assert.equal(result.valid, true, JSON.stringify(result.issues));
}

{
  const result = validateDraftFlowGraph(
    graph(
      [
        { node_key: "intake", kind: "intake", name: "Intake", config_json: {} },
        {
          node_key: "review",
          kind: "review",
          name: "Review",
          config_json: { assignedTeamId: 1, claimPolicy: "claim_required" },
        },
      ],
      [{ edge_key: "e1", from_node_key: "intake", to_node_key: "review", label: null, priority: 0 }]
    )
  );
  assert.equal(result.valid, true, JSON.stringify(result.issues));
}

{
  const result = validateDraftFlowGraph(
    graph(
      [
        { node_key: "start", kind: "trigger", name: "Start", config_json: {} },
        { node_key: "database", kind: "database", name: "Database", config_json: { operation: "query" } },
        { node_key: "variable", kind: "variable", name: "Set Variable", config_json: { variables: [] } },
        { node_key: "wait", kind: "wait", name: "Wait", config_json: { duration: 15, unit: "minutes" } },
        { node_key: "datetime", kind: "datetime", name: "Date Time", config_json: { operation: "now" } },
        {
          node_key: "approval-prep",
          kind: "approval_support",
          name: "Approval Prep",
          config_json: { title: "Prepare approval package", claimPolicy: "claim_required" },
        },
      ],
      [
        { edge_key: "e1", from_node_key: "start", to_node_key: "database", label: null, priority: 0 },
        { edge_key: "e2", from_node_key: "database", to_node_key: "variable", label: null, priority: 0 },
        { edge_key: "e3", from_node_key: "variable", to_node_key: "wait", label: null, priority: 0 },
        { edge_key: "e4", from_node_key: "wait", to_node_key: "datetime", label: null, priority: 0 },
        { edge_key: "e5", from_node_key: "datetime", to_node_key: "approval-prep", label: null, priority: 0 },
      ]
    )
  );
  assert.equal(result.valid, true, JSON.stringify(result.issues));
}

{
  const result = validateDraftFlowGraph(
    graph(
      [
        { node_key: "start", kind: "trigger", name: "Start", config_json: {} },
        { node_key: "custom", kind: "unsupported", name: "Custom", config_json: {} },
      ],
      [{ edge_key: "e1", from_node_key: "start", to_node_key: "custom", label: null, priority: 0 }]
    )
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "unsupported_node_kind"));
}

{
  const result = validateDraftFlowGraph(
    graph(
      [
        { node_key: "start", kind: "trigger", name: "Start", config_json: {} },
        { node_key: "review", kind: "review", name: "Review", config_json: {} },
      ],
      [{ edge_key: "e1", from_node_key: "start", to_node_key: "review", label: null, priority: 0 }]
    )
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "assignment_target_required"));
}

{
  const result = validateDraftFlowGraph(
    graph(
      [
        { node_key: "start", kind: "trigger", name: "Start", config_json: {} },
        { node_key: "decision", kind: "decision", name: "Decision", config_json: {} },
        { node_key: "a", kind: "logger", name: "A", config_json: {} },
        { node_key: "b", kind: "logger", name: "B", config_json: {} },
      ],
      [
        { edge_key: "e1", from_node_key: "start", to_node_key: "decision", label: null, priority: 0 },
        { edge_key: "e2", from_node_key: "decision", to_node_key: "a", label: "approved", priority: 0 },
        { edge_key: "e3", from_node_key: "decision", to_node_key: "b", label: null, priority: 1 },
      ]
    )
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "branch_edge_label_required"));
}

{
  const result = validateDraftFlowGraph(
    graph(
      [
        { node_key: "start", kind: "trigger", name: "Start", config_json: {} },
        { node_key: "approval", kind: "approval", name: "Approval", config_json: {} },
      ],
      [{ edge_key: "e1", from_node_key: "start", to_node_key: "approval", label: null, priority: 0 }]
    )
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "approval_target_required"));
}

{
  const result = validateDraftFlowGraph(
    graph(
      [
        { node_key: "start", kind: "trigger", name: "Start", config_json: {} },
        {
          node_key: "decision",
          kind: "decision",
          name: "Decision",
          config_json: { trueOutcome: "approve", falseOutcome: "reject" },
        },
        { node_key: "a", kind: "logger", name: "A", config_json: {} },
        { node_key: "b", kind: "logger", name: "B", config_json: {} },
      ],
      [
        { edge_key: "e1", from_node_key: "start", to_node_key: "decision", label: null, priority: 0 },
        { edge_key: "e2", from_node_key: "decision", to_node_key: "a", label: "approve", priority: 0 },
        { edge_key: "e3", from_node_key: "decision", to_node_key: "b", label: "manual", priority: 1 },
      ]
    )
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "branch_outcome_edge_missing"));
}

{
  const result = validateDraftFlowGraph(
    graph(
      [
        { node_key: "start", kind: "trigger", name: "Start", config_json: {} },
        {
          node_key: "docs",
          kind: "document_collection",
          name: "Documents",
          config_json: { assignedTeamId: 1, requiredDocuments: [""] },
        },
      ],
      [{ edge_key: "e1", from_node_key: "start", to_node_key: "docs", label: null, priority: 0 }]
    )
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "document_requirements_invalid"));
}

{
  const result = validateDraftFlowGraph(
    graph(
      [
        { node_key: "start", kind: "trigger", name: "Start", config_json: {} },
        { node_key: "escalate", kind: "escalation", name: "Escalate", config_json: { reason: "Needs help" } },
      ],
      [{ edge_key: "e1", from_node_key: "start", to_node_key: "escalate", label: null, priority: 0 }]
    )
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "escalation_target_required"));
}

{
  const result = validateDraftFlowGraph(
    graph(
      [
        { node_key: "start", kind: "trigger", name: "Start", config_json: {} },
        { node_key: "status", kind: "status_update", name: "Status", config_json: { status: "waiting" } },
      ],
      [{ edge_key: "e1", from_node_key: "start", to_node_key: "status", label: null, priority: 0 }]
    )
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "status_update_invalid_status"));
}

{
  assert.equal(canPublishFlow("Admin"), true);
  assert.equal(canPublishFlow("Designer"), true);
  assert.equal(canPublishFlow("Operator"), false);
  assert.equal(canAdminister("Admin"), true);
  assert.equal(canAdminister("Auditor"), false);
  assert.equal(canViewAllOperationalQueues("Supervisor"), true);
  assert.equal(canViewAllOperationalQueues("Operator"), false);
  assert.equal(canViewAudit("Auditor"), true);
  assert.equal(canViewAudit("Operator"), false);
}

{
  assert.equal(parseNumber("42"), 42);
  assert.equal(parseNumber("4.2"), undefined);
  assert.equal(parseBoolean("true"), true);
  assert.equal(parseBoolean("false"), false);
  assert.ok(parseDate("2026-05-03") instanceof Date);

  const page = parsePageQuery({ query: { page: "2", pageSize: "500" } } as never);
  assert.deepEqual(page, { page: 2, pageSize: 100, skip: 100, take: 100 });
}

{
  assert.equal(
    evaluateCondition(
      { field: "risk.score", operator: "gte", value: 80, trueOutcome: "high", falseOutcome: "normal" },
      { risk: { score: 95 } }
    ),
    "high"
  );
  assert.equal(
    evaluateCondition(
      { field: "customer.country", operator: "equals", value: "BH", trueOutcome: "local", falseOutcome: "foreign" },
      { customer: { country: "US" } }
    ),
    "foreign"
  );
  assert.equal(
    evaluateCondition(
      { field: "documents.paymentInstruction", operator: "exists", trueOutcome: "ready", falseOutcome: "missing" },
      { documents: { paymentInstruction: "doc-1" } }
    ),
    "ready"
  );
  assert.equal(evaluateCondition({ operator: "equals", value: true }, { approved: true }), null);
}

console.log("Backend authorization/query tests passed");
console.log("Backend unit tests passed");
