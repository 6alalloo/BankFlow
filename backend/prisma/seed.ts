import {
  Prisma,
  PrismaClient,
  case_approval_status,
  case_escalation_status,
  case_priority,
  case_status,
  case_task_status,
  case_task_type,
  claim_policy,
} from '@prisma/client';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { buildDemoFlowFixtures, type DemoEdge, type DemoNode } from './seed/demoFlowFixtures';
import { allowListDomains, roleNames, seedMemberships, seedTeams, seedUsers } from './seed/identityFixtures';

dotenv.config();

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;

type SeedCaseTask = {
  flowNodeKey: string;
  taskType: case_task_type;
  title: string;
  status: case_task_status;
  assignedUserId?: number | null;
  assignedTeamId?: number | null;
  claimPolicy?: claim_policy;
  claimedAt?: Date | null;
  dueAt?: Date | null;
  completedAt?: Date | null;
  completedByUserId?: number | null;
  decision?: string | null;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
};

type SeedCaseApproval = {
  flowNodeKey: string;
  approvalLabel: string;
  status: case_approval_status;
  requestedFromUserId?: number | null;
  requestedFromRoleId?: number | null;
  requestedFromTeamId?: number | null;
  requestedAt: Date;
  dueAt?: Date | null;
  decidedAt?: Date | null;
  decidedByUserId?: number | null;
  requiredComment?: boolean;
  decisionReason?: string | null;
};

type SeedCaseDefinition = {
  reference: string;
  flowKey: string;
  title: string;
  status: case_status;
  priority: case_priority;
  currentNodeKey?: string | null;
  assigneeUserId?: number | null;
  assigneeTeamId?: number | null;
  intakeSource: string;
  openedAt: Date;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  createdByUserId?: number | null;
  data: Record<string, unknown>;
  outcome?: Record<string, unknown> | null;
  tasks: SeedCaseTask[];
  approvals?: SeedCaseApproval[];
  escalations?: Array<{
    sourceTaskIndex?: number;
    flowNodeKey?: string | null;
    escalationType: string;
    status: case_escalation_status;
    reason: string;
    fromUserId?: number | null;
    toUserId?: number | null;
    toTeamId?: number | null;
    triggeredAt: Date;
    resolvedAt?: Date | null;
    resolvedByUserId?: number | null;
  }>;
  documents?: Array<{
    taskIndex?: number;
    flowNodeKey?: string | null;
    filename: string;
    mimeType: string;
    storagePath: string;
    documentType?: string | null;
    metadata: Record<string, unknown>;
    uploadedByUserId?: number | null;
    uploadedAt: Date;
  }>;
  notes?: Array<{
    actorUserId?: number | null;
    summary: string;
    createdAt: Date;
    data?: Record<string, unknown>;
  }>;
};

