export type DemoNode = {
  node_key: string;
  kind: string;
  name: string;
  config_json: Record<string, unknown>;
  pos_x: number;
  pos_y: number;
};

export type DemoEdge = {
  edge_key: string;
  from_node_key: string;
  to_node_key: string;
  label?: string | null;
  priority?: number;
};

export type DemoFlowDefinition = {
  key: string;
  name: string;
  description: string;
  caseType: string;
  ownerUserId: number;
  nodes: DemoNode[];
  edges: DemoEdge[];
};

type DemoFlowFixtureIds = {
  adminUserId: number;
  designerUserId: number;
  amlTeamId: number;
  paymentsTeamId: number;
  treasuryTeamId: number;
};

export const buildDemoFlowFixtures = ({
  adminUserId,
  designerUserId,
  amlTeamId,
  paymentsTeamId,
  treasuryTeamId,
}: DemoFlowFixtureIds): DemoFlowDefinition[] => [
  {
    key: 'aml-alert-review',
    name: 'AML Alert Review',
    description: 'Review AML alerts, collect evidence, and request supervisor approval when needed.',
    caseType: 'aml_alert',
    ownerUserId: adminUserId,
    nodes: [
      { node_key: 'start', kind: 'trigger', name: 'Alert received', config_json: {}, pos_x: 0, pos_y: 0 },
      {
        node_key: 'analyst-review',
        kind: 'review',
        name: 'Analyst review',
        config_json: { title: 'Review AML alert', assignedTeamId: amlTeamId, claimPolicy: 'claim_required', dueInHours: 8 },
        pos_x: 220,
        pos_y: 0,
      },
      {
        node_key: 'supervisor-approval',
        kind: 'approval',
        name: 'Supervisor approval',
        config_json: { label: 'Approve AML disposition', requestedFromTeamId: paymentsTeamId, requiredComment: true, dueInHours: 24 },
        pos_x: 440,
        pos_y: 0,
      },
      {
        node_key: 'approved-status',
        kind: 'status_update',
        name: 'Mark reviewed',
        config_json: { status: 'resolved', outcome: 'cleared' },
        pos_x: 660,
        pos_y: -80,
      },
      {
        node_key: 'rejected-escalation',
        kind: 'escalation',
        name: 'Escalate rejection',
        config_json: { reason: 'Supervisor rejected AML disposition', toTeamId: paymentsTeamId },
        pos_x: 660,
        pos_y: 100,
      },
    ],
    edges: [
      { edge_key: 'e-start-review', from_node_key: 'start', to_node_key: 'analyst-review' },
      { edge_key: 'e-review-approval', from_node_key: 'analyst-review', to_node_key: 'supervisor-approval' },
      { edge_key: 'e-approval-approved', from_node_key: 'supervisor-approval', to_node_key: 'approved-status', label: 'approved', priority: 0 },
      { edge_key: 'e-approval-rejected', from_node_key: 'supervisor-approval', to_node_key: 'rejected-escalation', label: 'rejected', priority: 1 },
    ],
  },
  {
    key: 'payment-exception-review',
    name: 'Payment Exception Review',
    description: 'Handle payment exceptions with document evidence and operations routing.',
    caseType: 'payment_exception',
    ownerUserId: adminUserId,
    nodes: [
      { node_key: 'start', kind: 'trigger', name: 'Exception received', config_json: {}, pos_x: 0, pos_y: 0 },
      {
        node_key: 'collect-documents',
        kind: 'document_collection',
        name: 'Collect payment evidence',
        config_json: {
          title: 'Collect payment evidence',
          assignedTeamId: paymentsTeamId,
          claimPolicy: 'claim_required',
          requiredDocuments: ['payment_instruction'],
          dueInHours: 12,
        },
        pos_x: 220,
        pos_y: 0,
      },
      {
        node_key: 'ops-review',
        kind: 'review',
        name: 'Operations review',
        config_json: { title: 'Resolve payment exception', assignedTeamId: paymentsTeamId, claimPolicy: 'claim_required', dueInHours: 12 },
        pos_x: 440,
        pos_y: 0,
      },
      {
        node_key: 'notify',
        kind: 'notification',
        name: 'Notify requester',
        config_json: { channel: 'email', template: 'payment_exception_resolved' },
        pos_x: 660,
        pos_y: 0,
      },
    ],
    edges: [
      { edge_key: 'e-start-docs', from_node_key: 'start', to_node_key: 'collect-documents' },
      { edge_key: 'e-docs-review', from_node_key: 'collect-documents', to_node_key: 'ops-review' },
      { edge_key: 'e-review-notify', from_node_key: 'ops-review', to_node_key: 'notify' },
    ],
  },
  {
    key: 'high-value-payment-release',
    name: 'High-Value Payment Release',
    description: 'Govern high-value payment release with evidence collection, treasury review, value-based approval, and rejection escalation.',
    caseType: 'high_value_payment',
    ownerUserId: designerUserId,
    nodes: [
      { node_key: 'start', kind: 'trigger', name: 'Payment submitted', config_json: {}, pos_x: 0, pos_y: 0 },
      {
        node_key: 'collect-release-evidence',
        kind: 'document_collection',
        name: 'Collect release evidence',
        config_json: {
          title: 'Collect payment instruction, sanctions screen, and customer mandate',
          assignedTeamId: paymentsTeamId,
          claimPolicy: 'claim_required',
          requiredDocuments: ['payment_instruction', 'sanctions_screen', 'customer_mandate'],
          dueInHours: 4,
        },
        pos_x: 220,
        pos_y: 0,
      },
      {
        node_key: 'treasury-control-review',
        kind: 'review',
        name: 'Treasury control review',
        config_json: {
          title: 'Validate funding, beneficiary, and correspondent route',
          assignedTeamId: treasuryTeamId,
          claimPolicy: 'claim_required',
          dueInHours: 3,
        },
        pos_x: 460,
        pos_y: 0,
      },
      {
        node_key: 'value-threshold',
        kind: 'condition',
        name: 'Payment exceeds approval threshold?',
        config_json: {
          field: 'amountBhd',
          operator: 'gte',
          value: 100000,
          trueOutcome: 'approval_required',
          falseOutcome: 'straight_through',
        },
        pos_x: 700,
        pos_y: 0,
      },
      {
        node_key: 'release-approval',
        kind: 'approval',
        name: 'Senior release approval',
        config_json: {
          label: 'Approve high-value payment release',
          requestedFromTeamId: treasuryTeamId,
          requiredComment: true,
          dueInHours: 2,
        },
        pos_x: 940,
        pos_y: -110,
      },
      {
        node_key: 'release-payment',
        kind: 'status_update',
        name: 'Release payment',
        config_json: { status: 'resolved', outcome: 'payment_released' },
        pos_x: 1180,
        pos_y: -20,
      },
      {
        node_key: 'approval-rework',
        kind: 'escalation',
        name: 'Escalate rejected release',
        config_json: {
          escalationType: 'release_rework',
          reason: 'Senior approver rejected payment release; treasury rework required before resubmission.',
          toTeamId: treasuryTeamId,
        },
        pos_x: 1180,
        pos_y: 130,
      },
    ],
    edges: [
      { edge_key: 'e-start-evidence', from_node_key: 'start', to_node_key: 'collect-release-evidence' },
      { edge_key: 'e-evidence-review', from_node_key: 'collect-release-evidence', to_node_key: 'treasury-control-review' },
      { edge_key: 'e-review-threshold', from_node_key: 'treasury-control-review', to_node_key: 'value-threshold' },
      { edge_key: 'e-threshold-approval', from_node_key: 'value-threshold', to_node_key: 'release-approval', label: 'approval_required', priority: 0 },
      { edge_key: 'e-threshold-release', from_node_key: 'value-threshold', to_node_key: 'release-payment', label: 'straight_through', priority: 1 },
      { edge_key: 'e-approval-release', from_node_key: 'release-approval', to_node_key: 'release-payment', label: 'approved', priority: 0 },
      { edge_key: 'e-approval-rework', from_node_key: 'release-approval', to_node_key: 'approval-rework', label: 'rejected', priority: 1 },
    ],
  },
];
