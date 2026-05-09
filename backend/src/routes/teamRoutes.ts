import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize } from "../middleware/authMiddleware";
import { logAuditEvent } from "../services/auditService";
import { pageMeta, parseBoolean, parsePageQuery } from "../lib/query";
import { Prisma } from "@prisma/client";

const router = Router();

router.use(authenticate);

router.get("/", async (req: Request, res: Response) => {
  const pageQuery = parsePageQuery(req);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const isActive = parseBoolean(req.query.active ?? req.query.is_active);
  const where: Prisma.teamsWhereInput = {};
  if (isActive !== undefined) where.is_active = isActive;
  if (search) {
    where.OR = [
      { key: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [teams, total] = await Promise.all([
    prisma.teams.findMany({
      where,
      skip: pageQuery.skip,
      take: pageQuery.take,
      orderBy: { name: "asc" },
      include: {
        team_memberships: {
          include: {
            users: { select: { id: true, email: true, full_name: true } },
          },
        },
      },
    }),
    prisma.teams.count({ where }),
  ]);

  res.json({ data: teams, page: pageMeta(pageQuery, total) });
});

router.post("/", authorize("Admin"), async (req: Request, res: Response) => {
  const { key, name, description } = req.body as {
    key?: string;
    name?: string;
    description?: string;
  };

  if (!key || !name) {
    res.status(400).json({ error: "key and name are required" });
    return;
  }

  const team = await prisma.teams.create({
    data: { key: key.trim(), name: name.trim(), description: description?.trim() || null },
  });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "team_created",
      userId: req.user.userId,
      targetType: "team",
      targetId: team.id,
      details: { key: team.key, name: team.name },
    });
  }

  res.status(201).json({ data: team });
});

router.patch("/:id", authorize("Admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid team id" });
    return;
  }

  const { name, description, isActive, is_active } = req.body as {
    name?: string;
    description?: string | null;
    isActive?: boolean;
    is_active?: boolean;
  };

  const data: { name?: string; description?: string | null; is_active?: boolean } = {};
  if (name !== undefined) {
    if (!name.trim()) {
      res.status(400).json({ error: "name cannot be empty" });
      return;
    }
    data.name = name.trim();
  }
  if (description !== undefined) data.description = description?.trim() || null;
  if (isActive !== undefined || is_active !== undefined) data.is_active = Boolean(isActive ?? is_active);

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No supported team fields provided" });
    return;
  }

  const existing = await prisma.teams.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const team = await prisma.teams.update({ where: { id }, data });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "team_updated",
      userId: req.user.userId,
      targetType: "team",
      targetId: team.id,
      details: data,
    });
  }

  res.json({ data: team });
});

router.post("/:id/members", authorize("Admin"), async (req: Request, res: Response) => {
  const teamId = Number(req.params.id);
  const userId = Number(req.body?.userId ?? req.body?.user_id);
  if (!Number.isInteger(teamId) || !Number.isInteger(userId)) {
    res.status(400).json({ error: "Valid team id and userId are required" });
    return;
  }

  const [team, user] = await Promise.all([
    prisma.teams.findUnique({ where: { id: teamId } }),
    prisma.users.findUnique({ where: { id: userId } }),
  ]);
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const membership = await prisma.team_memberships.upsert({
    where: { team_id_user_id: { team_id: teamId, user_id: userId } },
    update: {
      membership_role: typeof req.body?.membershipRole === "string" ? req.body.membershipRole : req.body?.membership_role ?? null,
      is_primary: Boolean(req.body?.isPrimary ?? req.body?.is_primary ?? false),
    },
    create: {
      team_id: teamId,
      user_id: userId,
      membership_role: typeof req.body?.membershipRole === "string" ? req.body.membershipRole : req.body?.membership_role ?? null,
      is_primary: Boolean(req.body?.isPrimary ?? req.body?.is_primary ?? false),
    },
    include: { users: { select: { id: true, email: true, full_name: true } }, teams: true },
  });

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "team_member_upserted",
      userId: req.user.userId,
      targetType: "team",
      targetId: teamId,
      details: { memberUserId: userId },
    });
  }

  res.status(201).json({ data: membership });
});

router.delete("/:id/members/:userId", authorize("Admin"), async (req: Request, res: Response) => {
  const teamId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (!Number.isInteger(teamId) || !Number.isInteger(userId)) {
    res.status(400).json({ error: "Invalid team or user id" });
    return;
  }

  const deleted = await prisma.team_memberships.deleteMany({
    where: { team_id: teamId, user_id: userId },
  });
  if (deleted.count === 0) {
    res.status(404).json({ error: "Team membership not found" });
    return;
  }

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "team_member_removed",
      userId: req.user.userId,
      targetType: "team",
      targetId: teamId,
      details: { memberUserId: userId },
    });
  }

  res.status(204).send();
});

export default router;
