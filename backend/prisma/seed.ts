import { Prisma, PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;

type DemoNode = {
  node_key: string;
  kind: string;
  name: string;
  config_json: Record<string, unknown>;
  pos_x: number;
  pos_y: number;
};

type DemoEdge = {
  edge_key: string;
  from_node_key: string;
  to_node_key: string;
  label?: string | null;
  priority?: number;
};

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

async function main() {
  console.log('Starting BankFlow database seed...');

  const roles = await Promise.all(
    ['Admin', 'Designer', 'Operator', 'Supervisor', 'Approver', 'Auditor'].map((name) =>
      prisma.roles.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  const roleByName = new Map(roles.map((role) => [role.name, role]));
  const adminRole = roleByName.get('Admin')!;
  const operatorRole = roleByName.get('Operator')!;
  const supervisorRole = roleByName.get('Supervisor')!;
  const approverRole = roleByName.get('Approver')!;

  const adminUser = await prisma.users.upsert({
    where: { email: 'admin@bankflow.local' },
    update: { password_hash: await hashPassword('admin123') },
    create: {
      email: 'admin@bankflow.local',
      password_hash: await hashPassword('admin123'),
      full_name: 'BankFlow Administrator',
      role_id: adminRole.id,
    },
  });

  const operatorUser = await prisma.users.upsert({
    where: { email: 'operator@bankflow.local' },
    update: { password_hash: await hashPassword('operator123') },
    create: {
      email: 'operator@bankflow.local',
      password_hash: await hashPassword('operator123'),
      full_name: 'Operations Analyst',
      role_id: operatorRole.id,
    },
  });

  const supervisorUser = await prisma.users.upsert({
    where: { email: 'supervisor@bankflow.local' },
    update: { password_hash: await hashPassword('supervisor123') },
    create: {
      email: 'supervisor@bankflow.local',
      password_hash: await hashPassword('supervisor123'),
      full_name: 'Operations Supervisor',
      role_id: supervisorRole.id,
    },
  });

  await prisma.users.upsert({
    where: { email: 'approver@bankflow.local' },
    update: { password_hash: await hashPassword('approver123') },
    create: {
      email: 'approver@bankflow.local',
      password_hash: await hashPassword('approver123'),
      full_name: 'Credit Approver',
      role_id: approverRole.id,
    },
  });

  const amlTeam = await prisma.teams.upsert({
    where: { key: 'aml-queue' },
    update: {},
    create: {
      key: 'aml-queue',
      name: 'AML Review Queue',
      description: 'Financial crime operations analysts handling AML alerts',
    },
  });

  const paymentsTeam = await prisma.teams.upsert({
    where: { key: 'payments-ops' },
    update: {},
    create: {
      key: 'payments-ops',
      name: 'Payments Operations',
      description: 'Operations team handling payment exceptions',
    },
  });

  await prisma.team_memberships.upsert({
    where: { team_id_user_id: { team_id: amlTeam.id, user_id: operatorUser.id } },
    update: {},
    create: {
      team_id: amlTeam.id,
      user_id: operatorUser.id,
      membership_role: 'analyst',
      is_primary: true,
    },
  });

  await prisma.team_memberships.upsert({
    where: { team_id_user_id: { team_id: paymentsTeam.id, user_id: supervisorUser.id } },
    update: {},
    create: {
      team_id: paymentsTeam.id,
      user_id: supervisorUser.id,
      membership_role: 'supervisor',
      is_primary: true,
    },
  });

  await seedPublishedFlow({
    key: 'aml-alert-review',
    name: 'AML Alert Review',
    description: 'Review AML alerts, collect evidence, and request supervisor approval when needed.',
    caseType: 'aml_alert',
    ownerUserId: adminUser.id,
    nodes: [
      { node_key: 'start', kind: 'trigger', name: 'Alert received', config_json: {}, pos_x: 0, pos_y: 0 },
      {
        node_key: 'analyst-review',
        kind: 'review',
        name: 'Analyst review',
        config_json: { title: 'Review AML alert', assignedTeamId: amlTeam.id, claimPolicy: 'claim_required', dueInHours: 8 },
        pos_x: 220,
        pos_y: 0,
      },
      {
        node_key: 'supervisor-approval',
        kind: 'approval',
        name: 'Supervisor approval',
        config_json: { label: 'Approve AML disposition', requestedFromTeamId: paymentsTeam.id, requiredComment: true, dueInHours: 24 },
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
        config_json: { reason: 'Supervisor rejected AML disposition', toTeamId: paymentsTeam.id },
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
  });

  await seedPublishedFlow({
    key: 'payment-exception-review',
    name: 'Payment Exception Review',
    description: 'Handle payment exceptions with document evidence and operations routing.',
    caseType: 'payment_exception',
    ownerUserId: adminUser.id,
    nodes: [
      { node_key: 'start', kind: 'trigger', name: 'Exception received', config_json: {}, pos_x: 0, pos_y: 0 },
      {
        node_key: 'collect-documents',
        kind: 'document_collection',
        name: 'Collect payment evidence',
        config_json: { title: 'Collect payment evidence', assignedTeamId: paymentsTeam.id, claimPolicy: 'claim_required', requiredDocuments: ['payment_instruction'], dueInHours: 12 },
        pos_x: 220,
        pos_y: 0,
      },
      {
        node_key: 'ops-review',
        kind: 'review',
        name: 'Operations review',
        config_json: { title: 'Resolve payment exception', assignedTeamId: paymentsTeam.id, claimPolicy: 'claim_required', dueInHours: 12 },
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
  });

  console.log('Seeded roles, users, teams, and memberships.');
  console.log('Seeded published demo flows: AML Alert Review, Payment Exception Review.');
  console.log('');
  console.log('Default credentials:');
  console.log('  Admin:      admin@bankflow.local / admin123');
  console.log('  Operator:   operator@bankflow.local / operator123');
  console.log('  Supervisor: supervisor@bankflow.local / supervisor123');
  console.log('  Approver:   approver@bankflow.local / approver123');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
