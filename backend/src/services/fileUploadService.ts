// backend/src/services/fileUploadService.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import logger from "../lib/logger";

/**
 * File Upload Configuration
 * These limits are intentionally hardcoded as business rules, not environment variables.
 */
export const FILE_UPLOAD_CONFIG = {
  /** Maximum file size: 10MB - intentional limit for CV/resume files */
  MAX_SIZE_MB: 10,
  /** File expiry time: 24 hours - temporary file cleanup policy */
  EXPIRY_HOURS: 24
} as const;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Store file metadata in memory (for MVP - could use database later)
const fileMetadata = new Map<string, FileMetadata>();

export interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: Date;
  expiresAt: Date;
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

// File filter - only allow PDFs and DOCX
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ];
  const allowedExtensions = [".pdf", ".docx", ".doc"];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and DOCX files are allowed"));
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: FILE_UPLOAD_CONFIG.MAX_SIZE_MB * 1024 * 1024,
  },
});

// Save file metadata after upload
export function saveFileMetadata(file: Express.Multer.File): FileMetadata {
  const id = path.basename(file.filename, path.extname(file.filename));
  const metadata: FileMetadata = {
    id,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
    uploadedAt: new Date(),
    expiresAt: new Date(Date.now() + FILE_UPLOAD_CONFIG.EXPIRY_HOURS * 60 * 60 * 1000),
  };

  fileMetadata.set(id, metadata);
  return metadata;
}

// Get file metadata by ID
export function getFileMetadata(id: string): FileMetadata | undefined {
  // First check in-memory cache
  const cached = fileMetadata.get(id);
  if (cached) return cached;

  // Fallback: scan uploads directory for matching files (handles server restarts)
  logger.info("File not in cache, scanning uploads directory", {
    service: "fileUploadService",
    fileId: id
  });

  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    logger.debug("Scanned uploads directory", {
      service: "fileUploadService",
      fileId: id,
      fileCount: files.length,
      uploadsDir: UPLOADS_DIR
    });

    const matchingFile = files.find((filename) => {
      const fileId = path.basename(filename, path.extname(filename));
      return fileId === id;
    });

    if (matchingFile) {
      logger.info("Found matching file on disk", {
        service: "fileUploadService",
        fileId: id,
        filename: matchingFile
      });

      const filePath = path.join(UPLOADS_DIR, matchingFile);
      const stats = fs.statSync(filePath);

      // Reconstruct metadata from file system
      const metadata: FileMetadata = {
        id,
        originalName: matchingFile, // We don't have original name, use filename
        mimeType: getMimeType(matchingFile),
        size: stats.size,
        path: filePath,
        uploadedAt: stats.birthtime,
        expiresAt: new Date(stats.birthtime.getTime() + FILE_UPLOAD_CONFIG.EXPIRY_HOURS * 60 * 60 * 1000),
      };

      // Cache it for future use
      fileMetadata.set(id, metadata);
      return metadata;
    }
  } catch (err) {
    logger.error("Error scanning uploads directory", {
      service: "fileUploadService",
      fileId: id,
      uploadsDir: UPLOADS_DIR,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
  }

  return undefined;
}

// Helper to guess MIME type from extension
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".doc":
      return "application/msword";
    default:
      return "application/octet-stream";
  }
}

// Get file path by ID
export function getFilePath(id: string): string | null {
  // Use getFileMetadata which has fallback logic for scanning directory
  const metadata = getFileMetadata(id);
  if (!metadata) return null;

  // Check if file still exists
  if (!fs.existsSync(metadata.path)) {
    fileMetadata.delete(id);
    return null;
  }

  return metadata.path;
}

// Get file buffer by ID
export function getFileBuffer(id: string): Buffer | null {
  const filePath = getFilePath(id);
  if (!filePath) return null;

  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

// Delete file by ID
export function deleteFile(id: string): boolean {
  const metadata = fileMetadata.get(id);
  if (!metadata) return false;

  try {
    if (fs.existsSync(metadata.path)) {
      fs.unlinkSync(metadata.path);
    }
    fileMetadata.delete(id);
    return true;
  } catch {
    return false;
  }
}

// Cleanup expired files (call periodically)
export function cleanupExpiredFiles(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [id, metadata] of fileMetadata.entries()) {
    if (metadata.expiresAt < now) {
      if (deleteFile(id)) {
        cleaned++;
      }
    }
  }

  return cleaned;
}

// Start cleanup interval (every hour)
setInterval(cleanupExpiredFiles, 60 * 60 * 1000);
