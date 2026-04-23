// backend/src/routes/fileRoutes.ts
import { Router, Request, Response } from "express";
import {
  upload,
  saveFileMetadata,
  getFileMetadata,
  deleteFile,
} from "../services/fileUploadService";
import logger from "../lib/logger";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.use(authenticate);

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
