import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Logo,
  IconPlatform,
  IconBuilding,
  IconTeam,
  IconOverview,
  IconSun,
  IconMoon,
  IconMenu,
  IconClose,
} from '../ui/Icons';

export function PlatformLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sideOpen, setSideOpen] = useState(false);

  const getPageTitle = () => {
    if (location.pathname.includes('/companies')) return 'Company Directory';
    if (location.pathname.includes('/plans')) return 'Subscription Plans';
    if (location.pathname.includes('/audit')) return 'Platform Audit Logs';
    return 'Platform Dashboard';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {sideOpen && (
        <div
          onClick={() => setSideOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 35 }}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          inset: '0 auto 0 0',
          width: '240px',
          background: 'var(--side, #0A1712)',
          borderRight: '1px solid var(--bd, rgba(255, 255, 255, 0.09))',
          color: 'var(--color-text-secondary, #B7C6B5)',
          padding: '16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          zIndex: 40,
          transform: sideOpen ? 'none' : undefined,
          transition: 'transform var(--dc) var(--eo)',
        }}
        className={`platform-sidebar ${sideOpen ? 'open' : ''}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', transform: 'translateY(-5px)' }}>
          <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src="/orbx-logo-dark.svg"
              alt="OrbX"
              style={{
                height: '41px',
                width: 'auto',
                maxWidth: '160px',
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <span className="sidebar-brand-name">Sapphire</span>
          </div>
          <button
            onClick={() => setSideOpen(false)}
            style={{ color: '#fff', display: 'none' }}
            className="mobile-close-btn"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div style={{ padding: '8px 12px', background: 'rgba(185, 216, 169, 0.12)', border: '1px solid rgba(185, 216, 169, 0.2)', borderRadius: '12px' }}>
          <span className="badge superadmin" style={{ marginBottom: '4px' }}>Super Admin</span>
          <p style={{ fontSize: '11.5px', color: '#00c87f' }}>
            Platform SaaS management portal. Separate from tenant workspaces.
          </p>
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <NavLink
            to="/platform"
            end
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '42px',
              padding: '0 12px',
              borderRadius: '11px',
              color: isActive ? 'var(--sage)' : '#B7C6B5',
              background: isActive ? 'rgba(185, 216, 169, 0.14)' : 'transparent',
              fontWeight: 600,
              fontSize: '13.5px',
              textDecoration: 'none',
            })}
          >
            <IconOverview size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/platform/companies"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '42px',
              padding: '0 12px',
              borderRadius: '11px',
              color: isActive ? 'var(--sage)' : '#B7C6B5',
              background: isActive ? 'rgba(185, 216, 169, 0.14)' : 'transparent',
              fontWeight: 600,
              fontSize: '13.5px',
              textDecoration: 'none',
            })}
          >
            <IconBuilding size={18} />
            <span>Companies &amp; Tenants</span>
          </NavLink>

          <NavLink
            to="/platform/plans"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '42px',
              padding: '0 12px',
              borderRadius: '11px',
              color: isActive ? 'var(--sage)' : '#B7C6B5',
              background: isActive ? 'rgba(185, 216, 169, 0.14)' : 'transparent',
              fontWeight: 600,
              fontSize: '13.5px',
              textDecoration: 'none',
            })}
          >
            <IconPlatform size={18} />
            <span>Subscription Plans</span>
          </NavLink>

          <NavLink
            to="/platform/audit"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '42px',
              padding: '0 12px',
              borderRadius: '11px',
              color: isActive ? 'var(--sage)' : '#B7C6B5',
              background: isActive ? 'rgba(185, 216, 169, 0.14)' : 'transparent',
              fontWeight: 600,
              fontSize: '13.5px',
              textDecoration: 'none',
            })}
          >
            <IconTeam size={18} />
            <span>Platform Audit Log</span>
          </NavLink>

          {/* Return to workspace */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => navigate('/select-company')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                height: '40px',
                padding: '0 12px',
                borderRadius: '11px',
                color: '#fff',
                background: 'rgba(255,255,255,0.06)',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              <span>Go to Company Workspace</span>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <b style={{ display: 'block', fontSize: '13px', color: '#fff' }}>{user?.full_name}</b>
              <small style={{ fontSize: '11px', color: '#8FA690' }}>Platform Super Admin</small>
            </div>
            <button
              onClick={logout}
              style={{
                fontSize: '12px',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.08)',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }} className="platform-main">
        {/* Header */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            height: '48px',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg)',
            borderBottom: '1px solid var(--bd)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setSideOpen(true)}
              style={{ display: 'none' }}
              className="mobile-menu-btn"
              aria-label="Open menu"
            >
              <IconMenu size={20} />
            </button>
            <div className="platform-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--t2)' }}>
              <span>Platform Administration</span>
              <span>/</span>
              <b style={{ color: 'var(--text)' }}>{getPageTitle()}</b>
            </div>
          </div>

          <div className="platform-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={toggleTheme}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                border: '1px solid var(--bd)',
                background: 'var(--card)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--text)',
              }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>

            <button
              onClick={logout}
              className="btn sm"
              style={{ borderColor: 'var(--bd)' }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="app-main-content" style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .platform-sidebar {
            transform: translateX(-100%);
          }
          .platform-main {
            margin-left: 0 !important;
          }
          .mobile-menu-btn {
            display: grid !important;
          }
          .mobile-close-btn {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
