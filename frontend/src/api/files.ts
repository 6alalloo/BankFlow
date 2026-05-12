import { getAuthToken } from "../contexts/AuthContext";
import { API_BASE_URL } from "./apiClient";
import type { CaseDocument } from "./cases";

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const json = (await response.json()) as { error?: string; message?: string };
    return json.error || json.message || fallback;
  } catch {
    return fallback;
  }
}

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

  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/files/cases/${payload.caseId}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (!response.ok) {
    throw new Error(await parseError(response, `Failed to upload document (status ${response.status})`));
  }

  const json = (await response.json()) as { data?: CaseDocument };
  if (!json.data) throw new Error("Unexpected upload response shape");
  return json.data;
}

export async function downloadCaseDocument(documentId: number, filename: string): Promise<void> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/files/documents/${documentId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(await parseError(response, `Failed to download document (status ${response.status})`));
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
