export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: {
    id: number;
    name: string;
  };
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}
