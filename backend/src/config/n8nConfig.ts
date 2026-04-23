// backend/src/config/n8nConfig.ts
import { config } from './appConfig';

/**
 * Base URL where n8n is reachable.
 * Now loaded from centralized appConfig.
 */
export const N8N_BASE_URL = config.n8n.baseUrl.replace(/\/$/, "");

/**
 * n8n REST API base (v1).
 * Docs: /api/v1/docs
 */
export const N8N_API_BASE_URL = `${N8N_BASE_URL}/api/v1`;

/**
 * API key for n8n v1 REST API.
 */
export const N8N_API_KEY = config.n8n.apiKey;

/**
 * Base URL for calling webhooks.
 * Usually identical to N8N_BASE_URL, but split out for clarity/future proxying.
 */
export const N8N_WEBHOOK_BASE_URL = config.n8n.webhookBaseUrl.replace(/\/$/, "");

/**
 * Generate unique webhook path per HRFlow workflow.
 * This avoids n8n "Conflicting Webhook Path" errors.
 */
export function buildHrflowWebhookPath(workflowId: number): string {
  return `/webhook/hrflow/${workflowId}/execute`;
}

export function buildHrflowWebhookUrl(workflowId: number): string {
  return `${N8N_WEBHOOK_BASE_URL}${buildHrflowWebhookPath(workflowId)}`;
}

/**
 * LEGACY (old design): single shared webhook path.
 * Retained for backward compatibility with existing workflows.
 */
export const N8N_HRFLOW_EXECUTE_PATH =
  process.env.N8N_HRFLOW_EXECUTE_PATH ?? "/webhook/hrflow/execute";

/**
 * LEGACY (old design): single shared webhook URL.
 */
export const N8N_EXECUTE_URL = `${N8N_WEBHOOK_BASE_URL}${N8N_HRFLOW_EXECUTE_PATH}`;
export const N8N_POSTGRES_CREDENTIAL_ID = config.n8n.postgresCredentialId;
export const N8N_POSTGRES_CREDENTIAL_NAME = config.n8n.postgresCredentialName;

export const N8N_SMTP_CREDENTIAL_ID = config.n8n.smtpCredentialId;
export const N8N_SMTP_CREDENTIAL_NAME = config.n8n.smtpCredentialName;
