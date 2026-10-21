import React, { useState, useEffect } from 'react';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../context/ToastContext';
import { apiRequest } from '../../lib/api';
import { NotificationSettings } from '../../components/notifications/NotificationSettings';
import {
  IconBuilding,
  IconFileText,
  IconMail,
  IconPhone,
  IconGlobe,
  IconMapPin,
  IconCopy,
  IconCheck
} from '../../components/ui/Icons';

interface DocumentNumberingSettings {
  prefix: string;
  next_number: number;
}

interface ReminderSettingsOut {
  high_priority_days: number;
  high_priority_recurring: string;
  normal_priority_days: number;
  normal_priority_recurring: string;
  low_priority_days: number;
  low_priority_recurring: string;
  trigger_time: string;
  timezone: string;
  enabled: boolean;
}

type ReminderPriority = 'high' | 'normal' | 'low';

const reminderPriorities: {
  value: ReminderPriority;
  label: string;
  daysKey: 'high_priority_days' | 'normal_priority_days' | 'low_priority_days';
  recurringKey: 'high_priority_recurring' | 'normal_priority_recurring' | 'low_priority_recurring';
}[] = [
  { value: 'high', label: 'High', daysKey: 'high_priority_days', recurringKey: 'high_priority_recurring' },
  { value: 'normal', label: 'Normal', daysKey: 'normal_priority_days', recurringKey: 'normal_priority_recurring' },
  { value: 'low', label: 'Low', daysKey: 'low_priority_days', recurringKey: 'low_priority_recurring' },
];

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function CompanySettings() {
  const { activeCompany, currentMembership, refreshCompany } = useTenant();
  const { toast } = useToast();
  const [activeSettingsTab, setActiveSettingsTab] = useState<'company-configuration' | 'document-numbering' | 'reminder'>('company-configuration');

  const [name, setName] = useState(activeCompany?.name || '');
  const [gstNumber, setGstNumber] = useState(activeCompany?.gst_number || '');
  const [address, setAddress] = useState(activeCompany?.address || '');
  const [contactPhone, setContactPhone] = useState(activeCompany?.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(activeCompany?.contact_email || '');
  const [website, setWebsite] = useState(activeCompany?.website || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [prefix, setPrefix] = useState('ORD-');
  const [nextNumber, setNextNumber] = useState(1);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  const isOwner = currentMembership?.role === 'owner';

  useEffect(() => {
    if (activeCompany) {
      setName(activeCompany.name || '');
      setGstNumber(activeCompany.gst_number || '');
      setAddress(activeCompany.address || '');
      setContactPhone(activeCompany.contact_phone || '');
      setContactEmail(activeCompany.contact_email || '');
      setWebsite(activeCompany.website || '');
    }
  }, [activeCompany]);

  useEffect(() => {
    if (activeCompany?.id) {
      setLoading(true);
      apiRequest<DocumentNumberingSettings>('/companies/current/document-numbering')
        .then((settings) => {
          setPrefix(settings.prefix);
          setNextNumber(settings.next_number);
        })
        .catch((error) => {
          toast(error instanceof Error ? error.message : 'Failed to load document numbering', 'error');
        })
        .finally(() => setLoading(false));
    }
  }, [activeCompany?.id, toast]);

  const saveCompanyConfiguration = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOwner) {
      toast('Only the company owner can modify company configuration', 'error');
      return;
    }
    setSavingCompany(true);
    try {
      await apiRequest('/companies/current', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          gst_number: gstNumber.trim() || null,
          address: address.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
          website: website.trim() || null,
        }),
      });
      await refreshCompany();
      toast('Company configuration saved', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to save company configuration', 'error');
    } finally {
      setSavingCompany(false);
    }
  };

  const copyCompanyValue = async (value: string, type: 'id' | 'code') => {
    try {
      await navigator.clipboard.writeText(value);
      if (type === 'id') {
        setCopiedId(true);
        window.setTimeout(() => setCopiedId(false), 1800);
      } else {
        setCopiedSlug(true);
        window.setTimeout(() => setCopiedSlug(false), 1800);
      }
      toast(type === 'id' ? 'Company ID copied' : 'Company code copied', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to copy company details', 'error');
    }
  };

  const saveNumbering = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOwner) {
      toast('Only the company owner can modify document numbering', 'error');
      return;
    }
    setSaving(true);
    try {
      const settings = await apiRequest<DocumentNumberingSettings>('/companies/current/document-numbering', {
        method: 'PATCH',
        body: JSON.stringify({ prefix: prefix.trim(), next_number: nextNumber }),
      });
      setPrefix(settings.prefix);
      setNextNumber(settings.next_number);
      toast('Customer order numbering saved', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to save document numbering', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="settings-tabs" role="tablist" aria-label="Company settings">
        <button
          type="button"
          role="tab"
          aria-selected={activeSettingsTab === 'company-configuration'}
          className={`settings-tab${activeSettingsTab === 'company-configuration' ? ' active' : ''}`}
          onClick={() => setActiveSettingsTab('company-configuration')}
        >
          Company Configuration
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSettingsTab === 'document-numbering'}
          className={`settings-tab${activeSettingsTab === 'document-numbering' ? ' active' : ''}`}
          onClick={() => setActiveSettingsTab('document-numbering')}
        >
          Document Numbering
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSettingsTab === 'reminder'}
          className={`settings-tab${activeSettingsTab === 'reminder' ? ' active' : ''}`}
          onClick={() => setActiveSettingsTab('reminder')}
        >
          Reminder
        </button>
      </div>
      {activeSettingsTab === 'company-configuration' ? (
        <form onSubmit={saveCompanyConfiguration} className="card company-settings-card">
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 750, marginBottom: 5 }}>Company configuration</h2>
            <p style={{ color: 'var(--t2)', fontSize: 13, margin: 0 }}>
              Manage the company profile details shown across your workspace.
            </p>
          </div>
          <div className="company-settings-fields company-configuration-fields">
            <div className="fld">
              <label htmlFor="company-name"><IconBuilding size={14} /> Company name</label>
              <input id="company-name" required minLength={2} maxLength={255} value={name} disabled={!isOwner || savingCompany} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor="company-gst"><IconFileText size={14} /> GST number</label>
              <input id="company-gst" maxLength={30} value={gstNumber} disabled={!isOwner || savingCompany} onChange={(event) => setGstNumber(event.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor="company-phone"><IconPhone size={14} /> Contact phone</label>
              <input id="company-phone" type="tel" maxLength={30} value={contactPhone} disabled={!isOwner || savingCompany} onChange={(event) => setContactPhone(event.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor="company-email"><IconMail size={14} /> Contact email</label>
              <input id="company-email" type="email" maxLength={255} value={contactEmail} disabled={!isOwner || savingCompany} onChange={(event) => setContactEmail(event.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor="company-website"><IconGlobe size={14} /> Website</label>
              <input id="company-website" type="url" maxLength={255} placeholder="https://" value={website} disabled={!isOwner || savingCompany} onChange={(event) => setWebsite(event.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor="company-address"><IconMapPin size={14} /> Address</label>
              <textarea id="company-address" rows={2} maxLength={1000} value={address} disabled={!isOwner || savingCompany} onChange={(event) => setAddress(event.target.value)} />
            </div>
          </div>
          {activeCompany && (
            <div className="company-settings-identifiers">
              <div>
                <span>Company ID</span>
                <code>{activeCompany.id}</code>
                <button type="button" className="btn sm" aria-label="Copy company ID" onClick={() => void copyCompanyValue(activeCompany.id, 'id')}>
                  {copiedId ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  {copiedId ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div>
                <span>Company code</span>
                <code>{activeCompany.code}</code>
                <button type="button" className="btn sm" aria-label="Copy company code" onClick={() => void copyCompanyValue(activeCompany.code, 'code')}>
                  {copiedSlug ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  {copiedSlug ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
          {!isOwner && <p className="reminder-owner-note">Only the company owner can change company configuration.</p>}
          {isOwner && (
            <div className="reminder-save-row">
              <button type="submit" className="btn pri" disabled={savingCompany}>
                {savingCompany ? 'Saving...' : 'Save configuration'}
              </button>
            </div>
          )}
        </form>
      ) : activeSettingsTab === 'document-numbering' ? (
        <form onSubmit={saveNumbering} className="card company-settings-card">
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 750, marginBottom: 5 }}>Customer order number</h2>
            <p style={{ color: 'var(--t2)', fontSize: 13, margin: 0 }}>
              Each new customer order receives a company-specific order number.
            </p>
          </div>
          <div className="company-settings-fields">
            <div className="fld">
              <label htmlFor="customer-order-number-prefix">Prefix</label>
              <input
                id="customer-order-number-prefix"
                required
                maxLength={20}
                pattern="[A-Za-z0-9-]+"
                value={prefix}
                disabled={loading || !isOwner}
                onChange={(event) => setPrefix(event.target.value)}
              />
            </div>
            <div className="fld">
              <label htmlFor="customer-order-number-next">Next number</label>
              <input
                id="customer-order-number-next"
                type="number"
                min={1}
                required
                value={nextNumber}
                disabled={loading || !isOwner}
                onChange={(event) => setNextNumber(Number(event.target.value))}
              />
            </div>
          </div>
          <div style={{ padding: '12px 14px', border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--soft)', marginBottom: 18 }}>
            <small style={{ color: 'var(--t2)', display: 'block', marginBottom: 4 }}>Next customer order number</small>
            <strong>{prefix}{String(nextNumber || 1).padStart(6, '0')}</strong>
          </div>
          {!isOwner && <p style={{ color: 'var(--t2)', fontSize: 12 }}>Only the company owner can change this setting.</p>}
          {isOwner && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn pri" disabled={loading || saving}>{saving ? 'Saving...' : 'Save numbering'}</button>
            </div>
          )}
        </form>
      ) : (
        <ReminderSettings />
      )}
    </div>
  );
}

export const ReminderSettings: React.FC = () => {
  const { activeCompany, currentMembership } = useTenant();
  const { toast } = useToast();
  const isOwner = currentMembership?.role === 'owner';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reminder, setReminder] = useState<ReminderSettingsOut>({
    high_priority_days: 15,
    high_priority_recurring: 'daily',
    normal_priority_days: 10,
    normal_priority_recurring: 'every_2_days',
    low_priority_days: 5,
    low_priority_recurring: 'every_1_day',
    trigger_time: '09:00',
    timezone: browserTimezone(),
    enabled: true,
  });

  useEffect(() => {
    if (!activeCompany?.id) return;
    let cancelled = false;
    setLoading(true);
    apiRequest<ReminderSettingsOut>('/companies/current/reminder-settings')
      .then((settings) => {
        if (!cancelled) {
          setReminder({
            ...settings,
            timezone: settings.timezone || browserTimezone(),
          });
        }
      })
      .catch((error) => {
        if (!cancelled) toast(error instanceof Error ? error.message : 'Failed to load reminder settings', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeCompany?.id, toast]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOwner) {
      toast('Only the company owner can modify reminder settings', 'error');
      return;
    }
    setSaving(true);
    try {
      const savedSettings = await apiRequest<ReminderSettingsOut>('/companies/current/reminder-settings', {
        method: 'PATCH',
        body: JSON.stringify(reminder),
      });
      setReminder(savedSettings);
      toast('Reminder settings saved', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to save reminder settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changePriority = (
    priority: ReminderPriority,
    field: 'days' | 'recurring',
    value: number | string,
  ) => {
    const selected = reminderPriorities.find((item) => item.value === priority);
    if (!selected) return;
    setReminder((current) => field === 'days'
      ? { ...current, [selected.daysKey]: Number(value) }
      : { ...current, [selected.recurringKey]: String(value) });
  };

  return (
    <div className="card reminder-settings-card">
      <h2 style={{ fontSize: 17, fontWeight: 750, marginBottom: 6 }}>Order reminders</h2>
      <p style={{ color: 'var(--t2)', fontSize: 13, marginBottom: 18 }}>
        Reminders start the configured number of days before an order is due and repeat until its due date. Delivered and cancelled orders are excluded.
      </p>
      <form onSubmit={handleSave}>
        <div className="reminder-priority-grid">
          {reminderPriorities.map((priority) => (
            <section key={priority.value} className={`reminder-priority-card priority-${priority.value}`}>
              <h3 className={`priority-label priority-${priority.value}`}>{priority.label}</h3>
              <div className="fld">
                <label htmlFor={`${priority.value}-reminder-days`}>Start before due date (days)</label>
                <input
                  id={`${priority.value}-reminder-days`}
                  type="number"
                  min={1}
                  max={365}
                  required
                  value={reminder[priority.daysKey]}
                  disabled={loading || !isOwner}
                  onChange={(event) => changePriority(priority.value, 'days', Number(event.target.value))}
                />
              </div>
              <div className="fld">
                <label htmlFor={`${priority.value}-reminder-repeat`}>Repeat</label>
                <select
                  id={`${priority.value}-reminder-repeat`}
                  value={reminder[priority.recurringKey]}
                  disabled={loading || !isOwner}
                  onChange={(event) => changePriority(priority.value, 'recurring', event.target.value)}
                >
                  <option value="daily">Every day</option>
                  <option value="every_2_days">Every 2 days</option>
                  <option value="every_3_days">Every 3 days</option>
                  <option value="every_7_days">Every 7 days</option>
                </select>
              </div>
            </section>
          ))}
        </div>
        <div className="reminder-timing-grid">
          <div className="fld">
            <label htmlFor="reminder-trigger-time">Notification time</label>
            <input
              id="reminder-trigger-time"
              type="time"
              required
              value={reminder.trigger_time}
              disabled={loading || !isOwner}
              onChange={(event) => setReminder((current) => ({ ...current, trigger_time: event.target.value }))}
            />
          </div>
          <div className="fld">
            <label htmlFor="reminder-timezone">Company timezone (IANA)</label>
            <input
              id="reminder-timezone"
              required
              maxLength={100}
              placeholder="e.g. Asia/Kolkata"
              value={reminder.timezone}
              disabled={loading || !isOwner}
              onChange={(event) => setReminder((current) => ({ ...current, timezone: event.target.value }))}
            />
          </div>
        </div>
        <label className="reminder-enabled">
          <input
            type="checkbox"
            checked={reminder.enabled}
            disabled={loading || !isOwner}
            onChange={(event) => setReminder((current) => ({ ...current, enabled: event.target.checked }))}
          />
          Enable order reminders for this company
        </label>
        {!isOwner && <p className="reminder-owner-note">Only the company owner can change reminder settings.</p>}
        {isOwner && (
          <div className="reminder-save-row">
            <button type="submit" className="btn pri" disabled={loading || saving}>
              {saving ? 'Saving…' : 'Save reminder settings'}
            </button>
          </div>
        )}
      </form>
      <NotificationSettings />
    </div>
  );
};