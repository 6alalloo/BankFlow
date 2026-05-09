import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { toInputJson } from "../lib/json";

type SlaProcessResult = {
  overdueTasks: number;
  overdueApprovals: number;
  escalationsCreated: number;
};

async function createEscalationIfMissing(
  tx: Prisma.TransactionClient,
  input: {
    caseId: number;
    sourceTaskId?: number | null;
    flowNodeKey?: string | null;
    reason: string;
    toTeamId?: number | null;
    toUserId?: number | null;
  }
) {
  const existing = await tx.case_escalations.findFirst({
    where: {
      case_id: input.caseId,
      source_task_id: input.sourceTaskId ?? null,
      flow_node_key: input.flowNodeKey ?? null,
      status: "triggered",
    },
  });

  if (existing) return null;

  const escalation = await tx.case_escalations.create({
    data: {
      case_id: input.caseId,
      source_task_id: input.sourceTaskId ?? null,
      flow_node_key: input.flowNodeKey ?? null,
      escalation_type: "sla_breach",
      reason: input.reason,
      to_team_id: input.toTeamId ?? null,
      to_user_id: input.toUserId ?? null,
    },
  });

  await tx.cases.update({
    where: { id: input.caseId },
    data: {
      status: "escalated",
      assignee_team_id: input.toTeamId ?? undefined,
      assignee_user_id: input.toUserId ?? undefined,
    },
  });

  await tx.case_events.create({
    data: {
      case_id: input.caseId,
      task_id: input.sourceTaskId ?? null,
      flow_node_key: input.flowNodeKey ?? null,
      event_type: "escalation_triggered",
      summary: input.reason,
      data_json: toInputJson({ escalationId: escalation.id, escalationType: "sla_breach" }),
    },
  });

  return escalation;
}

export async function processOverdueWork(now = new Date()): Promise<SlaProcessResult> {
  return prisma.$transaction(async (tx) => {
    const overdueTasks = await tx.case_tasks.findMany({
      where: {
        status: { in: ["pending", "assigned", "claimed"] },
        due_at: { lt: now },
        cases: { status: { notIn: ["closed", "cancelled", "resolved"] } },
      },
      select: {
        id: true,
        case_id: true,
        flow_node_key: true,
        title: true,
        assigned_team_id: true,
        assigned_user_id: true,
      },
    });

    const overdueApprovals = await tx.case_approvals.findMany({
      where: {
        status: "requested",
        due_at: { lt: now },
        cases: { status: { notIn: ["closed", "cancelled", "resolved"] } },
      },
      select: {
        id: true,
        case_id: true,
        flow_node_key: true,
        approval_label: true,
        requested_from_team_id: true,
        requested_from_user_id: true,
      },
    });

    if (overdueTasks.length > 0) {
      await tx.case_tasks.updateMany({
        where: { id: { in: overdueTasks.map((task) => task.id) } },
        data: { status: "overdue" },
      });
    }

    let escalationsCreated = 0;
    for (const task of overdueTasks) {
      const escalation = await createEscalationIfMissing(tx, {
        caseId: task.case_id,
        sourceTaskId: task.id,
        flowNodeKey: task.flow_node_key,
        reason: `Task overdue: ${task.title}`,
        toTeamId: task.assigned_team_id,
        toUserId: task.assigned_user_id,
      });
      if (escalation) escalationsCreated += 1;
    }

    for (const approval of overdueApprovals) {
      const escalation = await createEscalationIfMissing(tx, {
        caseId: approval.case_id,
        flowNodeKey: approval.flow_node_key,
        reason: `Approval overdue: ${approval.approval_label}`,
        toTeamId: approval.requested_from_team_id,
        toUserId: approval.requested_from_user_id,
      });
      if (escalation) escalationsCreated += 1;
    }

    return {
      overdueTasks: overdueTasks.length,
      overdueApprovals: overdueApprovals.length,
      escalationsCreated,
    };
  });
}
