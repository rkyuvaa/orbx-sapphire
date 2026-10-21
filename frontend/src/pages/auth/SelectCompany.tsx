import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Logo, IconBuilding, IconPlatform } from '../../components/ui/Icons';

export function SelectCompany() {
  const { user, logout } = useAuth();
  const { activeCompanyId, switchCompany } = useTenant();
  const navigate = useNavigate();

  const handleSelect = async (companyId: string) => {
    await switchCompany(companyId);
    navigate('/workspace');
  };

  const memberships = user?.memberships || [];
  const activeMemberships = memberships.filter((m) => m.company_status === 'active');
  const suspendedMemberships = memberships.filter((m) => m.company_status === 'suspended');

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
          width: 'min(520px, 100%)',
          padding: '36px 32px',
          borderRadius: '14px',
          boxShadow: 'var(--modal-sh)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <Logo size={40} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>Select Company Workspace</h1>
          <p style={{ color: 'var(--t2)', fontSize: '13px', marginTop: '4px' }}>
            Choose an authorized tenant to enter the workspace
          </p>
        </div>

        {/* Super Admin Quick Link */}
        {user?.is_superadmin && (
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => navigate('/platform')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'var(--pri)',
                color: 'var(--pi)',
                fontWeight: 700,
                fontSize: '13.5px',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--hl)',
                  color: 'var(--color-accent-contrast, #0A1712)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <IconPlatform size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div>Platform Super Admin Portal</div>
                <small style={{ opacity: 0.8, fontSize: '11.5px', fontWeight: 500 }}>
                  Manage platform companies, plans &amp; platform settings
                </small>
              </div>
            </button>
          </div>
        )}

        {/* Active Companies List */}
        <div style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
          {activeMemberships.length > 0 ? (
            activeMemberships.map((m) => (
              <button
                key={m.company_id}
                onClick={() => handleSelect(m.company_id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid var(--bd)',
                  background: m.company_id === activeCompanyId ? 'var(--soft)' : 'var(--card)',
                  textAlign: 'left',
                  transition: 'border-color var(--dm), transform var(--dm)',
                }}
                className="btn"
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '11px',
                    background: 'var(--sage)',
                    color: 'var(--color-accent-contrast, #0A1712)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: '15px',
                    flexShrink: 0,
                  }}
                >
                  {m.company_name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: '14px' }}>{m.company_name}</b>
                  <small style={{ color: 'var(--t2)', fontSize: '12px' }}>
                    {m.company_code}.orbx.in
                  </small>
                </div>
                <span className={`badge ${m.role}`}>{m.role}</span>
              </button>
            ))
          ) : (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                borderRadius: '14px',
                border: '1px dashed var(--bd)',
                background: 'var(--soft)',
                color: 'var(--t2)',
                fontSize: '13px',
              }}
            >
              <b>No active company memberships found.</b>
              <p style={{ marginTop: '6px', fontSize: '12px' }}>
                Your account is registered, but you do not currently belong to an active workshop.
                Please contact your workshop owner or platform administrator.
              </p>
            </div>
          )}

          {/* Suspended companies */}
          {suspendedMemberships.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--ter)', marginBottom: '6px' }}>
                Suspended Companies
              </div>
              {suspendedMemberships.map((m) => (
                <div
                  key={m.company_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid var(--bd)',
                    background: 'rgba(181, 89, 63, 0.05)',
                    opacity: 0.75,
                  }}
                >
                  <div>
                    <b style={{ fontSize: '13px' }}>{m.company_name}</b>
                    <small style={{ display: 'block', color: 'var(--ter)', fontSize: '11px' }}>
                      Access suspended by platform administration
                    </small>
                  </div>
                  <span className="badge suspended">Suspended</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--bd)', paddingTop: '16px' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--t2)' }}>
            Signed in as <b>{user?.email}</b>
          </div>
          <button onClick={logout} className="btn sm">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
