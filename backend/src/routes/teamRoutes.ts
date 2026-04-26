import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

router.get("/", async (_req: Request, res: Response) => {
  const teams = await prisma.teams.findMany({
    orderBy: { name: "asc" },
    include: {
      team_memberships: {
        include: {
          users: { select: { id: true, email: true, full_name: true } },
        },
      },
    },
  });

  res.json({ data: teams });
});

router.post("/", async (req: Request, res: Response) => {
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
    data: { key, name, description: description || null },
  });

  res.status(201).json({ data: team });
});

export default router;
