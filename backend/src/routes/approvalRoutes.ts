import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;

router.get("/", async (_req: Request, res: Response) => {
  const approvals = await prisma.case_approvals.findMany({
    orderBy: [{ due_at: "asc" }, { requested_at: "desc" }],
    include: {
      cases: { select: { id: true, case_reference: true, title: true, status: true } },
      requested_from_user: { select: { id: true, email: true, full_name: true } },
      requested_from_role: true,
      requested_from_team: true,
      decided_by_user: { select: { id: true, email: true, full_name: true } },
    },
  });

  res.json({ data: approvals });
});

async function decideApproval(id: number, decision: "approved" | "rejected", userId: number | undefined, reason?: string) {
  const existing = await prisma.case_approvals.findUnique({ where: { id } });
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    const approval = await tx.case_approvals.update({
      where: { id },
      data: {
        status: decision,
        decided_at: new Date(),
        decided_by_user_id: userId ?? null,
        decision_reason: reason || null,
      },
    });

    await tx.case_events.create({
      data: {
        case_id: existing.case_id,
        actor_user_id: userId ?? null,
        event_type: "approval_decided",
        summary: `Approval ${decision}`,
        data_json: toInputJson({ approvalId: id, decision, reason }),
      },
    });

    return approval;
  });
}

router.post("/:id/approve", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid approval id" });
    return;
  }

  const approval = await decideApproval(id, "approved", req.user?.userId, req.body?.reason);
  if (!approval) {
    res.status(404).json({ error: "Approval not found" });
    return;
  }

  res.json({ data: approval });
});

router.post("/:id/reject", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid approval id" });
    return;
  }

  const approval = await decideApproval(id, "rejected", req.user?.userId, req.body?.reason);
  if (!approval) {
    res.status(404).json({ error: "Approval not found" });
    return;
  }

  res.json({ data: approval });
});

export default router;
