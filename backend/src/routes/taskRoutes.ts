import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

router.get("/", async (_req: Request, res: Response) => {
  const tasks = await prisma.case_tasks.findMany({
    orderBy: [{ due_at: "asc" }, { id: "desc" }],
    include: {
      assigned_user: { select: { id: true, email: true, full_name: true } },
      assigned_team: true,
      cases: { select: { id: true, case_reference: true, title: true, status: true, priority: true } },
    },
  });

  res.json({ data: tasks });
});

router.post("/:id/claim", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }

  const task = await prisma.case_tasks.update({
    where: { id },
    data: {
      status: "claimed",
      assigned_user_id: req.user?.userId ?? null,
      claimed_at: new Date(),
      case_events: {
        create: {
          case_id: (await prisma.case_tasks.findUniqueOrThrow({ where: { id }, select: { case_id: true } })).case_id,
          actor_user_id: req.user?.userId ?? null,
          event_type: "task_claimed",
          summary: "Task claimed",
        },
      },
    },
  });

  res.json({ data: task });
});

router.post("/:id/complete", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }

  const existing = await prisma.case_tasks.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const task = await prisma.case_tasks.update({
    where: { id },
    data: {
      status: "completed",
      completed_at: new Date(),
      completed_by_user_id: req.user?.userId ?? null,
      decision: typeof req.body?.decision === "string" ? req.body.decision : null,
      output_json: req.body?.output || {},
      case_events: {
        create: {
          case_id: existing.case_id,
          actor_user_id: req.user?.userId ?? null,
          event_type: "task_completed",
          summary: "Task completed",
          data_json: req.body?.output || {},
        },
      },
    },
  });

  res.json({ data: task });
});

export default router;
