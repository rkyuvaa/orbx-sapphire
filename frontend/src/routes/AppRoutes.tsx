import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

import { Login } from '../pages/auth/Login';
import { Activate } from '../pages/auth/Activate';
import { ForgotPassword } from '../pages/auth/ForgotPassword';
import { ResetPassword } from '../pages/auth/ResetPassword';
import { SelectCompany } from '../pages/auth/SelectCompany';

import { PlatformLayout } from '../components/layout/PlatformLayout';
import { PlatformDashboard } from '../pages/platform/PlatformDashboard';
import { CompaniesList } from '../pages/platform/CompaniesList';
import { SubscriptionPlans } from '../pages/platform/SubscriptionPlans';
import { AuditLogs } from '../pages/platform/AuditLogs';

import { WorkspaceLayout } from '../components/layout/WorkspaceLayout';
import { WorkspaceDashboard } from '../pages/workspace/WorkspaceDashboard';
import { CustomerOrdersPage } from '../pages/workspace/CustomerOrders';
import { TeamManagement } from '../pages/workspace/TeamManagement';
import { CompanySettings } from '../pages/workspace/CompanySettings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--t2)', fontSize: '14px', fontWeight: 600 }}>Loading OrbX session...</div>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading...</div>;
  }

  if (!user || !user.is_superadmin) {
    return <Navigate to="/select-company" replace />;
  }

  return <>{children}</>;
}

function WorkspaceRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeCompanyId } = useTenant();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user has no active company chosen
  if (!activeCompanyId) {
    return <Navigate to="/select-company" replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { user, token, isLoading } = useAuth();
  const { activeCompanyId } = useTenant();

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading...</div>;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.is_superadmin && !activeCompanyId) {
    return <Navigate to="/platform" replace />;
  }

  if (activeCompanyId) {
    return <Navigate to="/workspace" replace />;
  }

  return <Navigate to="/select-company" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Root smart redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Multi-Company Selection */}
      <Route
        path="/select-company"
        element={
          <ProtectedRoute>
            <SelectCompany />
          </ProtectedRoute>
        }
      />

      {/* Platform Super Admin Portal */}
      <Route
        path="/platform"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <PlatformLayout />
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<PlatformDashboard />} />
        <Route path="companies" element={<CompaniesList />} />
        <Route path="plans" element={<SubscriptionPlans />} />
        <Route path="audit" element={<AuditLogs />} />
      </Route>

      {/* Company Workspace */}
      <Route
        path="/workspace"
        element={
          <ProtectedRoute>
            <WorkspaceRoute>
              <WorkspaceLayout />
            </WorkspaceRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<WorkspaceDashboard />} />
        <Route path="orders" element={<CustomerOrdersPage />} />
        <Route path="team" element={<TeamManagement />} />
        <Route path="settings" element={<CompanySettings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
