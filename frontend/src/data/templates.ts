/**
 * Workflow Templates
 *
 * Starter definitions for the BankFlow fork.
 * These avoid HR-specific onboarding and recruiting scenarios.
 */

export interface TemplateNode {
    id: string;
    kind: string;
    name: string;
    pos_x: number;
    pos_y: number;
    config: Record<string, unknown>;
}

export interface TemplateEdge {
    from: string;
    to: string;
    label?: string;
    condition?: Record<string, unknown>;
}

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    useCase: string;
    category: 'general';
    nodes: TemplateNode[];
    edges: TemplateEdge[];
    requiredConfig: string[];
}

export const templates: WorkflowTemplate[] = [
    {
        id: 'aml-alert-review',
        name: 'AML Alert Review',
        description: 'Route an AML alert through intake, triage, analyst notification, and audit logging.',
        useCase: 'Use this template when a monitoring system raises an alert that needs analyst review and clear case traceability.',
        category: 'general',
        nodes: [
            {
                id: 'trigger-1',
                kind: 'trigger',
                name: 'Alert Intake',
                pos_x: 100,
                pos_y: 200,
                config: {
                    name: '',
                    email: '',
                    department: 'Financial Crime Operations',
                    role: 'Alert Review',
                    startDate: '',
                    managerEmail: '',
                },
            },
            {
                id: 'variable-1',
                kind: 'variable',
                name: 'Set Priority',
                pos_x: 360,
                pos_y: 200,
                config: {
                    variables: [
                        { key: 'caseType', value: 'aml_alert' },
                        { key: 'priority', value: 'high' },
                    ],
                },
            },
            {
                id: 'condition-1',
                kind: 'condition',
                name: 'Check Jurisdiction',
                pos_x: 620,
                pos_y: 200,
                config: {
                    field: '{{trigger.department}}',
                    operator: 'contains',
                    value: 'Financial',
                },
            },
            {
                id: 'email-1',
                kind: 'email',
                name: 'Notify Analyst Queue',
                pos_x: 900,
                pos_y: 120,
                config: {
                    to: 'aml-queue@example.com',
                    subject: 'AML alert ready for review',
                    body: `A new alert has entered the review queue.

Customer: {{trigger.name}}
Contact: {{trigger.email}}
Priority: {{steps.Set Priority.priority}}

Open the case workspace and complete disposition notes.`,
                },
            },
            {
                id: 'logger-1',
                kind: 'logger',
                name: 'Record Audit Event',
                pos_x: 1180,
                pos_y: 120,
                config: {
                    message: 'AML alert case created for {{trigger.name}} with priority {{steps.Set Priority.priority}}',
                    level: 'info',
                },
            },
        ],
        edges: [
            { from: 'trigger-1', to: 'variable-1' },
            { from: 'variable-1', to: 'condition-1' },
            { from: 'condition-1', to: 'email-1', label: 'Route to analyst' },
            { from: 'email-1', to: 'logger-1' },
        ],
        requiredConfig: [
            'Case intake details in the trigger step',
            'SMTP credentials configured in n8n',
            'Queue mailbox or analyst recipient address',
        ],
    },
    {
        id: 'payment-exception-review',
        name: 'Payment Exception Review',
        description: 'Capture a payment exception, notify operations, hold for review, and write an activity log.',
        useCase: 'Use this template when a payment needs manual investigation before release, rejection, or escalation.',
        category: 'general',
        nodes: [
            {
                id: 'trigger-1',
                kind: 'trigger',
                name: 'Exception Intake',
                pos_x: 100,
                pos_y: 220,
                config: {
                    name: '',
                    email: '',
                    department: 'Payments Operations',
                    role: 'Exception Review',
                    startDate: '',
                    managerEmail: '',
                },
            },
            {
                id: 'http-1',
                kind: 'http',
                name: 'Notify Ops API',
                pos_x: 360,
                pos_y: 220,
                config: {
                    method: 'POST',
                    url: '',
                    headers: [
                        { key: 'Content-Type', value: 'application/json' },
                    ],
                    body: JSON.stringify({
                        caseName: '{{trigger.name}}',
                        contactEmail: '{{trigger.email}}',
                        queue: '{{trigger.department}}',
                        reviewType: '{{trigger.role}}',
                    }, null, 2),
                },
            },
            {
                id: 'wait-1',
                kind: 'wait',
                name: 'Hold for Review',
                pos_x: 620,
                pos_y: 220,
                config: {
                    duration: 30,
                    unit: 'minutes',
                },
            },
            {
                id: 'email-1',
                kind: 'email',
                name: 'Send Review Update',
                pos_x: 900,
                pos_y: 220,
                config: {
                    to: '{{trigger.email}}',
                    subject: 'Payment exception review in progress',
                    body: `Your payment-related request is being reviewed by operations.

Reference: {{trigger.name}}
Queue: {{trigger.department}}

We will update the case once the review is complete.`,
                },
            },
            {
                id: 'logger-1',
                kind: 'logger',
                name: 'Log Review State',
                pos_x: 1180,
                pos_y: 220,
                config: {
                    message: 'Payment exception review started for {{trigger.name}}',
                    level: 'info',
                },
            },
        ],
        edges: [
            { from: 'trigger-1', to: 'http-1' },
            { from: 'http-1', to: 'wait-1' },
            { from: 'wait-1', to: 'email-1' },
            { from: 'email-1', to: 'logger-1' },
        ],
        requiredConfig: [
            'Case intake details in the trigger step',
            'Operations API endpoint if using the HTTP step',
            'SMTP credentials configured in n8n',
        ],
    },
];

export const getTemplateById = (id: string): WorkflowTemplate | undefined => {
    return templates.find((t) => t.id === id);
};

export const getTemplatesByCategory = (category: 'general'): WorkflowTemplate[] => {
    return templates.filter((t) => t.category === category);
};
