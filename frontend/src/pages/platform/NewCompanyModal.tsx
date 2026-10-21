import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { IconCheck } from '../../components/ui/Icons';
import { Modal } from '../../components/ui/Modal';

interface NewCompanyModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function NewCompanyModal({ onClose, onSuccess }: NewCompanyModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [planId, setPlanId] = useState('');
  const [plans, setPlans] = useState<Array<{ id: string; name: string; code: string }>>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<{
    activationUrl: string;
    token: string;
    companyName: string;
    ownerEmail: string;
    hasInitialPassword: boolean;
  } | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    apiRequest<Array<{ id: string; name: string; code: string }>>('/platform/plans')
      .then((data) => {
        setPlans(data);
        if (data.length > 0) setPlanId(data[0].id);
      })
      .catch((err) => console.error('Failed to load plans:', err));
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    const generated = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setCode(generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest<{
        company: any;
        invitation_token: string;
        activation_url: string;
      }>('/platform/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          owner_name: ownerName.trim(),
          owner_email: ownerEmail.trim(),
          owner_password: ownerPassword || undefined,
          gst_number: gstNumber.trim() || undefined,
          address: address.trim() || undefined,
          contact_email: contactEmail.trim() || undefined,
          contact_phone: contactPhone.trim() || undefined,
          website: website.trim() || undefined,
          plan_id: planId || undefined,
        }),
      });

      const fullUrl = `${window.location.origin}${res.activation_url}`;
      setProvisionResult({
        activationUrl: fullUrl,
        token: res.invitation_token,
        companyName: res.company.name,
        ownerEmail: res.company.owner?.email || ownerEmail,
        hasInitialPassword: ownerPassword.length > 0,
      });

      toast('Company created & owner account provisioned!', 'success');
    } catch (err: any) {
      setError(err.message || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast('Copied to clipboard!', 'info');
  };

  return (
    <Modal
      title={provisionResult ? 'Company Provisioned' : 'Register New Company'}
      onClose={onClose}
    >

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(181,89,63,0.1)', color: 'var(--ter)', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {provisionResult ? (
          <div>
            <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--sage)',
                  color: 'var(--color-accent-contrast, #0A1712)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <IconCheck size={28} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 800 }}>{provisionResult.companyName} Registered</h3>
              <p style={{ color: 'var(--t2)', fontSize: '13px', marginTop: '6px' }}>
                The company workspace and owner account have been successfully provisioned.
              </p>
            </div>

            {/* Login Credentials Box */}
            <div
              style={{
                background: 'var(--soft)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--bd)',
                marginBottom: '18px',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t2)', marginBottom: '10px' }}>
                Workshop Owner Credentials
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{ color: 'var(--t2)' }}>Login Username (Email):</span>
                <code style={{ background: 'var(--card)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                  {provisionResult.ownerEmail}
                </code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{ color: 'var(--t2)' }}>Password:</span>
                <span>
                  {provisionResult.hasInitialPassword ? (
                    <b style={{ color: 'var(--pri)' }}>Configured during registration</b>
                  ) : (
                    <span style={{ color: 'var(--t2)' }}>Awaiting activation link setup</span>
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--t2)' }}>Login Portal URL:</span>
                <code style={{ background: 'var(--card)', padding: '2px 8px', borderRadius: '6px' }}>
                  {window.location.origin}/login
                </code>
              </div>
            </div>

            {/* Single-use Activation Link */}
            <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--card)', border: '1px solid var(--bd)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <small style={{ color: 'var(--t2)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
                  Self-Service Activation Link (Valid for 48 Hours)
                </small>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  readOnly
                  value={provisionResult.activationUrl}
                  style={{
                    flex: 1,
                    fontSize: '12px',
                    height: '38px',
                    padding: '0 10px',
                    background: 'var(--soft)',
                    border: '1px solid var(--bd)',
                    borderRadius: '8px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(provisionResult.activationUrl)}
                  className="btn sm pri"
                >
                  Copy Link
                </button>
              </div>
              <small style={{ color: 'var(--t2)', fontSize: '11px', marginTop: '6px', display: 'block' }}>
                Share this link with the workshop owner so they can set or update their password and activate their account.
              </small>
            </div>

            <div className="app-modal-actions">
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="btn pri"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="platform-form-two-column-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
              <div className="fld">
                <label htmlFor="compName">Company Name *</label>
                <input
                  id="compName"
                  required
                  placeholder="e.g. Royal Atelier"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>

              <div className="fld">
                <label htmlFor="compCode">Tenant Code (Slug) *</label>
                <input
                  id="compCode"
                  required
                  placeholder="royal-atelier"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--bd)', margin: '14px 0', paddingTop: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: 'var(--text)' }}>
                Owner Account &amp; Credentials
              </div>

              <div className="fld">
                <label htmlFor="ownerName">Owner Full Name *</label>
                <input
                  id="ownerName"
                  required
                  placeholder="e.g. Elena Rostova"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>

              <div className="fld">
                <label htmlFor="ownerEmail">Owner Email (Username for Login) *</label>
                <input
                  id="ownerEmail"
                  type="email"
                  required
                  placeholder="owner@royal-atelier.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                />
                <small style={{ color: 'var(--t2)', fontSize: '11px' }}>
                  This email is the owner's username for signing into OrbX.
                </small>
              </div>

              <div className="fld">
                <label htmlFor="ownerPassword">
                  Owner Password <span style={{ color: 'var(--t2)', fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  id="ownerPassword"
                  type="password"
                  placeholder="Leave empty for activation link, or set initial password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  minLength={8}
                />
                <small style={{ color: 'var(--t2)', fontSize: '11px' }}>
                  If set (min 8 characters), the owner account is activated immediately with this password. If left empty, an activation invitation link is generated.
                </small>
              </div>

              <div className="fld">
                <label htmlFor="contactPhone">Contact Phone Number</label>
                <input
                  id="contactPhone"
                  placeholder="+91 98000 00000"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
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
            </div>

            <div className="fld">
              <label htmlFor="plan">Subscription Plan</label>
              <select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="app-modal-actions">
              <button type="button" onClick={onClose} className="btn">
                Cancel
              </button>
              <button type="submit" className={`btn pri ${loading ? 'loading' : ''}`} disabled={loading}>
                Register Company &amp; Provision Owner
              </button>
            </div>
          </form>
        )}
    </Modal>
  );
}