const daysAgo = (days: number, hour = 9, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

async function seedPublishedFlow(input: {
  key: string;
  name: string;
  description: string;
  caseType: string;
  ownerUserId: number;
  nodes: DemoNode[];
  edges: DemoEdge[];
}) {
  const flow = await prisma.case_flows.upsert({
    where: { key: input.key },
    update: {
      name: input.name,
      description: input.description,
      case_type: input.caseType,
      owner_user_id: input.ownerUserId,
    },
    create: {
      key: input.key,
      name: input.name,
      description: input.description,
      case_type: input.caseType,
      owner_user_id: input.ownerUserId,
      draft_data_schema_json: {},
    },
  });

  for (const node of input.nodes) {
    await prisma.case_flow_draft_nodes.upsert({
      where: { case_flow_id_node_key: { case_flow_id: flow.id, node_key: node.node_key } },
      update: {
        kind: node.kind,
        name: node.name,
        config_json: toInputJson(node.config_json),
        pos_x: node.pos_x,
        pos_y: node.pos_y,
      },
      create: {
        case_flow_id: flow.id,
        node_key: node.node_key,
        kind: node.kind,
        name: node.name,
        config_json: toInputJson(node.config_json),
        pos_x: node.pos_x,
        pos_y: node.pos_y,
      },
    });
  }

  for (const edge of input.edges) {
    await prisma.case_flow_draft_edges.upsert({
      where: { case_flow_id_edge_key: { case_flow_id: flow.id, edge_key: edge.edge_key } },
      update: {
        from_node_key: edge.from_node_key,
        to_node_key: edge.to_node_key,
        label: edge.label ?? null,
        priority: edge.priority ?? 0,
        condition_json: {},
      },
      create: {
        case_flow_id: flow.id,
        edge_key: edge.edge_key,
        from_node_key: edge.from_node_key,
        to_node_key: edge.to_node_key,
        label: edge.label ?? null,
        priority: edge.priority ?? 0,
        condition_json: {},
      },
    });
  }

  const currentVersion = await prisma.case_flow_versions.findFirst({
    where: { case_flow_id: flow.id, status: 'published' },
    orderBy: { version_number: 'desc' },
  });

  if (currentVersion) {
    await prisma.case_flows.update({
      where: { id: flow.id },
      data: { status: 'published', current_published_version_id: currentVersion.id },
    });
    return flow;
  }

  const graph = { nodes: input.nodes, edges: input.edges };
  const version = await prisma.case_flow_versions.create({
    data: {
      case_flow_id: flow.id,
      version_number: 1,
      graph_json: toInputJson(graph),
      data_schema_json: toInputJson({}),
      change_summary: 'Seeded demo flow',
      published_by_user_id: input.ownerUserId,
    },
  });

  await prisma.case_flows.update({
    where: { id: flow.id },
    data: { status: 'published', current_published_version_id: version.id },
  });

  return flow;
}

async function clearSeededCases(references: string[]) {
  const cases = await prisma.cases.findMany({
    where: { case_reference: { in: references } },
    select: { id: true },
  });
  const caseIds = cases.map((caseRecord) => caseRecord.id);
  if (caseIds.length === 0) return;

  await prisma.case_events.deleteMany({ where: { case_id: { in: caseIds } } });
  await prisma.case_documents.deleteMany({ where: { case_id: { in: caseIds } } });
  await prisma.case_approvals.deleteMany({ where: { case_id: { in: caseIds } } });
  await prisma.case_escalations.deleteMany({ where: { case_id: { in: caseIds } } });
  await prisma.case_tasks.deleteMany({ where: { case_id: { in: caseIds } } });
  await prisma.cases.deleteMany({ where: { id: { in: caseIds } } });
}

async function seedOperationalCases(cases: SeedCaseDefinition[]) {
  await clearSeededCases(cases.map((caseRecord) => caseRecord.reference));

  const flows = await prisma.case_flows.findMany({
    where: { key: { in: [...new Set(cases.map((caseRecord) => caseRecord.flowKey))] } },
    include: { current_published_version: true },
  });
  const flowByKey = new Map(flows.map((flow) => [flow.key, flow]));

  for (const seedCase of cases) {
    const flow = flowByKey.get(seedCase.flowKey);
    if (!flow?.current_published_version) {
      throw new Error(`Seed flow ${seedCase.flowKey} is not published`);
    }

    const createdCase = await prisma.cases.create({
      data: {
        case_flow_id: flow.id,
        case_flow_version_id: flow.current_published_version.id,
        case_reference: seedCase.reference,
        case_type: flow.case_type,
        title: seedCase.title,
        status: seedCase.status,
        priority: seedCase.priority,
        current_node_key: seedCase.currentNodeKey ?? null,
        assignee_user_id: seedCase.assigneeUserId ?? null,
        assignee_team_id: seedCase.assigneeTeamId ?? null,
        intake_source: seedCase.intakeSource,
        case_data_json: toInputJson(seedCase.data),
        flow_snapshot_json: toInputJson(flow.current_published_version.graph_json),
        outcome_json: toInputJson(seedCase.outcome ?? null),
        opened_at: seedCase.openedAt,
        resolved_at: seedCase.resolvedAt ?? null,
        closed_at: seedCase.closedAt ?? null,
        created_by_user_id: seedCase.createdByUserId ?? null,
      },
    });

    const tasks = [];
    for (const task of seedCase.tasks) {
      tasks.push(
        await prisma.case_tasks.create({
          data: {
            case_id: createdCase.id,
            flow_node_key: task.flowNodeKey,
            task_type: task.taskType,
            title: task.title,
            status: task.status,
            assigned_user_id: task.assignedUserId ?? null,
            assigned_team_id: task.assignedTeamId ?? null,
            claim_policy: task.claimPolicy ?? 'claim_required',
            claimed_at: task.claimedAt ?? null,
            due_at: task.dueAt ?? null,
            completed_at: task.completedAt ?? null,
            completed_by_user_id: task.completedByUserId ?? null,
            decision: task.decision ?? null,
            input_json: toInputJson(task.input ?? {}),
            output_json: toInputJson(task.output ?? {}),
          },
        })
      );
    }

    const activeTask = tasks.find((task) => task.flow_node_key === seedCase.currentNodeKey && !['completed', 'cancelled', 'rejected'].includes(task.status));
    await prisma.cases.update({
      where: { id: createdCase.id },
      data: { current_task_id: activeTask?.id ?? null },
    });

    for (const approval of seedCase.approvals ?? []) {
      const linkedTask = tasks.find((task) => task.flow_node_key === approval.flowNodeKey);
      await prisma.case_approvals.create({
        data: {
          case_id: createdCase.id,
          task_id: linkedTask?.id ?? null,
          flow_node_key: approval.flowNodeKey,
          approval_label: approval.approvalLabel,
          status: approval.status,
          requested_from_user_id: approval.requestedFromUserId ?? null,
          requested_from_role_id: approval.requestedFromRoleId ?? null,
          requested_from_team_id: approval.requestedFromTeamId ?? null,
          requested_at: approval.requestedAt,
          due_at: approval.dueAt ?? null,
          decided_at: approval.decidedAt ?? null,
          decided_by_user_id: approval.decidedByUserId ?? null,
          required_comment: approval.requiredComment ?? false,
          decision_reason: approval.decisionReason ?? null,
        },
      });
    }

    for (const escalation of seedCase.escalations ?? []) {
      await prisma.case_escalations.create({
        data: {
          case_id: createdCase.id,
          source_task_id: escalation.sourceTaskIndex === undefined ? null : tasks[escalation.sourceTaskIndex]?.id ?? null,
          flow_node_key: escalation.flowNodeKey ?? null,
          escalation_type: escalation.escalationType,
          status: escalation.status,
          reason: escalation.reason,
          from_user_id: escalation.fromUserId ?? null,
          to_user_id: escalation.toUserId ?? null,
          to_team_id: escalation.toTeamId ?? null,
          triggered_at: escalation.triggeredAt,
          resolved_at: escalation.resolvedAt ?? null,
          resolved_by_user_id: escalation.resolvedByUserId ?? null,
        },
      });
    }

    for (const document of seedCase.documents ?? []) {
      await prisma.case_documents.create({
        data: {
          case_id: createdCase.id,
          task_id: document.taskIndex === undefined ? null : tasks[document.taskIndex]?.id ?? null,
          flow_node_key: document.flowNodeKey ?? null,
          filename: document.filename,
          mime_type: document.mimeType,
          storage_path: document.storagePath,
          document_type: document.documentType ?? null,
          metadata_json: toInputJson(document.metadata),
          uploaded_by_user_id: document.uploadedByUserId ?? null,
          uploaded_at: document.uploadedAt,
        },
      });
    }

    await prisma.case_events.create({
      data: {
        case_id: createdCase.id,
        actor_user_id: seedCase.createdByUserId ?? null,
        event_type: 'case_created',
        summary: `Case opened from ${seedCase.intakeSource}`,
        data_json: toInputJson({ reference: seedCase.reference, intakeSource: seedCase.intakeSource }),
        created_at: seedCase.openedAt,
      },
    });

    for (const task of tasks) {
      await prisma.case_events.create({
        data: {
          case_id: createdCase.id,
          task_id: task.id,
          flow_node_key: task.flow_node_key,
          actor_user_id: task.completed_by_user_id ?? task.assigned_user_id ?? seedCase.createdByUserId ?? null,
          event_type: task.completed_at ? 'task_completed' : 'task_created',
          summary: task.completed_at ? `${task.title} completed` : `${task.title} created`,
          data_json: toInputJson({ status: task.status, decision: task.decision }),
          created_at: task.completed_at ?? seedCase.openedAt,
        },
      });
    }

    for (const approval of seedCase.approvals ?? []) {
      await prisma.case_events.create({
        data: {
          case_id: createdCase.id,
          flow_node_key: approval.flowNodeKey,
          actor_user_id: approval.decidedByUserId ?? seedCase.createdByUserId ?? null,
          event_type: approval.decidedAt ? 'approval_decided' : 'approval_requested',
          summary: approval.decidedAt ? `${approval.approvalLabel} ${approval.status}` : `${approval.approvalLabel} requested`,
          data_json: toInputJson({ status: approval.status, decisionReason: approval.decisionReason }),
          created_at: approval.decidedAt ?? approval.requestedAt,
        },
      });
    }

    for (const note of seedCase.notes ?? []) {
      await prisma.case_events.create({
        data: {
          case_id: createdCase.id,
          actor_user_id: note.actorUserId ?? null,
          event_type: 'note_added',
          summary: note.summary,
          data_json: toInputJson(note.data ?? { note: note.summary }),
          created_at: note.createdAt,
        },
      });
    }
  }
}

async function main() {
  console.log('Starting BankFlow database seed...');

  const roles = await Promise.all(
    roleNames.map((name) =>
      prisma.roles.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );
  const roleByName = new Map(roles.map((role) => [role.name, role]));
  const seededUsers = await Promise.all(
    seedUsers.map(async (user) => {
      const role = roleByName.get(user.roleName);
      if (!role) throw new Error(`Seed role not found: ${user.roleName}`);
      const passwordHash = await hashPassword(user.password);
      return prisma.users.upsert({
        where: { email: user.email },
        update: { password_hash: passwordHash, full_name: user.fullName, role_id: role.id },
        create: {
          email: user.email,
          password_hash: passwordHash,
          full_name: user.fullName,
          role_id: role.id,
        },
      });
    })
  );
  const userByEmail = new Map(seededUsers.map((user) => [user.email, user]));

  const seededTeams = await Promise.all(
    seedTeams.map((team) =>
      prisma.teams.upsert({
        where: { key: team.key },
        update: { name: team.name, description: team.description },
        create: {
          key: team.key,
          name: team.name,
          description: team.description,
        },
      })
    )
  );
  const teamByKey = new Map(seededTeams.map((team) => [team.key, team]));

  for (const membership of seedMemberships) {
    const team = teamByKey.get(membership.teamKey);
    const user = userByEmail.get(membership.userEmail);
    if (!team || !user) throw new Error(`Seed membership target not found: ${membership.teamKey}/${membership.userEmail}`);

    await prisma.team_memberships.upsert({
      where: { team_id_user_id: { team_id: team.id, user_id: user.id } },
      update: {
        membership_role: membership.membershipRole,
        is_primary: membership.isPrimary,
      },
      create: {
        team_id: team.id,
        user_id: user.id,
        membership_role: membership.membershipRole,
        is_primary: membership.isPrimary,
      },
    });
  }

  const adminUser = userByEmail.get('admin@bankflow.local')!;
  const designerUser = userByEmail.get('designer@bankflow.local')!;
  const operatorUser = userByEmail.get('operator@bankflow.local')!;
  const supervisorUser = userByEmail.get('supervisor@bankflow.local')!;
  const approverUser = userByEmail.get('approver@bankflow.local')!;
  const auditorUser = userByEmail.get('auditor@bankflow.local')!;
  const amlTeam = teamByKey.get('aml-queue')!;
  const paymentsTeam = teamByKey.get('payments-ops')!;
  const kycTeam = teamByKey.get('kyc-remediation')!;
  const treasuryTeam = teamByKey.get('treasury-control')!;

  for (const flowFixture of buildDemoFlowFixtures({
    adminUserId: adminUser.id,
    designerUserId: designerUser.id,
    amlTeamId: amlTeam.id,
    paymentsTeamId: paymentsTeam.id,
    treasuryTeamId: treasuryTeam.id,
  })) {
    await seedPublishedFlow(flowFixture);
  }

  await Promise.all(
    allowListDomains.map((domain) =>
      prisma.http_allow_list_domains.upsert({
        where: { domain },
        update: {},
        create: { domain, created_by: adminUser.id },
      })
    )
  );

  await seedOperationalCases([
    {
      reference: 'BF-20260520-HVP-3001',
      flowKey: 'high-value-payment-release',
      title: 'USD 2.4M supplier payment release - Alba Industrial Services',
      status: 'pending_approval',
      priority: 'critical',
      currentNodeKey: 'release-approval',
      assigneeTeamId: treasuryTeam.id,
      intakeSource: 'treasury-core.bankflow.local',
      openedAt: daysAgo(0, 8, 20),
      createdByUserId: operatorUser.id,
      data: {
        paymentReference: 'HVP-260520-8841',
        customerName: 'Alba Industrial Services B.S.C.',
        beneficiaryName: 'Kobe Precision Machinery Ltd.',
        currency: 'USD',
        amount: 2400000,
        amountBhd: 904800,
        valueDate: '2026-05-20',
        correspondentBank: 'JP Morgan Chase NY',
        sanctionsScreenResult: 'clear',
        liquidityCheck: 'funded',
        approvalThresholdBhd: 100000,
      },
      tasks: [
        {
          flowNodeKey: 'collect-release-evidence',
          taskType: 'document_collection',
          title: 'Collect payment instruction, sanctions screen, and customer mandate',
          status: 'completed',
          assignedUserId: operatorUser.id,
          assignedTeamId: paymentsTeam.id,
          claimedAt: daysAgo(0, 8, 25),
          dueAt: daysAgo(0, 12, 20),
          completedAt: daysAgo(0, 9, 5),
          completedByUserId: operatorUser.id,
          input: { nodeConfig: { requiredDocuments: ['payment_instruction', 'sanctions_screen', 'customer_mandate'] } },
          output: { evidenceComplete: true, sanctionsScreenResult: 'clear' },
        },
        {
          flowNodeKey: 'treasury-control-review',
          taskType: 'review',
          title: 'Validate funding, beneficiary, and correspondent route',
          status: 'completed',
          assignedUserId: supervisorUser.id,
          assignedTeamId: treasuryTeam.id,
          claimedAt: daysAgo(0, 9, 10),
          dueAt: daysAgo(0, 12, 5),
          completedAt: daysAgo(0, 9, 55),
          completedByUserId: supervisorUser.id,
          decision: 'approval_required',
          output: {
            fundingStatus: 'available',
            beneficiaryValidated: true,
            routeRisk: 'standard',
            amountBhd: 904800,
          },
        },
        {
          flowNodeKey: 'release-approval',
          taskType: 'approval_support',
          title: 'Senior release approval',
          status: 'assigned',
          assignedTeamId: treasuryTeam.id,
          dueAt: hoursFromNow(2),
          input: { nodeConfig: { requiredComment: true, dueInHours: 2 } },
        },
      ],
      approvals: [
        {
          flowNodeKey: 'release-approval',
          approvalLabel: 'Approve high-value payment release',
          status: 'requested',
          requestedFromTeamId: treasuryTeam.id,
          requestedAt: daysAgo(0, 10, 0),
          dueAt: hoursFromNow(2),
          requiredComment: true,
        },
      ],
      documents: [
        {
          taskIndex: 0,
          flowNodeKey: 'collect-release-evidence',
          filename: 'signed-payment-instruction-hvp-260520-8841.pdf',
          mimeType: 'application/pdf',
          storagePath: 'seed/BF-20260520-HVP-3001/payment-instruction.pdf',
          documentType: 'payment_instruction',
          metadata: { pages: 3, signer: 'CFO', dualControl: true },
          uploadedByUserId: operatorUser.id,
          uploadedAt: daysAgo(0, 8, 42),
        },
        {
          taskIndex: 0,
          flowNodeKey: 'collect-release-evidence',
          filename: 'sanctions-clearance-hvp-260520-8841.pdf',
          mimeType: 'application/pdf',
          storagePath: 'seed/BF-20260520-HVP-3001/sanctions-clearance.pdf',
          documentType: 'sanctions_screen',
          metadata: { provider: 'Dow Jones', result: 'clear' },
          uploadedByUserId: operatorUser.id,
          uploadedAt: daysAgo(0, 8, 46),
        },
        {
          taskIndex: 0,
          flowNodeKey: 'collect-release-evidence',
          filename: 'customer-mandate-alba-industrial.pdf',
          mimeType: 'application/pdf',
          storagePath: 'seed/BF-20260520-HVP-3001/customer-mandate.pdf',
          documentType: 'customer_mandate',
          metadata: { mandateDate: '2026-01-12', valid: true },
          uploadedByUserId: operatorUser.id,
          uploadedAt: daysAgo(0, 8, 50),
        },
      ],
      notes: [
        {
          actorUserId: supervisorUser.id,
          summary: 'Treasury control validated liquidity and correspondent route; senior release approval is now the blocker.',
          createdAt: daysAgo(0, 10, 2),
        },
      ],
    },
    {
      reference: 'BF-20260520-HVP-3002',
      flowKey: 'high-value-payment-release',
      title: 'EUR 180K capital equipment payment requires treasury review',
      status: 'pending_action',
      priority: 'high',
      currentNodeKey: 'treasury-control-review',
      assigneeUserId: supervisorUser.id,
      assigneeTeamId: treasuryTeam.id,
      intakeSource: 'swift-gpi.bankflow.local',
      openedAt: daysAgo(0, 9, 35),
      createdByUserId: operatorUser.id,
      data: {
        paymentReference: 'HVP-260520-8879',
        customerName: 'Manama Packaging Industries',
        beneficiaryName: 'Bavaria Robotics GmbH',
        currency: 'EUR',
        amount: 180000,
        amountBhd: 73440,
        valueDate: '2026-05-20',
        sanctionsScreenResult: 'clear',
        liquidityCheck: 'pending',
        approvalThresholdBhd: 100000,
      },
      tasks: [
        {
          flowNodeKey: 'collect-release-evidence',
          taskType: 'document_collection',
          title: 'Collect payment instruction, sanctions screen, and customer mandate',
          status: 'completed',
          assignedUserId: operatorUser.id,
          assignedTeamId: paymentsTeam.id,
          claimedAt: daysAgo(0, 9, 40),
          dueAt: daysAgo(0, 13, 35),
          completedAt: daysAgo(0, 10, 25),
          completedByUserId: operatorUser.id,
          output: { evidenceComplete: true },
        },
        {
          flowNodeKey: 'treasury-control-review',
          taskType: 'review',
          title: 'Validate funding, beneficiary, and correspondent route',
          status: 'claimed',
          assignedUserId: supervisorUser.id,
          assignedTeamId: treasuryTeam.id,
          claimPolicy: 'direct_assign',
          claimedAt: daysAgo(0, 10, 40),
          dueAt: hoursFromNow(1),
          input: { nodeConfig: { dueInHours: 3 } },
        },
      ],
      documents: [
        {
          taskIndex: 0,
          flowNodeKey: 'collect-release-evidence',
          filename: 'signed-payment-instruction-hvp-260520-8879.pdf',
          mimeType: 'application/pdf',
          storagePath: 'seed/BF-20260520-HVP-3002/payment-instruction.pdf',
          documentType: 'payment_instruction',
          metadata: { pages: 2, dualControl: true },
          uploadedByUserId: operatorUser.id,
          uploadedAt: daysAgo(0, 10, 0),
        },
      ],
      notes: [
        {
          actorUserId: supervisorUser.id,
          summary: 'This one is under the senior approval threshold; completing treasury review should release it straight through.',
          createdAt: daysAgo(0, 10, 45),
        },
      ],
    },
    {
      reference: 'BF-20260519-HVP-2994',
      flowKey: 'high-value-payment-release',
      title: 'GBP 1.1M acquisition payment rejected for mandate mismatch',
      status: 'escalated',
      priority: 'critical',
      currentNodeKey: 'approval-rework',
      assigneeTeamId: treasuryTeam.id,
      intakeSource: 'treasury-core.bankflow.local',
      openedAt: daysAgo(1, 13, 10),
      createdByUserId: operatorUser.id,
      data: {
        paymentReference: 'HVP-260519-8720',
        customerName: 'Bahrain Ports Logistics',
        beneficiaryName: 'North Sea Holdings LLP',
        currency: 'GBP',
        amount: 1100000,
        amountBhd: 520300,
        valueDate: '2026-05-20',
        sanctionsScreenResult: 'clear',
        approvalThresholdBhd: 100000,
        rejectionReason: 'Customer mandate signer differs from board resolution.',
      },
      tasks: [
        {
          flowNodeKey: 'collect-release-evidence',
          taskType: 'document_collection',
          title: 'Collect payment instruction, sanctions screen, and customer mandate',
          status: 'completed',
          assignedUserId: operatorUser.id,
          assignedTeamId: paymentsTeam.id,
          claimedAt: daysAgo(1, 13, 15),
          dueAt: daysAgo(1, 17, 10),
          completedAt: daysAgo(1, 14, 0),
          completedByUserId: operatorUser.id,
          output: { evidenceComplete: true },
        },
        {
          flowNodeKey: 'treasury-control-review',
          taskType: 'review',
          title: 'Validate funding, beneficiary, and correspondent route',
          status: 'completed',
          assignedUserId: supervisorUser.id,
          assignedTeamId: treasuryTeam.id,
          claimedAt: daysAgo(1, 14, 10),
          dueAt: daysAgo(1, 17, 0),
          completedAt: daysAgo(1, 14, 50),
          completedByUserId: supervisorUser.id,
          decision: 'approval_required',
          output: { amountBhd: 520300, routeRisk: 'heightened' },
        },
        {
          flowNodeKey: 'approval-rework',
          taskType: 'escalation_followup',
          title: 'Resolve rejected high-value release package',
          status: 'overdue',
          assignedTeamId: treasuryTeam.id,
          dueAt: daysAgo(0, 9, 0),
          input: { nodeConfig: { reason: 'Senior approver rejected payment release' } },
        },
      ],
      approvals: [
        {
          flowNodeKey: 'release-approval',
          approvalLabel: 'Approve high-value payment release',
          status: 'rejected',
          requestedFromTeamId: treasuryTeam.id,
          requestedAt: daysAgo(1, 14, 55),
          dueAt: daysAgo(1, 17, 0),
          decidedAt: daysAgo(1, 15, 35),
          decidedByUserId: supervisorUser.id,
          requiredComment: true,
          decisionReason: 'Mandate evidence does not match authorized signer list.',
        },
      ],
      escalations: [
        {
          sourceTaskIndex: 2,
          flowNodeKey: 'approval-rework',
          escalationType: 'release_rework',
          status: 'triggered',
          reason: 'Senior approver rejected payment release; treasury rework required before resubmission.',
          fromUserId: supervisorUser.id,
          toTeamId: treasuryTeam.id,
          triggeredAt: daysAgo(1, 15, 40),
        },
      ],
      notes: [
        {
          actorUserId: supervisorUser.id,
          summary: 'Use this case to demonstrate rejection, escalation, overdue work, and evidence rework.',
          createdAt: daysAgo(0, 9, 10),
        },
      ],
    },
    {
      reference: 'BF-20260518-HVP-2955',
      flowKey: 'high-value-payment-release',
      title: 'BHD 42K vendor payment released straight-through after treasury review',
      status: 'resolved',
      priority: 'normal',
      currentNodeKey: null,
      assigneeTeamId: treasuryTeam.id,
      intakeSource: 'treasury-core.bankflow.local',
      openedAt: daysAgo(2, 10, 15),
      resolvedAt: daysAgo(2, 12, 30),
      createdByUserId: operatorUser.id,
      data: {
        paymentReference: 'HVP-260518-8612',
        customerName: 'Dana Mall Properties',
        beneficiaryName: 'Bahrain Facilities Maintenance',
        currency: 'BHD',
        amount: 42000,
        amountBhd: 42000,
        valueDate: '2026-05-18',
        sanctionsScreenResult: 'clear',
        approvalThresholdBhd: 100000,
      },
      outcome: {
        disposition: 'payment_released',
        approvalRequired: false,
        releaseReference: 'REL-260518-4381',
      },
      tasks: [
        {
          flowNodeKey: 'collect-release-evidence',
          taskType: 'document_collection',
          title: 'Collect payment instruction, sanctions screen, and customer mandate',
          status: 'completed',
          assignedUserId: operatorUser.id,
          assignedTeamId: paymentsTeam.id,
          claimedAt: daysAgo(2, 10, 20),
          dueAt: daysAgo(2, 14, 15),
          completedAt: daysAgo(2, 11, 0),
          completedByUserId: operatorUser.id,
          output: { evidenceComplete: true },
        },
        {
          flowNodeKey: 'treasury-control-review',
          taskType: 'review',
          title: 'Validate funding, beneficiary, and correspondent route',
          status: 'completed',
          assignedUserId: supervisorUser.id,
          assignedTeamId: treasuryTeam.id,
          dueAt: daysAgo(2, 14, 0),
          completedAt: daysAgo(2, 12, 25),
          completedByUserId: supervisorUser.id,
          decision: 'straight_through',
          output: { amountBhd: 42000, approvalRequired: false, releaseReference: 'REL-260518-4381' },
        },
      ],
      notes: [
        {
          actorUserId: supervisorUser.id,
          summary: 'Straight-through branch completed because value was below senior approval threshold.',
          createdAt: daysAgo(2, 12, 30),
        },
      ],
    },
    {
      reference: 'BF-20260519-AML-1047',
      flowKey: 'aml-alert-review',
      title: 'Sanctions name screening alert - Gulf Horizon Trading',
      status: 'pending_approval',
      priority: 'critical',
      currentNodeKey: 'supervisor-approval',
      assigneeTeamId: paymentsTeam.id,
      intakeSource: 'sanctions.bankflow.local',
      openedAt: daysAgo(0, 8, 35),
      createdByUserId: operatorUser.id,
      data: {
        customerName: 'Gulf Horizon Trading W.L.L.',
        customerSegment: 'Corporate',
        alertSource: 'Dow Jones sanctions screening',
        alertScore: 94,
        matchedEntity: 'Gulf Horizon Trading and Logistics',
        exposureAmountBhd: 184250,
        jurisdiction: 'BH',
        relationshipManager: 'A. Qureshi',
        recommendedDisposition: 'false_positive_with_controls',
      },
      tasks: [
        {
          flowNodeKey: 'analyst-review',
          taskType: 'review',
          title: 'Review sanctions alert and prepare disposition',
          status: 'completed',
          assignedUserId: operatorUser.id,
          assignedTeamId: amlTeam.id,
          claimPolicy: 'direct_assign',
          claimedAt: daysAgo(0, 8, 45),
          dueAt: daysAgo(0, 16, 30),
          completedAt: daysAgo(0, 10, 20),
          completedByUserId: operatorUser.id,
          decision: 'refer_for_approval',
          input: { nodeConfig: { dueInHours: 8 } },
          output: {
            analystFinding: 'Possible transliteration overlap; no ownership or vessel linkage found.',
            riskRating: 'High',
            evidencePack: 'case-files/BF-20260519-AML-1047/sanctions-review.pdf',
          },
        },
        {
          flowNodeKey: 'supervisor-approval',
          taskType: 'approval_support',
          title: 'Validate AML disposition and release hold',
          status: 'assigned',
          assignedTeamId: paymentsTeam.id,
          dueAt: hoursFromNow(6),
          input: { nodeConfig: { requiredComment: true, dueInHours: 24 } },
        },
      ],
      approvals: [
        {
          flowNodeKey: 'supervisor-approval',
          approvalLabel: 'Approve AML disposition',
          status: 'requested',
          requestedFromTeamId: paymentsTeam.id,
          requestedAt: daysAgo(0, 10, 22),
          dueAt: hoursFromNow(6),
          requiredComment: true,
        },
      ],
      documents: [
        {
          taskIndex: 0,
          flowNodeKey: 'analyst-review',
          filename: 'sanctions-review-gulf-horizon.pdf',
          mimeType: 'application/pdf',
          storagePath: 'seed/BF-20260519-AML-1047/sanctions-review-gulf-horizon.pdf',
          documentType: 'screening_evidence',
          metadata: { source: 'Dow Jones', pages: 7, classification: 'confidential' },
          uploadedByUserId: operatorUser.id,
          uploadedAt: daysAgo(0, 10, 12),
        },
      ],
      notes: [
        {
          actorUserId: operatorUser.id,
          summary: 'Relationship manager confirmed the counterparty is a long-standing logistics client with no sanctioned ownership.',
          createdAt: daysAgo(0, 10, 18),
        },
      ],
    },
    {
      reference: 'BF-20260518-PAY-2218',
      flowKey: 'payment-exception-review',
      title: 'High-value AED transfer held for beneficiary IBAN mismatch',
      status: 'pending_action',
      priority: 'high',
      currentNodeKey: 'ops-review',
      assigneeUserId: supervisorUser.id,
      assigneeTeamId: treasuryTeam.id,
      intakeSource: 'swift-gpi.bankflow.local',
      openedAt: daysAgo(1, 14, 5),
      createdByUserId: operatorUser.id,
      data: {
        paymentReference: 'FT24139008211',
        valueDate: '2026-05-19',
        currency: 'AED',
        amount: 2750000,
        orderingCustomer: 'Al Noor Construction SPC',
        beneficiaryName: 'Emirates Plant Hire LLC',
        exceptionReason: 'Beneficiary IBAN checksum mismatch after correspondent enrichment',
        repairWindowHours: 4,
      },
      tasks: [
        {
          flowNodeKey: 'collect-documents',
          taskType: 'document_collection',
          title: 'Collect signed payment instruction and beneficiary confirmation',
          status: 'completed',
          assignedUserId: operatorUser.id,
          assignedTeamId: paymentsTeam.id,
          claimedAt: daysAgo(1, 14, 20),
          dueAt: daysAgo(1, 23, 0),
          completedAt: daysAgo(1, 16, 15),
          completedByUserId: operatorUser.id,
          input: { nodeConfig: { requiredDocuments: ['payment_instruction', 'beneficiary_confirmation'] } },
          output: { documentsComplete: true, customerContacted: true },
        },
        {
          flowNodeKey: 'ops-review',
          taskType: 'review',
          title: 'Repair payment exception and confirm release decision',
          status: 'claimed',
          assignedUserId: supervisorUser.id,
          assignedTeamId: treasuryTeam.id,
          claimPolicy: 'direct_assign',
          claimedAt: daysAgo(0, 9, 10),
          dueAt: hoursFromNow(2),
          input: { nodeConfig: { dueInHours: 12 } },
        },
      ],
      documents: [
        {
          taskIndex: 0,
          flowNodeKey: 'collect-documents',
          filename: 'signed-payment-instruction-ft24139008211.pdf',
          mimeType: 'application/pdf',
          storagePath: 'seed/BF-20260518-PAY-2218/signed-payment-instruction.pdf',
          documentType: 'payment_instruction',
          metadata: { pages: 2, signedBy: 'Fatima Al Noor' },
          uploadedByUserId: operatorUser.id,
          uploadedAt: daysAgo(1, 15, 2),
        },
        {
          taskIndex: 0,
          flowNodeKey: 'collect-documents',
          filename: 'beneficiary-bank-confirmation.eml',
          mimeType: 'message/rfc822',
          storagePath: 'seed/BF-20260518-PAY-2218/beneficiary-bank-confirmation.eml',
          documentType: 'beneficiary_confirmation',
          metadata: { senderDomain: 'emiratesplanthire.ae', verifiedDomain: true },
          uploadedByUserId: operatorUser.id,
          uploadedAt: daysAgo(1, 15, 25),
        },
      ],
      notes: [
        {
          actorUserId: supervisorUser.id,
          summary: 'Treasury control is validating the repaired IBAN against correspondent confirmation before release.',
          createdAt: daysAgo(0, 9, 45),
        },
      ],
    },
    {
      reference: 'BF-20260517-AML-0991',
      flowKey: 'aml-alert-review',
      title: 'Structuring pattern review - Pearl Exchange House',
      status: 'escalated',
      priority: 'critical',
      currentNodeKey: 'rejected-escalation',
      assigneeTeamId: amlTeam.id,
      intakeSource: 'transaction-monitoring.batch',
      openedAt: daysAgo(2, 11, 10),
      createdByUserId: operatorUser.id,
      data: {
        customerName: 'Pearl Exchange House B.S.C.',
        alertScenario: 'Rapid movement of funds below reporting threshold',
        alertScore: 88,
        transactionCount: 19,
        totalAmountBhd: 96500,
        reviewPeriod: '2026-05-10 to 2026-05-17',
        branch: 'Manama Souq',
      },
      tasks: [
        {
          flowNodeKey: 'analyst-review',
          taskType: 'review',
          title: 'Assess structuring typology and customer activity',
          status: 'completed',
          assignedUserId: operatorUser.id,
          assignedTeamId: amlTeam.id,
          claimedAt: daysAgo(2, 11, 30),
          dueAt: daysAgo(2, 19, 0),
          completedAt: daysAgo(1, 13, 0),
          completedByUserId: operatorUser.id,
          decision: 'suspicious_activity_review',
          output: { recommendedAction: 'escalate_to_mlro', narrativeQuality: 'complete' },
        },
        {
          flowNodeKey: 'supervisor-approval',
          taskType: 'approval_support',
          title: 'Supervisor review of SAR recommendation',
          status: 'rejected',
          assignedUserId: supervisorUser.id,
          assignedTeamId: paymentsTeam.id,
          dueAt: daysAgo(1, 18, 0),
          completedAt: daysAgo(1, 15, 10),
          completedByUserId: supervisorUser.id,
          decision: 'rejected',
          output: { reason: 'Narrative needs customer source-of-funds evidence before MLRO escalation.' },
        },
        {
          flowNodeKey: 'rejected-escalation',
          taskType: 'escalation_followup',
          title: 'Remediate rejected AML escalation pack',
          status: 'overdue',
          assignedTeamId: amlTeam.id,
          dueAt: daysAgo(0, 8, 0),
          input: { nodeConfig: { reason: 'Supervisor rejected AML disposition' } },
        },
      ],
      approvals: [
        {
          flowNodeKey: 'supervisor-approval',
          approvalLabel: 'Approve AML disposition',
          status: 'rejected',
          requestedFromTeamId: paymentsTeam.id,
          requestedAt: daysAgo(1, 13, 5),
          dueAt: daysAgo(1, 18, 0),
          decidedAt: daysAgo(1, 15, 10),
          decidedByUserId: supervisorUser.id,
          requiredComment: true,
          decisionReason: 'Source-of-funds evidence is missing for three connected cash deposits.',
        },
      ],
      escalations: [
        {
          sourceTaskIndex: 2,
          flowNodeKey: 'rejected-escalation',
          escalationType: 'approval_rework',
          status: 'triggered',
          reason: 'Rejected SAR recommendation requires same-day remediation.',
          fromUserId: supervisorUser.id,
          toTeamId: amlTeam.id,
          triggeredAt: daysAgo(1, 15, 20),
        },
      ],
      notes: [
        {
          actorUserId: supervisorUser.id,
          summary: 'Escalated because the rework SLA has passed and the case remains in critical priority.',
          createdAt: daysAgo(0, 8, 30),
        },
      ],
    },
    {
      reference: 'BF-20260516-PAY-2194',
      flowKey: 'payment-exception-review',
      title: 'Duplicate SEPA debit reversal for corporate payroll account',
      status: 'resolved',
      priority: 'normal',
      currentNodeKey: null,
      assigneeTeamId: paymentsTeam.id,
      intakeSource: 'customer-service.casehub',
      openedAt: daysAgo(3, 10, 25),
      resolvedAt: daysAgo(1, 11, 40),
      createdByUserId: operatorUser.id,
      data: {
        customerName: 'Bahrain Medical Supplies Co.',
        paymentReference: 'SDD-9031842',
        currency: 'EUR',
        amount: 42800,
        exceptionReason: 'Duplicate debit posted after mandate retry',
      },
      outcome: {
        disposition: 'reversed',
        customerNotified: true,
        lossAmount: 0,
      },
      tasks: [
        {
          flowNodeKey: 'collect-documents',
          taskType: 'document_collection',
          title: 'Collect debit mandate and customer complaint',
          status: 'completed',
          assignedUserId: operatorUser.id,
          assignedTeamId: paymentsTeam.id,
          claimedAt: daysAgo(3, 10, 40),
          dueAt: daysAgo(2, 10, 25),
          completedAt: daysAgo(3, 12, 5),
          completedByUserId: operatorUser.id,
          input: { nodeConfig: { requiredDocuments: ['customer_complaint', 'sepa_mandate'] } },
          output: { documentsComplete: true },
        },
        {
          flowNodeKey: 'ops-review',
          taskType: 'review',
          title: 'Confirm duplicate debit and process reversal',
          status: 'completed',
          assignedUserId: supervisorUser.id,
          assignedTeamId: paymentsTeam.id,
          dueAt: daysAgo(2, 12, 0),
          completedAt: daysAgo(1, 11, 35),
          completedByUserId: supervisorUser.id,
          decision: 'reverse_duplicate',
          output: { reversalReference: 'REV-20260518-1192', customerNotified: true },
        },
      ],
      documents: [
        {
          taskIndex: 0,
          flowNodeKey: 'collect-documents',
          filename: 'customer-complaint-bms.pdf',
          mimeType: 'application/pdf',
          storagePath: 'seed/BF-20260516-PAY-2194/customer-complaint.pdf',
          documentType: 'customer_complaint',
          metadata: { channel: 'relationship_manager', pages: 3 },
          uploadedByUserId: operatorUser.id,
          uploadedAt: daysAgo(3, 11, 20),
        },
      ],
      notes: [
        {
          actorUserId: supervisorUser.id,
          summary: 'Duplicate debit reversed and confirmation sent to the relationship manager.',
          createdAt: daysAgo(1, 11, 40),
        },
      ],
    },
    {
      reference: 'BF-20260514-AML-0875',
      flowKey: 'aml-alert-review',
      title: 'Adverse media review - Meridian Petrochem FZE',
      status: 'closed',
      priority: 'high',
      currentNodeKey: null,
      assigneeUserId: approverUser.id,
      assigneeTeamId: kycTeam.id,
      intakeSource: 'kyc-registry.bankflow.local',
      openedAt: daysAgo(5, 9, 15),
      resolvedAt: daysAgo(3, 16, 10),
      closedAt: daysAgo(2, 10, 5),
      createdByUserId: approverUser.id,
      data: {
        customerName: 'Meridian Petrochem FZE',
        customerSegment: 'Corporate',
        trigger: 'Negative news refresh',
        jurisdiction: 'AE',
        riskRatingBefore: 'High',
        riskRatingAfter: 'High',
      },
      outcome: {
        disposition: 'relationship_retained',
        controlsAdded: ['quarterly adverse media refresh', 'enhanced source of wealth attestation'],
      },
      tasks: [
        {
          flowNodeKey: 'analyst-review',
          taskType: 'review',
          title: 'Review adverse media and ownership structure',
          status: 'completed',
          assignedUserId: approverUser.id,
          assignedTeamId: kycTeam.id,
          claimedAt: daysAgo(5, 9, 30),
          dueAt: daysAgo(4, 9, 15),
          completedAt: daysAgo(4, 14, 20),
          completedByUserId: approverUser.id,
          decision: 'retain_with_controls',
          output: { ownershipVerified: true, materialAdverseMedia: false },
        },
        {
          flowNodeKey: 'supervisor-approval',
          taskType: 'approval_support',
          title: 'Approve enhanced due diligence disposition',
          status: 'completed',
          assignedUserId: supervisorUser.id,
          assignedTeamId: paymentsTeam.id,
          dueAt: daysAgo(3, 17, 0),
          completedAt: daysAgo(3, 16, 10),
          completedByUserId: supervisorUser.id,
          decision: 'approved',
          output: { approvedControls: true },
        },
      ],
      approvals: [
        {
          flowNodeKey: 'supervisor-approval',
          approvalLabel: 'Approve AML disposition',
          status: 'approved',
          requestedFromUserId: supervisorUser.id,
          requestedAt: daysAgo(4, 14, 25),
          dueAt: daysAgo(3, 17, 0),
          decidedAt: daysAgo(3, 16, 10),
          decidedByUserId: supervisorUser.id,
          requiredComment: true,
          decisionReason: 'EDD evidence is complete and proposed monitoring controls are proportionate.',
        },
      ],
      documents: [
        {
          taskIndex: 0,
          flowNodeKey: 'analyst-review',
          filename: 'enhanced-due-diligence-meridian.pdf',
          mimeType: 'application/pdf',
          storagePath: 'seed/BF-20260514-AML-0875/edd-pack.pdf',
          documentType: 'edd_pack',
          metadata: { pages: 14, reviewedBy: 'Yusuf Al-Khalifa' },
          uploadedByUserId: auditorUser.id,
          uploadedAt: daysAgo(4, 13, 45),
        },
      ],
      notes: [
        {
          actorUserId: auditorUser.id,
          summary: 'Closed after audit spot-check confirmed approval rationale and evidence retention.',
          createdAt: daysAgo(2, 10, 0),
        },
      ],
    },
    {
      reference: 'BF-20260519-PAY-2240',
      flowKey: 'payment-exception-review',
      title: 'Manual repair needed for rejected salary batch',
      status: 'intake',
      priority: 'normal',
      currentNodeKey: 'collect-documents',
      assigneeTeamId: paymentsTeam.id,
      intakeSource: 'treasury-core.bankflow.local',
      openedAt: daysAgo(0, 11, 50),
      createdByUserId: designerUser.id,
      data: {
        batchReference: 'SAL-MAY26-BAH-014',
        employer: 'Harbour Facilities Management',
        recordCount: 86,
        currency: 'BHD',
        amount: 51240,
        exceptionReason: 'Four beneficiary accounts failed validation',
      },
      tasks: [
        {
          flowNodeKey: 'collect-documents',
          taskType: 'document_collection',
          title: 'Collect corrected salary batch authorization',
          status: 'pending',
          assignedTeamId: paymentsTeam.id,
          dueAt: hoursFromNow(18),
          input: { nodeConfig: { requiredDocuments: ['salary_batch_authorization'] } },
        },
      ],
      notes: [
        {
          actorUserId: designerUser.id,
          summary: 'Seeded as a fresh intake item so operators have a clean case to claim and progress.',
          createdAt: daysAgo(0, 11, 52),
        },
      ],
    },
  ]);

  await prisma.audit_logs.deleteMany({
    where: {
      action: {
        in: [
          'seed.user_login',
          'seed.case_reviewed',
          'seed.approval_requested',
          'seed.payment_repaired',
          'seed.audit_exported',
        ],
      },
    },
  });
  await prisma.audit_logs.createMany({
    data: [
      {
        actor_user_id: adminUser.id,
        action: 'seed.user_login',
        entity_type: 'user',
        entity_id: adminUser.id,
        data_json: JSON.stringify({ ip: '10.24.8.12', userAgent: 'BankFlow Desktop' }),
        created_at: daysAgo(0, 8, 15),
      },
      {
        actor_user_id: operatorUser.id,
        action: 'seed.case_reviewed',
        entity_type: 'case',
        data_json: JSON.stringify({ caseReference: 'BF-20260519-AML-1047', disposition: 'false_positive_with_controls' }),
        created_at: daysAgo(0, 10, 20),
      },
      {
        actor_user_id: supervisorUser.id,
        action: 'seed.approval_requested',
        entity_type: 'approval',
        data_json: JSON.stringify({ caseReference: 'BF-20260519-AML-1047', queue: 'Payments Operations' }),
        created_at: daysAgo(0, 10, 22),
      },
      {
        actor_user_id: supervisorUser.id,
        action: 'seed.payment_repaired',
        entity_type: 'case',
        data_json: JSON.stringify({ caseReference: 'BF-20260518-PAY-2218', paymentReference: 'FT24139008211' }),
        created_at: daysAgo(0, 9, 45),
      },
      {
        actor_user_id: auditorUser.id,
        action: 'seed.audit_exported',
        entity_type: 'case',
        data_json: JSON.stringify({ caseReference: 'BF-20260514-AML-0875', exportType: 'evidence_pack' }),
        created_at: daysAgo(2, 10, 12),
      },
    ],
  });

  console.log('Seeded roles, users, teams, and memberships.');
  console.log('Seeded allow-listed integration domains.');
  console.log('Seeded published demo flows: AML Alert Review, Payment Exception Review, High-Value Payment Release.');
  console.log('Seeded operational demo cases, tasks, approvals, documents, escalations, events, and audit logs.');
  console.log('');
  console.log('Default credentials:');
  for (const user of seedUsers) {
    console.log(`  ${user.credentialLabel.padEnd(11)} ${user.email} / ${user.password}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
