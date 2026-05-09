// backend/src/routes/fileRoutes.ts
import { Router, Request, Response } from "express";
import {
  upload,
  saveFileMetadata,
  getFileMetadata,
  deleteFile,
  getFilePath,
} from "../services/fileUploadService";
import logger from "../lib/logger";
import { authenticate } from "../middleware/authMiddleware";
import prisma from "../lib/prisma";
import { toInputJson } from "../lib/json";
import { logAuditEvent } from "../services/auditService";
import { canViewCase } from "../services/authorizationService";

const router = Router();

router.use(authenticate);

const toDocumentResponse = (document: {
  id: number;
  case_id: number;
  task_id: number | null;
  flow_node_key: string | null;
  filename: string;
  mime_type: string;
  document_type: string | null;
  metadata_json: unknown;
  uploaded_by_user_id: number | null;
  uploaded_at: Date;
}) => ({
  id: document.id,
  caseId: document.case_id,
  taskId: document.task_id,
  flowNodeKey: document.flow_node_key,
  filename: document.filename,
  mimeType: document.mime_type,
  documentType: document.document_type,
  metadata: document.metadata_json,
  uploadedByUserId: document.uploaded_by_user_id,
  uploadedAt: document.uploaded_at,
});

// Upload a file
router.post("/upload", upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const metadata = saveFileMetadata(req.file);

    res.status(201).json({
      success: true,
      file: {
        id: metadata.id,
        originalName: metadata.originalName,
        mimeType: metadata.mimeType,
        size: metadata.size,
        uploadedAt: metadata.uploadedAt.toISOString(),
        expiresAt: metadata.expiresAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error("File upload error", {
      service: "fileRoutes",
      requestId: (req as any).requestId,
      filename: req.file?.originalname,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to upload file",
    });
  }
});

router.post("/cases/:caseId/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const caseId = Number(req.params.caseId);
    const taskId = req.body?.taskId ? Number(req.body.taskId) : null;
    if (!Number.isInteger(caseId) || (taskId !== null && !Number.isInteger(taskId))) {
      res.status(400).json({ error: "Invalid case or task id" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const caseRecord = await prisma.cases.findUnique({
      where: { id: caseId },
      select: { id: true, created_by_user_id: true, assignee_user_id: true, assignee_team_id: true },
    });
    if (!caseRecord) {
      res.status(404).json({ error: "Case not found" });
      return;
    }
    if (!req.user || !(await canViewCase({ userId: req.user.userId, role: req.user.role }, caseRecord))) {
      res.status(403).json({ error: "You are not allowed to upload documents for this case" });
      return;
    }

    const task = taskId
      ? await prisma.case_tasks.findFirst({ where: { id: taskId, case_id: caseId }, select: { id: true, flow_node_key: true } })
      : null;
    if (taskId && !task) {
      res.status(404).json({ error: "Task not found for case" });
      return;
    }

    const metadata = saveFileMetadata(req.file);
    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.case_documents.create({
        data: {
          case_id: caseId,
          task_id: task?.id ?? null,
          flow_node_key: task?.flow_node_key ?? (typeof req.body?.flowNodeKey === "string" ? req.body.flowNodeKey : null),
          filename: metadata.originalName,
          mime_type: metadata.mimeType,
          storage_path: metadata.id,
          document_type: typeof req.body?.documentType === "string" ? req.body.documentType : null,
          metadata_json: toInputJson({ size: metadata.size }),
          uploaded_by_user_id: req.user?.userId ?? null,
        },
      });

      await tx.case_events.create({
        data: {
          case_id: caseId,
          task_id: task?.id ?? null,
          flow_node_key: task?.flow_node_key ?? null,
          actor_user_id: req.user?.userId ?? null,
          event_type: "document_uploaded",
          summary: `Document uploaded: ${metadata.originalName}`,
          data_json: toInputJson({ documentId: created.id, documentType: created.document_type }),
        },
      });

      return created;
    });

    if (req.user?.userId) {
      await logAuditEvent({
        eventType: "document_uploaded",
        userId: req.user.userId,
        targetType: "case_document",
        targetId: document.id,
        details: { caseId, taskId: task?.id ?? null, documentType: document.document_type },
      });
    }

    res.status(201).json({ data: toDocumentResponse(document) });
  } catch (err) {
    logger.error("Case document upload error", {
      service: "fileRoutes",
      requestId: (req as any).requestId,
      filename: req.file?.originalname,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to upload case document" });
  }
});

router.get("/cases/:caseId/documents", async (req: Request, res: Response) => {
  const caseId = Number(req.params.caseId);
  if (!Number.isInteger(caseId)) {
    res.status(400).json({ error: "Invalid case id" });
    return;
  }

  const caseRecord = await prisma.cases.findUnique({
    where: { id: caseId },
    select: { id: true, created_by_user_id: true, assignee_user_id: true, assignee_team_id: true },
  });
  if (!caseRecord) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  if (!req.user || !(await canViewCase({ userId: req.user.userId, role: req.user.role }, caseRecord))) {
    res.status(403).json({ error: "You are not allowed to view documents for this case" });
    return;
  }

  const documents = await prisma.case_documents.findMany({
    where: { case_id: caseId },
    orderBy: { uploaded_at: "desc" },
  });

  res.json({ data: documents.map(toDocumentResponse) });
});

router.get("/documents/:documentId", async (req: Request, res: Response) => {
  const documentId = Number(req.params.documentId);
  if (!Number.isInteger(documentId)) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }

  const document = await prisma.case_documents.findUnique({
    where: { id: documentId },
    include: {
      cases: { select: { id: true, created_by_user_id: true, assignee_user_id: true, assignee_team_id: true } },
    },
  });
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (!req.user || !(await canViewCase({ userId: req.user.userId, role: req.user.role }, document.cases))) {
    res.status(403).json({ error: "You are not allowed to view this document" });
    return;
  }

  res.json({ data: toDocumentResponse(document) });
});

router.get("/documents/:documentId/download", async (req: Request, res: Response) => {
  const documentId = Number(req.params.documentId);
  if (!Number.isInteger(documentId)) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }

  const document = await prisma.case_documents.findUnique({
    where: { id: documentId },
    include: {
      cases: { select: { id: true, created_by_user_id: true, assignee_user_id: true, assignee_team_id: true } },
    },
  });
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (!req.user || !(await canViewCase({ userId: req.user.userId, role: req.user.role }, document.cases))) {
    res.status(403).json({ error: "You are not allowed to download this document" });
    return;
  }

  const filePath = getFilePath(document.storage_path);
  if (!filePath) {
    res.status(404).json({ error: "Stored file not found" });
    return;
  }

  if (req.user?.userId) {
    await logAuditEvent({
      eventType: "document_downloaded",
      userId: req.user.userId,
      targetType: "case_document",
      targetId: document.id,
      details: { caseId: document.case_id, documentType: document.document_type },
    });
  }

  res.download(filePath, document.filename);
});

// Get file metadata
router.get("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const metadata = getFileMetadata(id);

  if (!metadata) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.json({
    id: metadata.id,
    originalName: metadata.originalName,
    mimeType: metadata.mimeType,
    size: metadata.size,
    uploadedAt: metadata.uploadedAt.toISOString(),
    expiresAt: metadata.expiresAt.toISOString(),
  });
});

// Delete a file
router.delete("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = deleteFile(id);

  if (!deleted) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.json({ success: true, message: "File deleted" });
});

export default router;
