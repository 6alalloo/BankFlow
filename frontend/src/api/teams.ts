import { apiGet } from "./apiClient";

export type TeamMemberUser = {
  id: number;
  email: string;
  full_name: string;
};

export type TeamMembership = {
  id: number;
  team_id: number;
  user_id: number;
  membership_role: string | null;
  is_primary: boolean;
  users?: TeamMemberUser | null;
};

export type Team = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  team_memberships?: TeamMembership[];
};

export type TeamsQuery = {
  active?: boolean;
  search?: string;
};

const toQueryString = (query: TeamsQuery = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : "";
};

export async function fetchTeams(query: TeamsQuery = {}): Promise<Team[]> {
  const response = await apiGet<{ data?: Team[] }>(`/teams${toQueryString(query)}`);
  return response.data ?? [];
}
