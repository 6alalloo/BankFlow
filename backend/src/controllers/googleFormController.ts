import { Request, Response } from "express";
import * as executionService from "../services/executionService";
import prisma from "../lib/prisma";
import logger from "../lib/logger";

/**
 * Comprehensive field mapping for Google Form field normalization
 * Maps common field name variations to standardized internal keys
 * Uses flat structure for simpler variable access: {{trigger.name}}
 */
const FIELD_MAPPINGS: Record<string, string> = {
  // Name variations
  'name': 'name',
  'full name': 'name',
  'your name': 'name',
  'employee name': 'name',
  'candidate name': 'name',
  'applicant name': 'name',

  // Email variations
  'email': 'email',
  'email address': 'email',
  'your email': 'email',
  'e-mail': 'email',

  // Phone variations
  'phone': 'phone',
  'phone number': 'phone',
  'mobile': 'phone',
  'mobile number': 'phone',
  'contact number': 'phone',
  'telephone': 'phone',

  // Department variations
  'department': 'department',
  'team': 'department',
  'division': 'department',
  'unit': 'department',

  // Role variations
  'role': 'role',
  'job title': 'role',
  'position': 'role',
  'job position': 'role',
  'title': 'role',

  // Resume variations
  'resume': 'resume_url',
  'cv': 'resume_url',
  'upload resume': 'resume_url',
  'upload cv': 'resume_url',
  'your resume': 'resume_url',
  'attach resume': 'resume_url',
  'attach cv': 'resume_url',

  // Start date variations
  'start date': 'start_date',
  'starting date': 'start_date',
  'join date': 'start_date',
  'joining date': 'start_date',
  'start': 'start_date',

  // Manager variations
  'manager email': 'manager_email',
  'manager': 'manager_email',
  'reporting to': 'manager_email',
  'supervisor email': 'manager_email',
  'supervisor': 'manager_email',

  // Workflow ID (special handling - skip in output)
  'workflow id': '__workflow_id__',
};

/**
 * Fuzzy match a raw form field key to a standardized field name.
 * Handles common variations like "What is your name?" -> "name" by cleaning
 * punctuation and performing partial string matching against known field patterns.
 *
 * @param rawKey - The raw field name from Google Forms
 * @returns Matched standardized field name or null
 */
function fuzzyMatch(rawKey: string): string | null {
  // Clean the key: lowercase, strip punctuation, trim extra spaces
  const cleaned = rawKey.toLowerCase()
    .replace(/[?.,!:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Direct match first (most efficient)
  if (FIELD_MAPPINGS[cleaned]) {
    return FIELD_MAPPINGS[cleaned];
  }

  // Partial match: check if any mapping key is contained in the question
  // Sort by key length descending to match longer keys first (more specific)
  const sortedKeys = Object.keys(FIELD_MAPPINGS).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (cleaned.includes(key)) {
      return FIELD_MAPPINGS[key];
    }
  }

  return null;
}

/**
 * Normalize Google Form payload to flat structure
 * Returns standardized fields + preserves custom fields
 *
 * @param formData - Raw form data from Google Forms
 * @returns Flat normalized data: { name, email, phone, ... }
 */
function normalizeGoogleFormData(formData: Record<string, unknown>) {
  // Initialize with standard schema fields (all null by default)
  const normalized: Record<string, unknown> = {
    name: null,
    email: null,
    phone: null,
    department: null,
    role: null,
    resume_url: null,
    start_date: null,
    manager_email: null,
  };

  // Process each form field
  for (const [rawKey, value] of Object.entries(formData)) {
    const mappedKey = fuzzyMatch(rawKey);

    if (mappedKey === '__workflow_id__') {
      // Skip workflow ID - it's already in the URL param
      continue;
    }

    if (mappedKey && Object.prototype.hasOwnProperty.call(normalized, mappedKey)) {
      // Map to standard field
      normalized[mappedKey] = value;
    } else {
      // Preserve original field for custom questions
      normalized[rawKey] = value;
    }
  }

  return normalized;
}

/**
 * Handle Google Form webhook submission
 *
 * Endpoint: POST /webhooks/google-form/:workflowId?token=xxx
 *
 * Validates token, normalizes form data, and triggers workflow execution
 */
export async function handleGoogleFormSubmission(req: Request, res: Response) {
  try {
    // 1. Validate security token
    const token = req.query.token as string | undefined;
    const expectedToken = process.env.WEBHOOK_SECRET_KEY;

    if (!expectedToken) {
      logger.error("WEBHOOK_SECRET_KEY not configured in .env", {
        service: "GoogleFormController"
      });
      return res.status(500).json({
        success: false,
        error: "Webhook authentication not configured",
      });
    }

    if (!token || token !== expectedToken) {
      logger.warn("Invalid or missing token attempt", {
        service: "GoogleFormController"
      });
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or missing token",
      });
    }

    // 2. Validate workflowId
    const workflowId = parseInt(req.params.workflowId, 10);
    if (isNaN(workflowId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid workflow ID",
      });
    }

    // 3. Check workflow exists and is active
    const workflow = await prisma.workflows.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      logger.warn("Workflow not found", {
        service: "GoogleFormController",
        workflowId
      });
      return res.status(404).json({
        success: false,
        error: "Workflow not found",
      });
    }

    if (!workflow.is_active) {
      logger.warn("Workflow is not active", {
        service: "GoogleFormController",
        workflowId
      });
      return res.status(400).json({
        success: false,
        error: "Workflow is not active",
      });
    }

    // 4. Parse and normalize form data
    const formData = req.body as Record<string, unknown>;
    logger.info("Received form data for workflow", {
      service: "GoogleFormController",
      workflowId,
      formData
    });

    const normalizedData = normalizeGoogleFormData(formData);
    logger.debug("Normalized form data", {
      service: "GoogleFormController",
      workflowId,
      normalizedData
    });

    // 5. Execute workflow
    const result = await executionService.executeWorkflow({
      workflowId,
      triggerType: "google_form",
      input: normalizedData,
    });

    logger.info("Workflow execution started", {
      service: "GoogleFormController",
      workflowId,
      executionId: result.execution.id
    });

    // 6. Return 202 Accepted (execution is async)
    return res.status(202).json({
      success: true,
      message: "Workflow execution started",
      executionId: result.execution.id,
    });
  } catch (error) {
    logger.error("Google Form webhook error", {
      service: "GoogleFormController",
      workflowId: req.params.workflowId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
