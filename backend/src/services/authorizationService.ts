import prisma from "../lib/prisma";

const adminRoles = new Set(["Admin"]);
const supervisorRoles = new Set(["Supervisor"]);

export type CurrentUser = {
  userId: number;
  role: string;
};

export async function getUserTeamIds(userId: number): Promise<number[]> {
  const memberships = await prisma.team_memberships.findMany({
    where: { user_id: userId, teams: { is_active: true } },
    select: { team_id: true },
  });

  return memberships.map((membership) => membership.team_id);
}

export function canAdminister(role: string): boolean {
  return adminRoles.has(role);
}

export function canPublishFlow(role: string): boolean {
  return role === "Admin" || role === "Designer";
}

export function canViewAllOperationalQueues(role: string): boolean {
  return role === "Admin" || role === "Supervisor" || role === "Auditor";
}

export function canViewAudit(role: string): boolean {
  return role === "Admin" || role === "Auditor";
}

export async function canClaimTask(user: CurrentUser, task: {
  assigned_user_id: number | null;
  assigned_team_id: number | null;
}) {
  if (adminRoles.has(user.role) || supervisorRoles.has(user.role)) return true;
  if (task.assigned_user_id && task.assigned_user_id !== user.userId) return false;
  if (!task.assigned_team_id) return true;

  const teamIds = await getUserTeamIds(user.userId);
  return teamIds.includes(task.assigned_team_id);
}

export async function canCompleteTask(user: CurrentUser, task: {
  assigned_user_id: number | null;
  assigned_team_id: number | null;
}) {
  if (adminRoles.has(user.role) || supervisorRoles.has(user.role)) return true;
  if (task.assigned_user_id && task.assigned_user_id !== user.userId) return false;
  if (!task.assigned_team_id) return true;

  const teamIds = await getUserTeamIds(user.userId);
  return teamIds.includes(task.assigned_team_id);
}

export async function canDecideApproval(user: CurrentUser, approval: {
  requested_from_user_id: number | null;
  requested_from_team_id: number | null;
  requested_from_role_id: number | null;
}) {
  if (adminRoles.has(user.role)) return true;
  if (approval.requested_from_user_id && approval.requested_from_user_id !== user.userId) return false;
  if (approval.requested_from_team_id) {
    const teamIds = await getUserTeamIds(user.userId);
    if (!teamIds.includes(approval.requested_from_team_id)) return false;
  }
  if (approval.requested_from_role_id) {
    const currentUser = await prisma.users.findUnique({ where: { id: user.userId }, select: { role_id: true } });
    if (!currentUser || currentUser.role_id !== approval.requested_from_role_id) return false;
  }

  return Boolean(approval.requested_from_user_id || approval.requested_from_team_id || approval.requested_from_role_id);
}

export async function canViewCase(user: CurrentUser, caseRecord: {
  created_by_user_id: number | null;
  assignee_user_id: number | null;
  assignee_team_id: number | null;
}) {
  if (canViewAllOperationalQueues(user.role)) return true;
  if (caseRecord.created_by_user_id === user.userId || caseRecord.assignee_user_id === user.userId) return true;
  if (!caseRecord.assignee_team_id) return false;

  const teamIds = await getUserTeamIds(user.userId);
  return teamIds.includes(caseRecord.assignee_team_id);
}
