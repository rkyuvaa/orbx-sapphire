import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/ui/Icons';
import { apiRequest } from '../../lib/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ message: string; reset_token?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
      if (data.reset_token) {
        setResetToken(data.reset_token);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
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
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>Reset your password</h1>
          <p style={{ color: 'var(--t2)', fontSize: '13px', marginTop: '4px' }}>
            We'll send you instructions to recover your account
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(181,89,63,0.1)', color: 'var(--ter)', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {submitted ? (
          <div>
            <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--soft)', border: '1px solid var(--bd)', textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ fontSize: '13.5px', color: 'var(--text)', fontWeight: 600 }}>
                If that email address is registered, password reset instructions have been generated.
              </p>
              {resetToken && (
                <div style={{ marginTop: '14px', textAlign: 'left' }}>
                  <small style={{ color: 'var(--t2)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                    Demo / Testing Token:
                  </small>
                  <button
                    onClick={() => navigate(`/reset-password?token=${resetToken}`)}
                    className="btn pri sm"
                    style={{ width: '100%' }}
                  >
                    Proceed to Reset Password
                  </button>
                </div>
              )}
            </div>
            <Link to="/login" className="btn" style={{ width: '100%', textAlign: 'center' }}>
              Return to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="fld">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button type="submit" className={`btn pri ${loading ? 'loading' : ''}`} style={{ width: '100%', height: '44px' }} disabled={loading}>
              Send Reset Link
            </button>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <Link to="/login" style={{ fontSize: '13px', color: 'var(--mut)', textDecoration: 'none', fontWeight: 600 }}>
                Back to Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
