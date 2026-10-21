import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../context/ToastContext';
import { Logo, IconCheck } from '../../components/ui/Icons';
import { apiRequest } from '../../lib/api';

export function Activate() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenParam);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [verifying, setVerifying] = useState(false);
  const [invitationInfo, setInvitationInfo] = useState<{
    email: string;
    role: string;
    company_name?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const { switchCompany } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (tokenParam) {
      verifyToken(tokenParam);
    }
  }, [tokenParam]);

  const verifyToken = async (rawToken: string) => {
    if (!rawToken.trim()) return;
    setVerifying(true);
    setError(null);
    try {
      const data = await apiRequest<{
        valid: boolean;
        email: string;
        role: string;
        company_name?: string;
      }>(`/invitations/verify/${rawToken.trim()}`);
      setInvitationInfo(data);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired invitation token');
      setInvitationInfo(null);
    } finally {
      setVerifying(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest<{ access_token: string }>('/auth/activate', {
        method: 'POST',
        body: JSON.stringify({
          token: token.trim(),
          full_name: fullName.trim() || undefined,
          password,
        }),
      });

      const user = await login(res.access_token);
      toast('Account activated successfully!', 'success');

      if (user.memberships.length === 1) {
        await switchCompany(user.memberships[0].company_id);
        navigate('/workspace');
      } else {
        navigate('/select-company');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to activate account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: 'var(--gradient-auth)',
      }}
    >
      <div
        className="card anim-rise"
        style={{
          width: 'min(480px, 100%)',
          padding: '36px 32px',
          borderRadius: '14px',
          boxShadow: 'var(--modal-sh)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <Logo size={40} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>Activate Your Account</h1>
          <p style={{ color: 'var(--t2)', fontSize: '13px', marginTop: '4px' }}>
            Set up your credentials to join your workshop workspace
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(181, 89, 63, 0.1)',
              color: 'var(--ter)',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '18px',
              border: '1px solid rgba(181, 89, 63, 0.2)',
            }}
          >
            {error}
          </div>
        )}

        {!invitationInfo && !tokenParam && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyToken(token);
            }}
            style={{ marginBottom: '18px' }}
          >
            <div className="fld">
              <label htmlFor="token">Enter Invitation or Activation Token</label>
              <input
                id="token"
                type="text"
                required
                placeholder="Paste token from your invitation"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <button type="submit" className={`btn pri ${verifying ? 'loading' : ''}`} style={{ width: '100%' }}>
              Verify Token
            </button>
          </form>
        )}

        {invitationInfo && (
          <div>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--soft)',
                border: '1px solid var(--bd)',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <b style={{ fontSize: '14px' }}>{invitationInfo.company_name || 'OrbX Workshop'}</b>
                <span className={`badge ${invitationInfo.role}`}>{invitationInfo.role}</span>
              </div>
              <small style={{ color: 'var(--t2)', fontSize: '12px' }}>
                Invitation for <b>{invitationInfo.email}</b>
              </small>
            </div>

            <form onSubmit={handleActivate}>
              <div className="fld">
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  placeholder="e.g. Elena Rostova"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="fld">
                <label htmlFor="password">Create Password (8+ characters)</label>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="fld">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className={`btn pri ${loading ? 'loading' : ''}`}
                style={{ width: '100%', height: '44px', marginTop: '10px' }}
                disabled={loading}
              >
                Complete Activation &amp; Enter Workspace
              </button>
            </form>
          </div>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12.5px', color: 'var(--t2)' }}>
          Already have an active account?{' '}
          <Link to="/login" style={{ color: 'var(--text)', fontWeight: 700, textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
