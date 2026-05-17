import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from 'sonner';

import { useAuth } from "./contexts/AuthContext";
import AppLayout from "./layout/appLayout";
import LoginPage from "./pages/Auth/LoginPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import FlowsListPage from "./pages/Flows/flowListPage";
import FlowBuilderPage from "./pages/Flows/flowBuilderPage";
import CasesListPage from "./pages/Cases/CasesListPage";
import CaseDetailPage from "./pages/Cases/CaseDetailPage";
import TasksWorkbenchPage from "./pages/Tasks/TasksWorkbenchPage";
import ApprovalsInboxPage from "./pages/Approvals/ApprovalsInboxPage";
import AuditLogPage from "./pages/Admin/AuditLogPage";
import SecurityPage from "./pages/Admin/SecurityPage";
import UserManagementPage from "./pages/Admin/UserManagementPage";

// Protected route wrapper component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: "#040506" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 border-2 border-white/20 border-t-white rounded-full animate-spin" role="status" />
          <p className="text-sm text-zinc-400">Loading?</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <>
      <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          isLoading ? (
            <div
              className="h-screen flex items-center justify-center"
              style={{ backgroundColor: "#040506" }}
            >
              <div className="size-6 border-2 border-white/20 border-t-white rounded-full animate-spin" role="status" />
            </div>
          ) : isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Protected routes - wrapped in AppLayout */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                {/* Dashboard / Landing */}
                <Route path="/" element={<DashboardPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* Flows */}
                <Route path="/flows" element={<FlowsListPage />} />

                {/* Cases */}
                <Route path="/cases" element={<CasesListPage />} />
                <Route path="/cases/:id" element={<CaseDetailPage />} />
                <Route path="/tasks" element={<TasksWorkbenchPage />} />
                <Route path="/approvals" element={<ApprovalsInboxPage />} />

                {/* Admin */}
                <Route path="/admin/audit-logs" element={<AuditLogPage />} />
                <Route path="/admin/security" element={<SecurityPage />} />
                <Route path="/admin/users" element={<UserManagementPage />} />

                {/* Fallback 404 */}
                <Route
                  path="*"
                  element={
                    <div className="p-6">
                      <h1 className="text-2xl font-semibold text-white mb-1">404</h1>
                      <p className="text-sm text-zinc-400">Page not found.</p>
                    </div>
                  }
                />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Builder Routes - Full Screen (No AppLayout) */}
      <Route
        path="/builder"
        element={
          <ProtectedRoute>
            <FlowBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flows/:id/builder"
        element={
          <ProtectedRoute>
            <FlowBuilderPage />
          </ProtectedRoute>
        }
      />

      </Routes>
      <Toaster position="bottom-right" richColors />
    </>
  );
};

export default App;
