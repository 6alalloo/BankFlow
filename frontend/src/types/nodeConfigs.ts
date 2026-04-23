/**
 * Node Configuration Type Definitions
 *
 * These interfaces define the configuration structure for each node type
 * in the HRFlow workflow builder.
 */

// Trigger Node - Entry point for workflows
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

// CV Parser Node - Resume/CV data extraction
export interface CvParserNodeConfig {
  fileSource: string;
  extractFields: ('name' | 'email' | 'phone' | 'skills' | 'experience')[];
}

// Wait/Delay Node - Pause workflow execution
export interface WaitNodeConfig {
  duration: number;
  unit: 'seconds' | 'minutes' | 'hours';
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

// Union type for all node configs
export type NodeConfig =
  | TriggerNodeConfig
  | HttpNodeConfig
  | DatabaseNodeConfig
  | ConditionNodeConfig
  | CvParserNodeConfig
  | WaitNodeConfig
  | LoggerNodeConfig
  | DateTimeNodeConfig
  | VariableNodeConfig
  | EmailNodeConfig;

// Node kind type
export type NodeKind =
  | 'trigger'
  | 'http'
  | 'email'
  | 'database'
  | 'condition'
  | 'cv_parser'
  | 'wait'
  | 'logger'
  | 'datetime'
  | 'variable';

// Default configurations for new nodes
export const DEFAULT_NODE_CONFIGS: Record<NodeKind, Partial<NodeConfig>> = {
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
  cv_parser: {
    fileSource: '{{trigger.cvFile}}',
    extractFields: ['name', 'email', 'phone', 'skills', 'experience'],
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
};

// Operator labels for Condition node
export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];

// CV Parser available fields
export const CV_PARSER_FIELDS = [
  { value: 'name', label: 'Full Name' },
  { value: 'email', label: 'Email Address' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'skills', label: 'Skills' },
  { value: 'experience', label: 'Experience' },
];
