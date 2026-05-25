import { createContext } from "react";
import type { AuthContextType } from "./authTypes";

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  logout: () => {},
});
