import { getAuthToken } from "../contexts/authStorage";
import { config } from '../config/appConfig';

const API_BASE_URL = config.apiBaseUrl;

export interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

function getApiErrorMessage(errorData: unknown, fallback: string): string {
  if (!errorData || typeof errorData !== "object") return fallback;

  const error = (errorData as { error?: unknown; message?: unknown }).error;
  const message = (errorData as { message?: unknown }).message;

  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const nestedMessage = (error as { message?: unknown; code?: unknown; requestId?: unknown }).message;
    const requestId = (error as { requestId?: unknown }).requestId;
    if (typeof nestedMessage === "string") {
      return typeof requestId === "string" ? `${nestedMessage} (${requestId})` : nestedMessage;
    }
  }
  if (typeof message === "string") return message;

  return fallback;
}

export async function parseApiError(response: Response, fallback: string): Promise<string> {
  const errorData = await response.json().catch(() => ({}));
  return getApiErrorMessage(errorData, fallback);
}

export async function apiFetch(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<Response> {
  const { skipAuth = false, headers = {}, ...rest } = options;
  const token = getAuthToken();
  const isFormBody = typeof FormData !== "undefined" && rest.body instanceof FormData;

  const requestHeaders: HeadersInit = {
    ...(isFormBody ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
  };

  if (token && !skipAuth) {
    (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...rest,
    headers: requestHeaders,
  });

  if (response.status === 401) {
    localStorage.removeItem('bankflow_token');
    localStorage.removeItem('bankflow_user');
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  return response;
}

/**
 * Make an authenticated API request
 * Automatically adds Authorization header with Bearer token
 */
export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const response = await apiFetch(endpoint, options);

  if (!response.ok) {
    throw new Error(await parseApiError(response, `Request failed with status ${response.status}`));
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * GET request with authentication
 */
export async function apiGet<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * POST request with authentication
 */
export async function apiPost<T>(
  endpoint: string,
  data?: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request with authentication
 */
export async function apiPut<T>(
  endpoint: string,
  data?: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request with authentication
 */
export async function apiPatch<T>(
  endpoint: string,
  data?: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request with authentication
 */
export async function apiDelete<T = void>(
  endpoint: string,
  options?: ApiRequestOptions
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}

export { API_BASE_URL };
