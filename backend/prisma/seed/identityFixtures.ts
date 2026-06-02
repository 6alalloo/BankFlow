export const roleNames = ['Admin', 'Designer', 'Operator', 'Supervisor', 'Approver', 'Auditor'] as const;

export const seedUsers = [
  {
    email: 'admin@bankflow.local',
    password: 'admin123',
    fullName: 'Admin',
    roleName: 'Admin',
    credentialLabel: 'Admin',
  },
  {
    email: 'designer@bankflow.local',
    password: 'designer123',
    fullName: 'Designer',
    roleName: 'Designer',
    credentialLabel: 'Designer',
  },
  {
    email: 'operator@bankflow.local',
    password: 'operator123',
    fullName: 'Operator',
    roleName: 'Operator',
    credentialLabel: 'Operator',
  },
  {
    email: 'supervisor@bankflow.local',
    password: 'supervisor123',
    fullName: 'Supervisor',
    roleName: 'Supervisor',
    credentialLabel: 'Supervisor',
  },
  {
    email: 'approver@bankflow.local',
    password: 'approver123',
    fullName: 'Approver',
    roleName: 'Approver',
    credentialLabel: 'Approver',
  },
  {
    email: 'auditor@bankflow.local',
    password: 'auditor123',
    fullName: 'Auditor',
    roleName: 'Auditor',
    credentialLabel: 'Auditor',
  },
] as const;

export const seedTeams = [
  {
    key: 'aml-queue',
    name: 'AML Review Queue',
    description: 'Financial crime operations analysts handling AML alerts',
  },
  {
    key: 'payments-ops',
    name: 'Payments Operations',
    description: 'Operations team handling payment exceptions',
  },
  {
    key: 'kyc-remediation',
    name: 'KYC Remediation',
    description: 'Client due diligence specialists handling missing or stale KYC evidence',
  },
  {
    key: 'treasury-control',
    name: 'Treasury Control',
    description: 'Treasury control desk for high-value payment release and exception handling',
  },
] as const;

export const seedMemberships = [
  { teamKey: 'aml-queue', userEmail: 'operator@bankflow.local', membershipRole: 'analyst', isPrimary: true },
  { teamKey: 'payments-ops', userEmail: 'supervisor@bankflow.local', membershipRole: 'supervisor', isPrimary: true },
  { teamKey: 'payments-ops', userEmail: 'operator@bankflow.local', membershipRole: 'processor', isPrimary: false },
  { teamKey: 'kyc-remediation', userEmail: 'approver@bankflow.local', membershipRole: 'senior reviewer', isPrimary: true },
  { teamKey: 'treasury-control', userEmail: 'supervisor@bankflow.local', membershipRole: 'control lead', isPrimary: false },
] as const;

export const allowListDomains = [
  'sanctions.bankflow.local',
  'swift-gpi.bankflow.local',
  'kyc-registry.bankflow.local',
  'treasury-core.bankflow.local',
] as const;
