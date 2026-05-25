import { useEffect, useState, type ReactNode } from "react";

import { config } from "../config/appConfig";
import { AuthContext } from "./AuthContext";
import {
  clearStoredAuthSession,
  getInitialToken,
  getInitialUser,
  storeAuthSession,
  TOKEN_KEY,
} from "./authStorage";
import type { AuthContextType, AuthUser } from "./authTypes";

const API_BASE_URL = config.apiBaseUrl;

function getAuthErrorMessage(errorData: unknown): string {
  if (!errorData || typeof errorData !== "object") return "Login failed";

  const { error, message } = errorData as { error?: unknown; message?: unknown };
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const nestedMessage = (error as { message?: unknown }).message;
    if (typeof nestedMessage === "string") return nestedMessage;
  }
  if (typeof message === "string") return message;

  return "Login failed";
}

async function verifyAuthToken(currentToken: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${currentToken}`,
    },
  });

  return res.ok;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  const [token, setToken] = useState<string | null>(getInitialToken);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = () => {
    clearStoredAuthSession();
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    const verifyStoredToken = async () => {
      const currentToken = localStorage.getItem(TOKEN_KEY);

      if (!currentToken) {
        setIsLoading(false);
        return;
      }

      try {
        const isValid = await verifyAuthToken(currentToken);

        if (!isValid) {
          clearAuth();
        }
      } catch {
        // Keep cached credentials available during a temporary network failure.
      }

      setIsLoading(false);
    };

    verifyStoredToken();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: getAuthErrorMessage(data) };
      }

      storeAuthSession(data.token, data.user);
      setToken(data.token);
      setUser(data.user);

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    logout: clearAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
