/**
 * Flow Templates
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

export interface FlowTemplate {
    id: string;
    name: string;
    description: string;
    useCase: string;
    category: 'general';
    nodes: TemplateNode[];
    edges: TemplateEdge[];
    requiredConfig: string[];
}

export const templates: FlowTemplate[] = [
    {
        id: 'aml-alert-review',
        name: 'AML Alert Review',
        description: 'Route an AML alert through analyst review, supervisor approval, and final disposition.',
        useCase: 'Use this template when a monitoring system raises an alert that needs analyst review, approval control, and clear case traceability.',
        category: 'general',
        nodes: [
            {
                id: 'trigger-1',
                kind: 'trigger',
                name: 'Alert Intake',
                pos_x: 100,
                pos_y: 200,
                config: {
                    caseType: 'aml_alert',
                    intakeSource: 'transaction_monitoring',
                    defaultPriority: 'high',
                },
            },
            {
                id: 'review-1',
                kind: 'review',
                name: 'Analyst Review',
                pos_x: 360,
                pos_y: 200,
                config: {
                    title: 'Review AML alert',
                    claimPolicy: 'claim_required',
                    dueInHours: 8,
                },
            },
            {
                id: 'approval-1',
                kind: 'approval',
                name: 'Supervisor Approval',
                pos_x: 620,
                pos_y: 200,
                config: {
                    label: 'Approve AML disposition',
                    requestedFromRoleId: 4,
                    requiredComment: true,
                    dueInHours: 24,
                },
            },
            {
                id: 'status-1',
                kind: 'status_update',
                name: 'Mark Reviewed',
                pos_x: 900,
                pos_y: 120,
                config: {
                    status: 'resolved',
                    outcome: 'cleared',
                },
            },
            {
                id: 'escalation-1',
                kind: 'escalation',
                name: 'Escalate Rejection',
                pos_x: 900,
                pos_y: 300,
                config: {
                    escalationType: 'approval_rejection',
                    reason: 'Supervisor rejected AML disposition',
                    toTeamId: 1,
                },
            },
        ],
        edges: [
            { from: 'trigger-1', to: 'review-1' },
            { from: 'review-1', to: 'approval-1' },
            { from: 'approval-1', to: 'status-1', label: 'approved' },
            { from: 'approval-1', to: 'escalation-1', label: 'rejected' },
        ],
        requiredConfig: [
            'Review team or claim queue for the analyst step',
            'Supervisor role or team configured for approval',
        ],
    },
    {
        id: 'payment-exception-review',
        name: 'Payment Exception Review',
        description: 'Capture payment evidence, route operations review, and resolve the exception.',
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
                    caseType: 'payment_exception',
                    intakeSource: 'manual_exception_queue',
                    defaultPriority: 'normal',
                },
            },
            {
                id: 'documents-1',
                kind: 'document_collection',
                name: 'Collect Payment Evidence',
                pos_x: 360,
                pos_y: 220,
                config: {
                    title: 'Collect payment evidence',
                    claimPolicy: 'claim_required',
                    requiredDocuments: ['payment_instruction'],
                    dueInHours: 12,
                },
            },
            {
                id: 'review-1',
                kind: 'review',
                name: 'Operations Review',
                pos_x: 620,
                pos_y: 220,
                config: {
                    title: 'Resolve payment exception',
                    claimPolicy: 'claim_required',
                    dueInHours: 12,
                },
            },
            {
                id: 'status-1',
                kind: 'status_update',
                name: 'Mark Resolved',
                pos_x: 900,
                pos_y: 220,
                config: {
                    status: 'resolved',
                    outcome: 'payment_exception_resolved',
                },
            },
        ],
        edges: [
            { from: 'trigger-1', to: 'documents-1' },
            { from: 'documents-1', to: 'review-1' },
            { from: 'review-1', to: 'status-1' },
        ],
        requiredConfig: [
            'Payment evidence document type requirements',
            'Operations claim queue or team assignment',
        ],
    },
];

export const getTemplateById = (id: string): FlowTemplate | undefined => {
    return templates.find((t) => t.id === id);
};

export const getTemplatesByCategory = (category: 'general'): FlowTemplate[] => {
    return templates.filter((t) => t.category === category);
};
