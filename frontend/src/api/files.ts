import { apiFetch, parseApiError } from "./apiClient";
import type { CaseDocument } from "./cases";

export async function uploadCaseDocument(payload: {
  caseId: number;
  file: File;
  taskId?: number | null;
  documentType?: string | null;
  flowNodeKey?: string | null;
}): Promise<CaseDocument> {
  const form = new FormData();
  form.append("file", payload.file);
  if (payload.taskId) form.append("taskId", String(payload.taskId));
  if (payload.documentType) form.append("documentType", payload.documentType);
  if (payload.flowNodeKey) form.append("flowNodeKey", payload.flowNodeKey);

  const response = await apiFetch(`/files/cases/${payload.caseId}/upload`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, `Failed to upload document (status ${response.status})`));
  }

  const json = (await response.json()) as { data?: CaseDocument };
  if (!json.data) throw new Error("Unexpected upload response shape");
  return json.data;
}

export async function downloadCaseDocument(documentId: number, filename: string): Promise<void> {
  const response = await apiFetch(`/files/documents/${documentId}/download`);

  if (!response.ok) {
    throw new Error(await parseApiError(response, `Failed to download document (status ${response.status})`));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
