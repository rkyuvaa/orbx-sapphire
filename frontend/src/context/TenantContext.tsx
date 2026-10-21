import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth, UserMembership } from './AuthContext';
import { apiRequest } from '../lib/api';

export interface CompanyDetail {
  id: string;
  name: string;
  code: string;
  status: string;
  owner_id?: string;
  gst_number?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  settings?: Record<string, any>;
  member_count?: number;
  created_at?: string;
}

interface TenantContextType {
  activeCompanyId: string | null;
  activeCompany: CompanyDetail | null;
  currentMembership: UserMembership | null;
  isLoading: boolean;
  switchCompany: (companyId: string) => Promise<void>;
  clearTenant: () => void;
  refreshCompany: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => {
    return localStorage.getItem('orbx_active_company_id');
  });
  const [activeCompany, setActiveCompany] = useState<CompanyDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Derive current membership
  const currentMembership = user?.memberships.find(
    (m) => m.company_id === activeCompanyId
  ) || null;

  // Sync if stored company ID is invalid or user only has 1 membership
  useEffect(() => {
    if (!user || user.is_superadmin) return;

    if (user.memberships.length === 1) {
      const singleCompId = user.memberships[0].company_id;
      if (activeCompanyId !== singleCompId) {
        localStorage.setItem('orbx_active_company_id', singleCompId);
        setActiveCompanyId(singleCompId);
      }
    } else if (user.memberships.length > 1) {
      // If activeCompanyId not in memberships, clear it
      if (activeCompanyId && !user.memberships.some((m) => m.company_id === activeCompanyId)) {
        localStorage.removeItem('orbx_active_company_id');
        setActiveCompanyId(null);
      }
    } else {
      localStorage.removeItem('orbx_active_company_id');
      setActiveCompanyId(null);
    }
  }, [user, activeCompanyId]);

  const loadCompanyDetails = async (companyId: string) => {
    setIsLoading(true);
    try {
      const data = await apiRequest<CompanyDetail>('/companies/current', {
        headers: { 'X-Company-ID': companyId },
      });
      setActiveCompany(data);
    } catch (err) {
      console.error('Failed to load active company workspace:', err);
      setActiveCompany(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeCompanyId && user) {
      loadCompanyDetails(activeCompanyId);
    } else {
      setActiveCompany(null);
    }
  }, [activeCompanyId, user]);

  const switchCompany = async (newCompanyId: string) => {
    // 1. Clear TanStack query cache to prevent cross-tenant cache bleeding
    queryClient.clear();

    // 2. Set new active tenant
    localStorage.setItem('orbx_active_company_id', newCompanyId);
    setActiveCompanyId(newCompanyId);

    // 3. Load verified company details
    await loadCompanyDetails(newCompanyId);
  };

  const clearTenant = () => {
    queryClient.clear();
    localStorage.removeItem('orbx_active_company_id');
    setActiveCompanyId(null);
    setActiveCompany(null);
  };

  const refreshCompany = async () => {
    if (activeCompanyId) {
      await loadCompanyDetails(activeCompanyId);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        activeCompanyId,
        activeCompany,
        currentMembership,
        isLoading,
        switchCompany,
        clearTenant,
        refreshCompany,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
}
