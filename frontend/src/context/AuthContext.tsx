import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';

export interface UserMembership {
  id: string;
  company_id: string;
  company_name: string;
  company_code: string;
  company_status: string;
  role: string;
  status: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  is_superadmin: boolean;
  is_active: boolean;
  memberships: UserMembership[];
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('orbx_token'));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUser = async (authToken: string): Promise<AuthUser | null> => {
    try {
      const data = await apiRequest<AuthUser>('/auth/me');
      setUser(data);
      return data;
    } catch (err) {
      console.error('Failed to authenticate session:', err);
      localStorage.removeItem('orbx_token');
      setToken(null);
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    if (token) {
      fetchUser(token).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (newToken: string): Promise<AuthUser> => {
    localStorage.setItem('orbx_token', newToken);
    setToken(newToken);
    const fetchedUser = await fetchUser(newToken);
    if (!fetchedUser) {
      throw new Error('Could not retrieve user profile');
    }
    return fetchedUser;
  };

  const logout = () => {
    localStorage.removeItem('orbx_token');
    localStorage.removeItem('orbx_active_company_id');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    if (!token) return null;
    return await fetchUser(token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
