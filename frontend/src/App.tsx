import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { useAuth } from "./contexts/useAuth";
import AppLayout from "./layout/appLayout";
const LoginPage = lazy(() => import("./pages/Auth/LoginPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const DashboardPage = lazy(() => import("./pages/Dashboard/DashboardPage"));
const FlowsListPage = lazy(() => import("./pages/Flows/flowListPage"));
const FlowBuilderPage = lazy(() => import("./pages/Flows/flowBuilderPage"));
const CasesListPage = lazy(() => import("./pages/Cases/CasesListPage"));
const CaseDetailPage = lazy(() => import("./pages/Cases/CaseDetailPage"));
const TasksWorkbenchPage = lazy(() => import("./pages/Tasks/TasksWorkbenchPage"));
const ApprovalsInboxPage = lazy(() => import("./pages/Approvals/ApprovalsInboxPage"));
const AuditLogPage = lazy(() => import("./pages/Admin/AuditLogPage"));
const SecurityPage = lazy(() => import("./pages/Admin/SecurityPage"));
const UserManagementPage = lazy(() => import("./pages/Admin/UserManagementPage"));

const RouteFallback = () => (
  <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: "#f2f2f4" }}>
    <div className="size-6 border-2 border-[#0f1012]/20 border-t-[#0071e3] rounded-full animate-spin" role="status" />
  </div>
);

const LogoutRoute = () => {
  const { logout } = useAuth();

  useEffect(() => {
    window.localStorage.removeItem("bankflow_token");
    window.localStorage.removeItem("bankflow_user");
    logout();
  }, [logout]);

  return <Navigate to="/login" replace />;
};

// Protected route wrapper component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: "#f2f2f4" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 border-2 border-[#0f1012]/20 border-t-[#0071e3] rounded-full animate-spin" role="status" />
          <p className="text-sm text-[#8f8f8f]">Loading&hellip;</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App = () => {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public landing page */}
          <Route path="/" element={<LandingPage />} />

          <Route path="/logout" element={<LogoutRoute />} />

          {/* Public login */}
          <Route
            path="/login"
            element={
              isLoading ? (
                <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: "#f2f2f4" }}>
                  <div className="size-6 border-2 border-[#0f1012]/20 border-t-[#0071e3] rounded-full animate-spin" role="status" />
                </div>
              ) : isAuthenticated ? (
                <Navigate to="/dashboard" replace />
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
                    {/* Dashboard */}
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
                          <h1 className="text-2xl font-medium text-[#0f1012] mb-1">404</h1>
                          <p className="text-sm text-[#8f8f8f]">Page not found.</p>
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
      </Suspense>
      <Toaster position="bottom-right" richColors />
    </>
  );
};

export default App;
