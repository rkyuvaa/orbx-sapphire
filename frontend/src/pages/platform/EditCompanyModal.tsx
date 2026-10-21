import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/ui/Modal';

export interface CompanyEditable {
  id: string;
  name: string;
  code: string;
  gst_number?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  status: 'active' | 'suspended' | 'pending_activation';
  owner?: {
    id: string;
    email: string;
    full_name: string;
    is_active?: boolean;
  };
  subscription?: {
    plan_id?: string;
    plan?: {
      id?: string;
      name?: string;
      code?: string;
    };
  };
}

interface EditCompanyModalProps {
  company: CompanyEditable;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCompanyModal({ company, onClose, onSuccess }: EditCompanyModalProps) {
  const [name, setName] = useState(company.name);
  const [gstNumber, setGstNumber] = useState(company.gst_number || '');
  const [address, setAddress] = useState(company.address || '');
  const [contactEmail, setContactEmail] = useState(company.contact_email || '');
  const [contactPhone, setContactPhone] = useState(company.contact_phone || '');
  const [website, setWebsite] = useState(company.website || '');
  const [status, setStatus] = useState<'active' | 'suspended' | 'pending_activation'>(company.status);
  const [planId, setPlanId] = useState(company.subscription?.plan?.id || '');
  const [plans, setPlans] = useState<Array<{ id: string; name: string; code: string }>>([]);

  // Owner credentials state
  const [ownerPassword, setOwnerPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [copyingLink, setCopyingLink] = useState(false);
  const [ownerActive, setOwnerActive] = useState<boolean>(company.owner?.is_active ?? (company.status === 'active'));

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    apiRequest<Array<{ id: string; name: string; code: string }>>('/platform/plans')
      .then((data) => {
        setPlans(data);
        if (!planId && data.length > 0) {
          setPlanId(data[0].id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Update company profile details and plan
      await apiRequest(`/platform/companies/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          gst_number: gstNumber.trim() || undefined,
          address: address.trim() || undefined,
          contact_email: contactEmail.trim() || undefined,
          contact_phone: contactPhone.trim() || undefined,
          website: website.trim() || undefined,
          plan_id: planId || undefined,
        }),
      });

      // 2. Update status if changed
      if (status !== company.status) {
        await apiRequest(`/platform/companies/${company.id}/status`, {
          method: 'POST',
          body: JSON.stringify({
            status,
            reason: 'Updated via Super Admin platform edit',
          }),
        });
      }

      toast(`Company ${name} updated successfully!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update company');
    } finally {
      setLoading(false);
    }
  };

  const handleSetOwnerPassword = async () => {
    if (!ownerPassword || ownerPassword.length < 8) {
      toast('Password must be at least 8 characters', 'error');
      return;
    }

    setSettingPassword(true);
    try {
      const res = await apiRequest<{ message: string; owner_email: string }>(
        `/platform/companies/${company.id}/reset-owner-password`,
        {
          method: 'POST',
          body: JSON.stringify({ new_password: ownerPassword }),
        }
      );
      toast(res.message || 'Owner password set successfully! Account is active.', 'success');
      setOwnerPassword('');
      setOwnerActive(true);
      setStatus('active');
      onSuccess();
    } catch (err: any) {
      toast(err.message || 'Failed to set owner password', 'error');
    } finally {
      setSettingPassword(false);
    }
  };

  const handleCopyActivationLink = async () => {
    setCopyingLink(true);
    try {
      const res = await apiRequest<{ activation_url: string }>(
        `/platform/companies/${company.id}/activation-link`
      );
      const fullUrl = `${window.location.origin}${res.activation_url}`;
      await navigator.clipboard.writeText(fullUrl);
      toast('Single-use activation link copied to clipboard!', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to generate activation link', 'error');
    } finally {
      setCopyingLink(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete company "${company.name}" (${company.code}.orbx.in)? This will completely erase all associated workspace data.`)) {
      return;
    }

    setDeleting(true);
    try {
      await apiRequest(`/platform/companies/${company.id}`, { method: 'DELETE' });
      toast(`Company "${company.name}" deleted successfully`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast(err.message || 'Failed to delete company', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const ownerEmail = company.owner?.email || company.contact_email || 'Not assigned';

  return (
    <Modal title="Edit Company & Credentials" onClose={onClose}>
        <small style={{ display: 'block', color: 'var(--t2)', fontSize: '12px', marginTop: -10, marginBottom: 16 }}>
          Tenant Code: <code>{company.code}.orbx.in</code>
        </small>

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(181,89,63,0.1)', color: 'var(--ter)', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* OWNER ACCOUNT & CREDENTIALS SECTION */}
        <div
          style={{
            padding: '16px 18px',
            borderRadius: '14px',
            border: '1px solid var(--bd)',
            background: 'var(--soft)',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t2)' }}>
                Owner Account &amp; Login Credentials
              </span>
              <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '2px', color: 'var(--text)' }}>
                {company.owner?.full_name || 'Workshop Owner'}
              </div>
            </div>
            <span className={`badge ${ownerActive ? 'active' : 'pending_activation'}`}>
              {ownerActive ? 'Active' : 'Awaiting Activation'}
            </span>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '14px' }}>
            <span style={{ color: 'var(--t2)', marginRight: '6px' }}>Username / Login Email:</span>
            <code style={{ background: 'var(--card)', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
              {ownerEmail}
            </code>
          </div>

          {/* Direct Set Password */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Set / Change Password:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                placeholder="Enter new password (min 8 chars)"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                style={{ flex: 1, fontSize: '13px', padding: '8px 12px' }}
              />
              <button
                type="button"
                onClick={handleSetOwnerPassword}
                className={`btn sm pri ${settingPassword ? 'loading' : ''}`}
                disabled={settingPassword || !ownerPassword || ownerPassword.length < 8}
              >
                Set Password
              </button>
            </div>
            <small style={{ color: 'var(--t2)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              Directly sets the owner's password and activates the account for immediate login.
            </small>
          </div>

          {/* Copy Activation Link */}
          <div style={{ paddingTop: '10px', borderTop: '1px dashed var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--t2)' }}>
              Or generate a secure self-activation link for the client:
            </span>
            <button
              type="button"
              onClick={handleCopyActivationLink}
              className={`btn sm ${copyingLink ? 'loading' : ''}`}
              disabled={copyingLink}
            >
              Copy Activation Link
            </button>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div className="fld">
            <label htmlFor="compName">Company Name *</label>
            <input
              id="compName"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="fld">
            <label htmlFor="compCode">Tenant Code (Read-Only)</label>
            <input
              id="compCode"
              disabled
              value={`${company.code}.orbx.in`}
              style={{ opacity: 0.65, cursor: 'not-allowed', background: 'var(--soft)' }}
            />
            <small style={{ color: 'var(--t2)', fontSize: '11px' }}>
              Tenant codes are permanent database identifiers.
            </small>
          </div>

          <div className="fld">
            <label htmlFor="contactEmail">Contact Email</label>
            <input
              id="contactEmail"
              type="email"
              placeholder="contact@company.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>

          <div className="fld">
            <label htmlFor="contactPhone">Contact Phone</label>
            <input
              id="contactPhone"
              placeholder="+91 98000 00000"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>

          <div className="fld">
            <label htmlFor="gstNumber">GST Number</label>
            <input
              id="gstNumber"
              placeholder="22AAAAA0000A1Z5"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              maxLength={15}
            />
          </div>

          <div className="fld">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="url"
              placeholder="https://www.company.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div className="fld">
            <label htmlFor="address">Address</label>
            <textarea
              id="address"
              placeholder="Street, City, State, PIN"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div className="fld">
            <label htmlFor="compPlan">Subscription Tier</label>
            <select
              id="compPlan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div className="fld">
            <label htmlFor="status">Tenant Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="active">Active (Full workspace access)</option>
              <option value="pending_activation">Pending Activation (Awaiting owner activation)</option>
              <option value="suspended">Suspended (Access blocked)</option>
            </select>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--bd)' }}>
            <button
              type="button"
              onClick={handleDelete}
              className={`btn sm danger ${deleting ? 'loading' : ''}`}
              disabled={deleting || loading}
            >
              Delete Company
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose} className="btn">
                Cancel
              </button>
              <button type="submit" className={`btn pri ${loading ? 'loading' : ''}`} disabled={loading || deleting}>
                Save Changes
              </button>
            </div>
          </div>
        </form>
    </Modal>
  );
}
