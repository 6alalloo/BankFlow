import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";
import { logAuditEvent } from "../services/auditService";

const router = Router();

router.use(authenticate);

const requireAdmin = (req: Request, res: Response): boolean => {
  if (!req.user || req.user.role !== "Admin") {
    res.status(403).json({ error: "Administrator privileges required" });
    return false;
  }
  return true;
};

const normalizeDomain = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const domainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

router.get("/allow-list", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const domains = await prisma.http_allow_list_domains.findMany({
    orderBy: { created_at: "desc" },
    include: { users: { select: { id: true, email: true } } },
  });

  res.json({ data: domains });
});

router.post("/allow-list", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const domain = normalizeDomain(req.body?.domain);
  if (!domain || !domainPattern.test(domain)) {
    res.status(400).json({ error: "A valid domain is required" });
    return;
  }

  const created = await prisma.http_allow_list_domains.upsert({
    where: { domain },
    update: {},
    create: {
      domain,
      created_by: req.user!.userId,
    },
    include: { users: { select: { id: true, email: true } } },
  });

  await logAuditEvent({
    eventType: "http_allow_list_domain_added",
    userId: req.user!.userId,
    targetType: "settings",
    targetId: created.id,
    details: { domain },
  });

  res.status(201).json({ data: created });
});

router.delete("/allow-list/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid allow-list id" });
    return;
  }

  const existing = await prisma.http_allow_list_domains.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }

  await prisma.http_allow_list_domains.delete({ where: { id } });

  await logAuditEvent({
    eventType: "http_allow_list_domain_removed",
    userId: req.user!.userId,
    targetType: "settings",
    targetId: id,
    details: { domain: existing.domain },
  });

  res.status(204).send();
});

export default router;
