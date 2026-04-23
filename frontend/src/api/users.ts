import { apiGet, apiPost, apiPut, apiPatch } from './apiClient';

export interface Role {
  id: number;
  name: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  roles: Role;
}

export interface CreateUserInput {
  email: string;
  full_name: string;
  password: string;
  role_id: number;
}

export interface UpdateUserInput {
  email?: string;
  full_name?: string;
  role_id?: number;
}

interface UsersResponse {
  data: User[];
}

interface UserResponse {
  data: User;
}

interface RolesResponse {
  data: Role[];
}

export interface UserFilters {
  active?: boolean;
  role?: string;
  q?: string;
}

/**
 * Fetch all users with optional filters
 */
export async function getUsers(filters?: UserFilters): Promise<User[]> {
  const params = new URLSearchParams();

  if (filters?.active !== undefined) {
    params.append('active', String(filters.active));
  }
  if (filters?.role) {
    params.append('role', filters.role);
  }
  if (filters?.q) {
    params.append('q', filters.q);
  }

  const query = params.toString();
  const endpoint = query ? `/users?${query}` : '/users';

  const response = await apiGet<UsersResponse>(endpoint);
  return response.data;
}

/**
 * Fetch a single user by ID
 */
export async function getUserById(id: number): Promise<User> {
  const response = await apiGet<UserResponse>(`/users/${id}`);
  return response.data;
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const response = await apiPost<UserResponse>('/users', input);
  return response.data;
}

/**
 * Update an existing user
 */
export async function updateUser(id: number, input: UpdateUserInput): Promise<User> {
  const response = await apiPut<UserResponse>(`/users/${id}`, input);
  return response.data;
}

/**
 * Toggle user active status
 */
export async function toggleUserStatus(id: number, isActive: boolean): Promise<User> {
  const response = await apiPatch<UserResponse>(`/users/${id}/status`, { is_active: isActive });
  return response.data;
}

/**
 * Fetch all roles
 */
export async function getRoles(): Promise<Role[]> {
  const response = await apiGet<RolesResponse>('/roles');
  return response.data;
}

/**
 * Change a user's password (Admin can only change Operator passwords)
 */
export async function changeUserPassword(id: number, password: string): Promise<void> {
  await apiPatch<{ message: string }>(`/users/${id}/password`, { password });
}
