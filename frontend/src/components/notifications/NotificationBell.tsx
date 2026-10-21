import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, error, refresh, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  const openNotification = async (id: string, link?: string | null) => {
    try { await markAsRead(id); } catch { /* The notification remains usable when the request fails. */ }
    setIsOpen(false);
    if (link && link.startsWith('/')) navigate(link);
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button type="button" className="notification-bell-button" onClick={() => setIsOpen((open) => !open)} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={isOpen} aria-controls="workspace-notifications" style={{ width: '38px', height: '38px', borderRadius: '10px', border: '1px solid var(--bd)', background: 'var(--card)', display: 'grid', placeItems: 'center', color: 'var(--text)', position: 'relative' }}>
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: '-5px', right: '-5px', minWidth: '18px', height: '18px', padding: '0 4px', display: 'grid', placeItems: 'center', borderRadius: '99px', background: 'var(--ter)', color: '#fff', border: '2px solid var(--bg)', fontSize: '10px', fontWeight: 800 }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {isOpen && (
        <section id="workspace-notifications" aria-label="Notifications" role="dialog" style={{ position: 'absolute', top: '46px', right: 0, width: 'min(360px, calc(100vw - 24px))', maxHeight: 'min(520px, calc(100vh - 88px))', overflowY: 'auto', zIndex: 50, background: 'var(--card)', border: '1px solid var(--bd)', borderRadius: '14px', boxShadow: 'var(--shh)' }}>
          <header style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bd)' }}>
            <div><strong style={{ color: 'var(--text)', fontSize: '14px' }}>Notifications</strong><div style={{ color: 'var(--t2)', fontSize: '12px', marginTop: '2px' }}>{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</div></div>
            <button type="button" onClick={() => void refresh()} aria-label="Refresh notifications" style={{ border: 0, background: 'transparent', color: 'var(--mut)', padding: '5px', display: 'grid', placeItems: 'center' }}><RefreshCw size={16} className={isLoading ? 'notification-spin' : ''} /></button>
          </header>
          {error && <p role="status" style={{ margin: '12px 16px', color: 'var(--ter)', fontSize: '12px' }}>{error}</p>}
          {!isLoading && notifications.length === 0 && <p style={{ margin: '28px 16px', color: 'var(--t2)', fontSize: '13px', textAlign: 'center' }}>No notifications yet.</p>}
          {notifications.map((notification) => (
            <div key={notification.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--bd)', background: notification.read_at ? 'transparent' : 'var(--soft)', display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => void openNotification(notification.id, notification.link)} style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: notification.link ? 'pointer' : 'default', border: 0, padding: 0, background: 'transparent', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><strong style={{ fontSize: '13px', color: 'var(--text)' }}>{notification.title}</strong>{notification.link && <ExternalLink size={13} color="var(--mut)" />}</div>
                <p style={{ margin: '4px 0 0', color: 'var(--t2)', fontSize: '12px', lineHeight: 1.45 }}>{notification.body}</p>
                <time dateTime={notification.created_at} style={{ display: 'block', marginTop: '6px', color: 'var(--mut)', fontSize: '11px' }}>{new Date(notification.created_at).toLocaleString()}</time>
              </button>
              {!notification.read_at && <button type="button" onClick={() => void markAsRead(notification.id)} aria-label={`Mark ${notification.title} as read`} title="Mark as read" style={{ alignSelf: 'start', border: 0, background: 'transparent', color: 'var(--accent)', padding: '2px' }}><Check size={16} /></button>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
