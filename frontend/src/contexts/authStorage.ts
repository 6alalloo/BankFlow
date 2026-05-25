import type { AuthUser } from "./authTypes";

export const TOKEN_KEY = "bankflow_token";
export const USER_KEY = "bankflow_user";

export const getAuthToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const getInitialToken = (): string | null => getAuthToken();

export const getInitialUser = (): AuthUser | null => {
  const storedUser = localStorage.getItem(USER_KEY);
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    return null;
  }
};

export const storeAuthSession = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearStoredAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
