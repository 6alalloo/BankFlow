/**
 * Google Form Helper Utility
 *
 * Generates pre-filled Google Form URLs with workflow ID embedded
 * in the Workflow ID field for seamless form-to-workflow routing.
 */

/**
 * Generate a pre-filled Google Form URL for a specific workflow
 *
 * @param workflowId - The workflow ID to embed in the form
 * @returns Pre-filled Google Form URL with workflow ID
 */
export function generateGoogleFormUrl(workflowId: number): string {
  const baseUrl = process.env.GOOGLE_FORM_BASE_URL;
  const workflowIdEntry = process.env.GOOGLE_FORM_WORKFLOW_ID_ENTRY;

  if (!baseUrl || !workflowIdEntry) {
    throw new Error(
      'Google Form configuration missing. Please set GOOGLE_FORM_BASE_URL and GOOGLE_FORM_WORKFLOW_ID_ENTRY in .env'
    );
  }

  // Google Forms pre-fill URL format:
  // Short URL: https://forms.gle/{id}?entry.{entryId}={value}
  // Long URL:  https://docs.google.com/.../viewform?entry.{entryId}={value}
  
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}entry.${workflowIdEntry}=${workflowId}`;
}

/**
 * Validate Google Form configuration is present
 *
 * @returns true if configuration is valid, false otherwise
 */
export function isGoogleFormConfigured(): boolean {
  return !!(process.env.GOOGLE_FORM_BASE_URL && process.env.GOOGLE_FORM_WORKFLOW_ID_ENTRY);
}
