import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
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

  console.log('Seeded roles, users, teams, and memberships.');
  console.log('');
  console.log('Default credentials:');
  console.log('  Admin:      admin@bankflow.local / admin123');
  console.log('  Operator:   operator@bankflow.local / operator123');
  console.log('  Supervisor: supervisor@bankflow.local / supervisor123');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
