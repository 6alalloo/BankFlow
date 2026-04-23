/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { config } from '../config/appConfig';

const API_BASE_URL = config.apiBaseUrl;

// Storage keys
const TOKEN_KEY = 'hrflow_token';
const USER_KEY = 'hrflow_user';

// Types
export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: {
    id: number;
    name: string;
  };
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

// Helper to get initial state from localStorage
function getInitialToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getInitialUser(): AuthUser | null {
  const storedUser = localStorage.getItem(USER_KEY);
  if (storedUser) {
    try {
      return JSON.parse(storedUser) as AuthUser;
    } catch {
      return null;
    }
  }
  return null;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  logout: () => {},
});

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Use lazy initialization to avoid setState in useEffect
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  const [token, setToken] = useState<string | null>(getInitialToken);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  // Verify token on mount
  useEffect(() => {
    const verifyStoredToken = async () => {
      const currentToken = localStorage.getItem(TOKEN_KEY);

      if (!currentToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });

        if (!res.ok) {
          // Token expired, clear state
          clearAuth();
        }
      } catch {
        // Network error, keep current state but don't clear
        // This allows offline usage with cached credentials
      }

      setIsLoading(false);
    };

    verifyStoredToken();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      // Store token and user
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = () => {
    clearAuth();
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export a function to get the current token (for API calls)
export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export default AuthContext;
