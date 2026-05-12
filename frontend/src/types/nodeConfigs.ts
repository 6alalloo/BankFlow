/**
 * Node Configuration Type Definitions
 *
 * These interfaces define the configuration structure for each node type
 * in the BankFlow flow builder.
 */

// Trigger Node - Entry point for flows
export interface TriggerNodeConfig {
  name?: string;
  email?: string;
  department?: string;
  role?: string;
  startDate?: string;
  managerEmail?: string;
}

// HTTP Request Node - External API calls
export interface HttpNodeConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers: { key: string; value: string }[];
  body?: string;
}

// Database Node - Database operations
export interface DatabaseNodeConfig {
  operation: 'create' | 'update' | 'query';
  table: string;
  fields: { key: string; value: string }[];
  whereClause?: string;
}

// Condition Node - Branching logic
export interface ConditionNodeConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value: string;
}

// Wait/Delay Node - Pause flow execution
export interface WaitNodeConfig {
  duration: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
}

// Logger Node - Debug logging
export interface LoggerNodeConfig {
  message: string;
  level: 'info' | 'warn' | 'error';
}

// DateTime Node - Date/time operations
export interface DateTimeNodeConfig {
  operation: 'add' | 'subtract' | 'format' | 'now';
  value?: number;
  unit?: 'days' | 'hours' | 'minutes';
  format?: string;
  inputField?: string;
  outputField?: string;
}

// Variable Node - Store and manipulate data
export interface VariableNodeConfig {
  variables: { key: string; value: string }[];
}

// Email Node - Send email notifications
export interface EmailNodeConfig {
  to: string;
  subject: string;
  body: string;
}

export interface AssignmentNodeConfig {
  title?: string;
  assignedUserId?: number | null;
  assignedTeamId?: number | null;
  assignedRoleId?: number | null;
  claimPolicy?: 'claim_required' | 'direct_assign';
  dueInHours?: number;
}

export interface ApprovalNodeConfig {
  label?: string;
  requestedFromUserId?: number | null;
  requestedFromRoleId?: number | null;
  requestedFromTeamId?: number | null;
  requiredComment?: boolean;
  dueInHours?: number;
}

export interface RoutingNodeConfig {
  assignedUserId?: number | null;
  assignedTeamId?: number | null;
}

export interface SlaNodeConfig {
  dueInHours?: number;
}

export interface EscalationNodeConfig {
  escalationType?: string;
  reason?: string;
  toUserId?: number | null;
  toTeamId?: number | null;
}

export interface StatusUpdateNodeConfig {
  status?: 'intake' | 'in_review' | 'pending_approval' | 'pending_action' | 'escalated' | 'resolved' | 'closed' | 'cancelled';
  outcome?: string;
}

// Union type for all node configs
export type NodeConfig =
  | TriggerNodeConfig
  | HttpNodeConfig
  | DatabaseNodeConfig
  | ConditionNodeConfig
  | WaitNodeConfig
  | LoggerNodeConfig
  | DateTimeNodeConfig
  | VariableNodeConfig
  | EmailNodeConfig
  | AssignmentNodeConfig
  | ApprovalNodeConfig
  | RoutingNodeConfig
  | SlaNodeConfig
  | EscalationNodeConfig
  | StatusUpdateNodeConfig;

// Node kind type
export type NodeKind =
  | 'trigger'
  | 'http'
  | 'email'
  | 'database'
  | 'condition'
  | 'wait'
  | 'logger'
  | 'datetime'
  | 'variable'
  | 'intake'
  | 'review'
  | 'data_capture'
  | 'document_collection'
  | 'approval'
  | 'approval_support'
  | 'decision'
  | 'decision_followup'
  | 'routing'
  | 'sla'
  | 'timer'
  | 'escalation'
  | 'escalation_followup'
  | 'status_update'
  | 'notification'
  | 'integration';

// Default configurations for new nodes
export const DEFAULT_NODE_CONFIGS: Record<NodeKind, Record<string, unknown>> = {
  trigger: {
    name: '',
    email: '',
    department: '',
    role: '',
    startDate: '',
    managerEmail: '',
  },
  http: {
    method: 'GET',
    url: '',
    headers: [],
    body: '',
  },
  email: {
    to: '',
    subject: '',
    body: '',
  },
  database: {
    operation: 'query',
    table: '',
    fields: [],
    whereClause: '',
  },
  condition: {
    field: '',
    operator: 'equals',
    value: '',
  },
  wait: {
    duration: 30,
    unit: 'seconds',
  },
  logger: {
    message: '',
    level: 'info',
  },
  datetime: {
    operation: 'now',
    value: 0,
    unit: 'days',
    format: 'YYYY-MM-DD',
    inputField: '',
    outputField: 'formattedDate',
  },
  variable: {
    variables: [],
  },
  intake: {},
  review: {
    title: 'Review case',
    assignedTeamId: null,
    claimPolicy: 'claim_required',
  },
  data_capture: {
    title: 'Capture case data',
    assignedTeamId: null,
    claimPolicy: 'claim_required',
  },
  document_collection: {
    title: 'Collect documents',
    assignedTeamId: null,
    claimPolicy: 'claim_required',
  },
  approval: {
    label: 'Approval required',
    requestedFromTeamId: null,
    requiredComment: false,
  },
  approval_support: {
    title: 'Prepare approval',
    assignedTeamId: null,
    claimPolicy: 'claim_required',
  },
  decision: {
    field: '',
    operator: 'equals',
    value: '',
    trueOutcome: 'true',
    falseOutcome: 'false',
  },
  decision_followup: {
    title: 'Follow up on decision',
    assignedTeamId: null,
    claimPolicy: 'claim_required',
  },
  routing: {
    assignedUserId: null,
    assignedTeamId: null,
  },
  sla: {
    dueInHours: 8,
  },
  timer: {
    dueInHours: 8,
  },
  escalation: {
    escalationType: 'runtime',
    reason: 'Case escalated',
    toTeamId: null,
  },
  escalation_followup: {
    title: 'Resolve escalation',
    assignedTeamId: null,
    claimPolicy: 'claim_required',
  },
  status_update: {
    status: 'in_review',
  },
  notification: {
    to: '',
    subject: '',
    body: '',
  },
  integration: {
    method: 'POST',
    url: '',
    headers: [],
    body: '',
  },
};

// Operator labels for Condition node
export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'less_than', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
  { value: 'exists', label: 'Exists' },
];
