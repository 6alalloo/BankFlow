// backend/src/services/cvParserService.ts
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { getFilePath, getFileMetadata } from "./fileUploadService";
import { config } from "../config/appConfig";
import logger from "../lib/logger";

// CV Parser service URL from centralized config
const CV_PARSER_URL = config.cvParser.url;

export interface CVParseResult {
  success: boolean;
  source: string;
  filename?: string;
  data: {
    name: string | null;
    email: string | null;
    phone: string | null;
    skills: string[];
    experience_years: number | null;
    education: string[];
    raw_text?: string;
  };
  error?: string;
}

/**
 * Parse a CV file by its upload ID
 * Calls the cv-parser microservice directly
 */
export async function parseCV(fileId: string): Promise<CVParseResult> {
  // Check if cv-parser is healthy
  const isHealthy = await isCVParserHealthy();
  if (!isHealthy) {
    logger.warn('CV parser service is not healthy', { cvParserUrl: CV_PARSER_URL });
    return {
      success: false,
      source: "file",
      data: {
        name: null,
        email: null,
        phone: null,
        skills: [],
        experience_years: null,
        education: [],
      },
      error: `CV parser service unavailable at ${CV_PARSER_URL}. Make sure the service is running.`,
    };
  }

  // Get file path and metadata
  const filePath = getFilePath(fileId);
  const metadata = getFileMetadata(fileId);

  if (!filePath || !metadata) {
    return {
      success: false,
      source: "file",
      data: {
        name: null,
        email: null,
        phone: null,
        skills: [],
        experience_years: null,
        education: [],
      },
      error: `File not found: ${fileId}`,
    };
  }

  try {
    // Create form data with file stream (axios + form-data handles this properly)
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename: metadata.originalName,
      contentType: metadata.mimeType,
    });

    // Call cv-parser service using axios
    logger.info('Calling CV parser service', {
      cvParserUrl: CV_PARSER_URL,
      fileId,
      fileName: metadata.originalName,
      fileSize: metadata.size,
      mimeType: metadata.mimeType
    });

    const response = await axios.post(`${CV_PARSER_URL}/parse`, form, {
      headers: form.getHeaders(),
    });

    logger.debug('CV parser response received', {
      fileId,
      status: response.status
    });

    if (response.status !== 200) {
      logger.error('CV parser returned error status', {
        fileId,
        status: response.status,
        responseData: response.data
      });
      return {
        success: false,
        source: "file",
        filename: metadata.originalName,
        data: {
          name: null,
          email: null,
          phone: null,
          skills: [],
          experience_years: null,
          education: [],
        },
        error: `CV parser error: ${response.status} - ${JSON.stringify(response.data)}`,
      };
    }

    const result = response.data;
    logger.info('CV parse completed successfully', {
      fileId,
      fileName: metadata.originalName,
      resultPreview: JSON.stringify(result).slice(0, 200)
    });

    return {
      success: true,
      source: "file",
      filename: metadata.originalName,
      data: result.data || result,
    };
  } catch (err) {
    logger.error('Error calling CV parser service', {
      fileId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    return {
      success: false,
      source: "file",
      filename: metadata.originalName,
      data: {
        name: null,
        email: null,
        phone: null,
        skills: [],
        experience_years: null,
        education: [],
      },
      error: err instanceof Error ? err.message : "Failed to parse CV",
    };
  }
}

/**
 * Check if cv-parser service is healthy
 */
export async function isCVParserHealthy(): Promise<boolean> {
  try {
    const response = await axios.get(`${CV_PARSER_URL}/health`);
    return response.status === 200;
  } catch {
    return false;
  }
}
