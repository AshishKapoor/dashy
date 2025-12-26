import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { MainLayout } from "@/components/layouts/main-layout";
import { AuthLayout } from "@/components/layouts/auth-layout";
import { ProtectedRoute } from "@/components/protected-route";

// Pages
import { LoginPage } from "@/pages/auth/login";
import { DashboardPage } from "@/pages/dashboard";
import { OrganizationsPage } from "@/pages/accounts/organizations";
import { MembershipsPage } from "@/pages/accounts/memberships";
import { RolesPage } from "@/pages/accounts/roles";
import { WorkspacesPage } from "@/pages/bi/workspaces";
import { DashboardsPage } from "@/pages/bi/dashboards";
import { IndicatorsPage } from "@/pages/bi/indicators";
import { DataManagementPage } from "@/pages/bi/data-management";
import { DataVizPage } from "@/pages/bi/data-viz";

import "@/assets/styles/globals.css";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                {/* Accounts routes */}
                <Route path="organizations" element={<OrganizationsPage />} />
                <Route path="memberships" element={<MembershipsPage />} />
                <Route path="roles" element={<RolesPage />} />
                {/* BI routes */}
                <Route path="workspaces" element={<WorkspacesPage />} />
                <Route path="dashboards" element={<DashboardsPage />} />
                <Route path="indicators" element={<IndicatorsPage />} />
                <Route
                  path="data-management"
                  element={<DataManagementPage />}
                />
                <Route path="data-viz" element={<DataVizPage />} />
              </Route>

              {/* Auth Routes */}
              <Route element={<AuthLayout />}>
                <Route path="login" element={<LoginPage />} />
              </Route>

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
