import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function ensureTemplateWorkflow(
  adminUserId: number,
  workflow: {
    name: string;
    description: string;
    webhookPath: string;
    nodes: Array<{
      key: string;
      kind: string;
      name: string;
      config: Record<string, unknown>;
      posX: number;
      posY: number;
    }>;
    edges: Array<{
      from: string;
      to: string;
      label?: string;
      condition?: Record<string, unknown>;
    }>;
  }
) {
  const existing = await prisma.workflows.findFirst({
    where: { name: workflow.name }
  });

  if (existing) {
    console.log(`Template workflow "${workflow.name}" already exists, skipping...`);
    return;
  }

  const created = await prisma.workflows.create({
    data: {
      name: workflow.name,
      description: workflow.description,
      is_active: true,
      owner_user_id: adminUserId,
      n8n_webhook_path: workflow.webhookPath
    }
  });

  const nodeMap = new Map<string, number>();

  for (const node of workflow.nodes) {
    const createdNode = await prisma.workflow_nodes.create({
      data: {
        workflow_id: created.id,
        kind: node.kind,
        name: node.name,
        config_json: JSON.stringify(node.config),
        pos_x: node.posX,
        pos_y: node.posY
      }
    });

    nodeMap.set(node.key, createdNode.id);
  }

  for (const edge of workflow.edges) {
    await prisma.workflow_edges.create({
      data: {
        workflow_id: created.id,
        from_node_id: nodeMap.get(edge.from)!,
        to_node_id: nodeMap.get(edge.to)!,
        label: edge.label ?? null,
        condition_json: JSON.stringify(edge.condition ?? {})
      }
    });
  }

  console.log(`Created template workflow: ${workflow.name} (${created.id})`);
}

async function main() {
  console.log('Starting database seed...');

  const adminRole = await prisma.roles.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin' }
  });

  const operatorRole = await prisma.roles.upsert({
    where: { name: 'Operator' },
    update: {},
    create: { name: 'Operator' }
  });

  console.log(`Roles created: Admin (${adminRole.id}), Operator (${operatorRole.id})`);

  const adminPasswordHash = await hashPassword('admin123');
  const operatorPasswordHash = await hashPassword('operator123');

  const adminUser = await prisma.users.upsert({
    where: { email: 'admin@bankflow.local' },
    update: {
      password_hash: adminPasswordHash
    },
    create: {
      email: 'admin@bankflow.local',
      password_hash: adminPasswordHash,
      full_name: 'BankFlow Administrator',
      is_active: true,
      role_id: adminRole.id
    }
  });

  const operatorUser = await prisma.users.upsert({
    where: { email: 'operator@bankflow.local' },
    update: {
      password_hash: operatorPasswordHash
    },
    create: {
      email: 'operator@bankflow.local',
      password_hash: operatorPasswordHash,
      full_name: 'Operations Analyst',
      is_active: true,
      role_id: operatorRole.id
    }
  });

  console.log(`Users created: admin@bankflow.local (${adminUser.id}), operator@bankflow.local (${operatorUser.id})`);

  const migrated = await prisma.workflows.updateMany({
    where: { owner_user_id: null },
    data: { owner_user_id: adminUser.id }
  });

  console.log(`Migrated ${migrated.count} orphan workflows to admin user`);

  await ensureTemplateWorkflow(adminUser.id, {
    name: '[Template] AML Alert Review',
    description: 'Template workflow for AML alert triage. Assigns a priority, routes to analyst review, and records an audit-style log entry.',
    webhookPath: '/webhook/bankflow/template-aml-alert-review/execute',
    nodes: [
      {
        key: 'trigger',
        kind: 'trigger',
        name: 'Alert Intake',
        config: {
          name: '',
          email: '',
          department: 'Financial Crime Operations',
          role: 'AML Alert Review',
          startDate: '',
          managerEmail: ''
        },
        posX: 100,
        posY: 200
      },
      {
        key: 'variable',
        kind: 'variable',
        name: 'Set Priority',
        config: {
          variables: [
            { key: 'caseType', value: 'aml_alert' },
            { key: 'priority', value: 'high' }
          ]
        },
        posX: 360,
        posY: 200
      },
      {
        key: 'email',
        kind: 'email',
        name: 'Notify Analyst Queue',
        config: {
          to: 'aml-queue@example.com',
          subject: 'AML alert queued for review',
          body: 'A new AML alert is ready for analyst review.'
        },
        posX: 620,
        posY: 200
      },
      {
        key: 'logger',
        kind: 'logger',
        name: 'Record Alert Event',
        config: {
          message: 'AML alert case created and queued for review',
          level: 'info',
          includeInput: true
        },
        posX: 880,
        posY: 200
      }
    ],
    edges: [
      { from: 'trigger', to: 'variable' },
      { from: 'variable', to: 'email' },
      { from: 'email', to: 'logger' }
    ]
  });

  await ensureTemplateWorkflow(adminUser.id, {
    name: '[Template] Payment Exception Review',
    description: 'Template workflow for payment exception handling. Notifies operations, waits for review, and records outcome tracking.',
    webhookPath: '/webhook/bankflow/template-payment-exception-review/execute',
    nodes: [
      {
        key: 'trigger',
        kind: 'trigger',
        name: 'Exception Intake',
        config: {
          name: '',
          email: '',
          department: 'Payments Operations',
          role: 'Payment Exception Review',
          startDate: '',
          managerEmail: ''
        },
        posX: 100,
        posY: 200
      },
      {
        key: 'http',
        kind: 'http',
        name: 'Notify Ops API',
        config: {
          method: 'POST',
          url: '',
          headers: [{ key: 'Content-Type', value: 'application/json' }],
          body: JSON.stringify({
            caseName: '{{trigger.name}}',
            contactEmail: '{{trigger.email}}',
            queue: '{{trigger.department}}'
          }, null, 2)
        },
        posX: 360,
        posY: 200
      },
      {
        key: 'wait',
        kind: 'wait',
        name: 'Hold for Review',
        config: {
          duration: 30,
          unit: 'minutes'
        },
        posX: 620,
        posY: 200
      },
      {
        key: 'logger',
        kind: 'logger',
        name: 'Record Review Event',
        config: {
          message: 'Payment exception case entered manual review',
          level: 'info',
          includeInput: true
        },
        posX: 880,
        posY: 200
      }
    ],
    edges: [
      { from: 'trigger', to: 'http' },
      { from: 'http', to: 'wait' },
      { from: 'wait', to: 'logger' }
    ]
  });

  console.log('');
  console.log('Database seed completed successfully!');
  console.log('');
  console.log('Default credentials:');
  console.log('  Admin:    admin@bankflow.local / admin123');
  console.log('  Operator: operator@bankflow.local / operator123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
