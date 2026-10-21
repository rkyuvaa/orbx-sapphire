import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Logo } from '../../components/ui/Icons';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenParam);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
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
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: token.trim(),
          new_password: password,
        }),
      });

      toast('Password reset successfully! You can now log in.', 'success');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
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
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <Logo size={40} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>Create New Password</h1>
          <p style={{ color: 'var(--t2)', fontSize: '13px', marginTop: '4px' }}>
            Enter your new secure password below
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(181,89,63,0.1)', color: 'var(--ter)', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleReset}>
          {!tokenParam && (
            <div className="fld">
              <label htmlFor="token">Reset Token</label>
              <input
                id="token"
                type="text"
                required
                placeholder="Paste token received in reset link"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
          )}

          <div className="fld">
            <label htmlFor="password">New Password (8+ characters)</label>
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
            <label htmlFor="confirmPassword">Confirm New Password</label>
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
            Update Password
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/login" style={{ fontSize: '13px', color: 'var(--mut)', textDecoration: 'none', fontWeight: 600 }}>
            Return to Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
