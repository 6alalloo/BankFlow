import { getAuthToken } from "../contexts/AuthContext";
import { config } from "../config/appConfig";

const API_BASE_URL = config.apiBaseUrl;

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export type CaseSummary = {
  id: number;
  case_reference: string;
  case_type: string;
  title: string | null;
  status: string;
  priority: string;
  opened_at: string;
  assignee_user?: { id: number; email: string; full_name: string } | null;
  assignee_team?: { id: number; key: string; name: string } | null;
};

export async function fetchCases(): Promise<CaseSummary[]> {
  const response = await fetch(`${API_BASE_URL}/cases`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch cases (status ${response.status})`);
  }

  const json = (await response.json()) as { data?: CaseSummary[] };
  return json.data ?? [];
}
