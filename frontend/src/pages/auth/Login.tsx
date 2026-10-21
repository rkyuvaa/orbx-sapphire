import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../context/ToastContext';
import { Logo } from '../../components/ui/Icons';
import { apiRequest } from '../../lib/api';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const { switchCompany } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const user = await login(res.access_token);
      toast(`Welcome back, ${user.full_name}`, 'success');

      // Post-login routing logic according to master prompt:
      // 1. If Super Admin, route to /platform
      if (user.is_superadmin) {
        navigate('/platform');
        return;
      }

      // 2. Otherwise check active company memberships
      const activeMemberships = user.memberships.filter((m) => m.company_status === 'active');

      if (activeMemberships.length === 1) {
        // Exactly one company: activate company context and open workspace
        await switchCompany(activeMemberships[0].company_id);
        navigate('/workspace');
      } else if (activeMemberships.length > 1) {
        // Multiple companies: display company selection screen
        navigate('/select-company');
      } else {
        // No active company membership
        navigate('/select-company');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
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
        padding: '20px',
        background: 'var(--gradient-auth)',
      }}
    >
      <div
        className="card anim-rise"
        style={{
          width: 'min(440px, 100%)',
          padding: '36px 32px',
          borderRadius: '14px',
          boxShadow: 'var(--modal-sh)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <Logo size={40} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>Sign in to your account</h1>
          
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

        <form onSubmit={handleSubmit}>
          <div className="fld">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="fld">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="password">Password</label>
              <Link to="/forgot-password" style={{ fontSize: '12px', color: 'var(--mut)', textDecoration: 'none', fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className={`btn pri ${loading ? 'loading' : ''}`}
            style={{ width: '100%', height: '44px', marginTop: '10px', fontSize: '14px' }}
            disabled={loading}
          >
            Sign in
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12.5px', color: 'var(--t2)' }}>
          Invited to a workshop?{' '}
          <Link to="/activate" style={{ color: 'var(--text)', fontWeight: 700, textDecoration: 'none' }}>
            Activate account
          </Link>
        </div>
      </div>
    </div>
  );
}
