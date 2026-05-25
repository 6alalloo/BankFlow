import { use } from "react";
import { AuthContext } from "./AuthContext";
import type { AuthContextType } from "./authTypes";

export const useAuth = (): AuthContextType => {
  const context = use(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
