import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  in_app_enabled: boolean;
  web_push_enabled: boolean;
  type_preferences: Record<string, boolean>;
}

type PushSupport = 'unsupported' | 'default' | 'granted' | 'denied';

interface NotificationContextValue {
  notifications: AppNotification[];
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
  pushSupport: PushSupport;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  updatePreferences: (update: Partial<NotificationPreferences>) => Promise<void>;
  enableWebPush: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = window.atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { activeCompanyId } = useTenant();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushSupport, setPushSupport] = useState<PushSupport>(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
    return Notification.permission;
  });

  const clear = useCallback(() => {
    setNotifications([]);
    setPreferences(null);
    setError(null);
    queryClient.removeQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const refresh = useCallback(async () => {
    if (!token || !activeCompanyId) {
      clear();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [items, nextPreferences] = await Promise.all([
        apiRequest<AppNotification[]>('/notifications?limit=50'),
        apiRequest<NotificationPreferences>('/notifications/preferences'),
      ]);
      setNotifications(items);
      setPreferences(nextPreferences);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompanyId, clear, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => clear, [clear, activeCompanyId, token]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const notification = await apiRequest<AppNotification>(`/notifications/${notificationId}/read`, { method: 'POST' });
    setNotifications((current) => current.map((item) => item.id === notificationId ? notification : item));
  }, []);

  const updatePreferences = useCallback(async (update: Partial<NotificationPreferences>) => {
    const nextPreferences = await apiRequest<NotificationPreferences>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(update),
    });
    setPreferences(nextPreferences);
  }, []);

  const enableWebPush = useCallback(async () => {
    if (pushSupport === 'unsupported' || !VAPID_PUBLIC_KEY) return false;
    const permission = await Notification.requestPermission();
    setPushSupport(permission);
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription = existingSubscription ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('The browser returned an incomplete push subscription.');
    await apiRequest('/notifications/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }),
    });
    await updatePreferences({ web_push_enabled: true });
    return true;
  }, [pushSupport, updatePreferences]);

  const value = useMemo(() => ({
    notifications,
    preferences,
    isLoading,
    error,
    unreadCount: notifications.filter((notification) => !notification.read_at).length,
    pushSupport,
    refresh,
    markAsRead,
    updatePreferences,
    enableWebPush,
  }), [notifications, preferences, isLoading, error, pushSupport, refresh, markAsRead, updatePreferences, enableWebPush]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
}
