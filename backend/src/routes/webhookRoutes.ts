import { Router } from "express";
import * as googleFormController from "../controllers/googleFormController";

const router = Router();

/**
 * Google Form webhook endpoint
 *
 * POST /webhooks/google-form/:workflowId?token=xxx
 *
 * Receives form submissions from Google Forms via Apps Script,
 * normalizes the data, and triggers the associated workflow.
 */
router.post(
  "/google-form/:workflowId",
  googleFormController.handleGoogleFormSubmission
);

export default router;
