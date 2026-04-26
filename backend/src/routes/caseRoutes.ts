import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

const toInputJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;

router.get("/", async (_req: Request, res: Response) => {
  const cases = await prisma.cases.findMany({
    orderBy: { opened_at: "desc" },
    include: {
      assignee_user: { select: { id: true, email: true, full_name: true } },
      assignee_team: true,
      case_flows: { select: { id: true, key: true, name: true, case_type: true } },
    },
  });

  res.json({ data: cases });
});

router.post("/", async (req: Request, res: Response) => {
  const { flowId, title, priority, intakeSource, caseData } = req.body as {
    flowId?: number;
    title?: string;
    priority?: "low" | "normal" | "high" | "critical";
    intakeSource?: string;
    caseData?: Record<string, unknown>;
  };

  if (!flowId) {
    res.status(400).json({ error: "flowId is required" });
    return;
  }

  const flow = await prisma.case_flows.findUnique({
    where: { id: flowId },
    include: { current_published_version: true },
  });

  if (!flow || !flow.current_published_version) {
    res.status(400).json({ error: "Cases can only be created from published flows" });
    return;
  }

  const caseRecord = await prisma.cases.create({
    data: {
      case_flow_id: flow.id,
      case_flow_version_id: flow.current_published_version.id,
      case_reference: `BF-${Date.now()}`,
      case_type: flow.case_type,
      title: title || flow.name,
      priority: priority || "normal",
      intake_source: intakeSource || "manual",
      case_data_json: toInputJson(caseData),
      flow_snapshot_json: toInputJson(flow.current_published_version.graph_json),
      created_by_user_id: req.user?.userId ?? null,
      case_events: {
        create: {
          event_type: "case_created",
          summary: "Case created",
          actor_user_id: req.user?.userId ?? null,
          data_json: toInputJson({ intakeSource: intakeSource || "manual" }),
        },
      },
    },
    include: { case_events: true },
  });

  res.status(201).json({ data: caseRecord });
});

router.get("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid case id" });
    return;
  }

  const caseRecord = await prisma.cases.findUnique({
    where: { id },
    include: {
      case_tasks: { orderBy: { id: "asc" } },
      case_events: { orderBy: { created_at: "asc" } },
      case_approvals: true,
      case_escalations: true,
      case_documents: true,
      assignee_user: { select: { id: true, email: true, full_name: true } },
      assignee_team: true,
    },
  });

  if (!caseRecord) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  res.json({ data: caseRecord });
});

export default router;
