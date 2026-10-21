import React, { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';

export function NotificationSettings() {
  const { preferences, pushSupport, updatePreferences, enableWebPush } = useNotifications();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const pushConfigured = Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY);

  const setInAppEnabled = async (enabled: boolean) => {
    setSaving(true);
    try { await updatePreferences({ in_app_enabled: enabled }); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not update notification settings', 'error'); }
    finally { setSaving(false); }
  };

  const requestPush = async () => {
    setSaving(true);
    try {
      const enabled = await enableWebPush();
      if (enabled) toast('Browser notifications are enabled', 'success');
      else if (pushSupport === 'denied') toast('Browser notifications are blocked. Update your browser site settings to enable them.', 'error');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not enable browser notifications', 'error');
    } finally { setSaving(false); }
  };

  return (
    <section className="card" aria-labelledby="notification-settings-title" style={{ padding: '24px', marginTop: '24px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ width: '36px', height: '36px', display: 'grid', placeItems: 'center', borderRadius: '10px', background: 'var(--soft)', color: 'var(--accent)' }}><Bell size={18} /></div>
        <div><h2 id="notification-settings-title" style={{ margin: 0, color: 'var(--text)', fontSize: '15px', fontWeight: 800 }}>Notifications</h2><p style={{ margin: '3px 0 0', color: 'var(--t2)', fontSize: '12px' }}>Choose how this workspace notifies you.</p></div>
      </div>
      <label className="notification-setting-row" style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', padding: '14px 0', borderTop: '1px solid var(--bd)', color: 'var(--text)', fontSize: '13px', cursor: saving ? 'wait' : 'pointer' }}>
        <span><strong style={{ display: 'block' }}>In-app notifications</strong><span style={{ color: 'var(--t2)', fontSize: '12px' }}>Show alerts in the notification bell.</span></span>
        <input type="checkbox" checked={preferences?.in_app_enabled ?? true} disabled={saving || !preferences} onChange={(event) => void setInAppEnabled(event.target.checked)} aria-label="Enable in-app notifications" />
      </label>
      <div className="notification-setting-row" style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid var(--bd)' }}>
        <div><strong style={{ color: 'var(--text)', fontSize: '13px' }}>Browser notifications</strong><p style={{ margin: '3px 0 0', color: 'var(--t2)', fontSize: '12px' }}>{pushSupport === 'unsupported' ? 'Not supported by this browser.' : !pushConfigured ? 'Not configured for this environment.' : pushSupport === 'denied' ? 'Blocked in browser settings.' : 'Receive alerts when OrbX is not open.'}</p></div>
        <button type="button" disabled={saving || pushSupport === 'unsupported' || pushSupport === 'denied' || !pushConfigured} onClick={() => void requestPush()} style={{ border: '1px solid var(--bd)', borderRadius: '8px', padding: '8px 10px', background: 'var(--card)', color: 'var(--text)', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', opacity: saving || pushSupport === 'unsupported' || pushSupport === 'denied' || !pushConfigured ? 0.55 : 1 }}>
          {preferences?.web_push_enabled && pushSupport === 'granted' ? <><Bell size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Enabled</> : <><BellOff size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Enable</>}
        </button>
      </div>
    </section>
  );
}
