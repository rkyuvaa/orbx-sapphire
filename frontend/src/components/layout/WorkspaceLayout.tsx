import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useTheme } from '../../context/ThemeContext';
import { NotificationBell } from '../notifications/NotificationBell';
import {
  Logo,
  IconOverview,
  IconOrders,
  IconTeam,
  IconSettings,
  IconPlatform,
  IconSun,
  IconMoon,
  IconMenu,
  IconSwitch
} from '../ui/Icons';

export function WorkspaceLayout() {
  const { user, logout } = useAuth();
  const { activeCompany } = useTenant();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [sideOpen, setSideOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [ordersMenuOpen, setOrdersMenuOpen] = useState(location.pathname.includes('/orders'));
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const activeOrdersSection = searchParams.get('section') || 'orders';

  React.useEffect(() => {
    if (location.pathname.includes('/orders')) setOrdersMenuOpen(true);
  }, [location.pathname]);

  const getPageTitle = () => {
    if (location.pathname.includes('/orders')) return 'Customer Orders';
    if (location.pathname.includes('/team')) return 'Team & Memberships';
    if (location.pathname.includes('/settings')) return 'Company Settings';
    return 'Workspace Overview';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Mobile Scrim */}
      {sideOpen && (
        <div
          onClick={() => setSideOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--scrim)',
            zIndex: 35,
          }}
        />
      )}

      <button
        type="button"
        className={`workspace-sidebar-toggle ${sideOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
        style={{ left: sideOpen ? 168 : sidebarCollapsed ? 10 : 238 }}
        onClick={() => {
          if (window.matchMedia('(min-width: 600px)').matches) {
            setSidebarCollapsed((collapsed) => !collapsed);
          } else {
            setSideOpen((open) => !open);
          }
        }}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : sideOpen ? 'Close sidebar' : 'Collapse sidebar'}
      >
        <IconMenu size={20} />
      </button>

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          inset: '0 auto 0 0',
          width: '230px',
          background: 'var(--side, #0A1712)',
          borderRight: '1px solid var(--bd, rgba(255, 255, 255, 0.09))',
          color: '#FFFFFF',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          zIndex: 40,
          transform: sideOpen ? 'none' : undefined,
          transition: 'transform var(--dc) var(--eo)',
        }}
        className={`workspace-sidebar ${sideOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
      >
        {/* Brand */}
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
        </div>

        <div style={{ padding: '0 4px', fontSize: '13px', fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'var(--font-brand, Comfortaa)' }}>
          {activeCompany?.name || 'Workspace'}
        </div>

        {/* Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <NavLink
            to="/workspace"
            end
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '42px',
              padding: '0 12px',
              borderRadius: '11px',
              color: '#FFFFFF',
              background: isActive ? 'rgba(185, 216, 169, 0.14)' : 'transparent',
              fontWeight: 600,
              fontSize: '13.5px',
              textDecoration: 'none',
            })}
          >
            <IconOverview size={18} />
            <span>Overview</span>
          </NavLink>

          <div>
            <button
              type="button"
              onClick={() => setOrdersMenuOpen((open) => !open)}
              aria-expanded={ordersMenuOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                height: '42px',
                padding: '0 12px',
                borderRadius: '11px',
                color: '#FFFFFF',
                background: location.pathname.includes('/orders') ? 'rgba(185, 216, 169, 0.14)' : 'transparent',
                fontWeight: 600,
                fontSize: '13.5px',
                textAlign: 'left',
              }}
            >
              <IconOrders size={18} />
              <span style={{ flex: 1 }}>Customer Orders</span>
              <span aria-hidden="true" style={{ transform: ordersMenuOpen ? 'rotate(180deg)' : undefined, transition: 'transform var(--dm)' }}>⌄</span>
            </button>
            {ordersMenuOpen && (
              <div style={{ display: 'grid', gap: 2, padding: '2px 0 4px 22px' }}>
                {([
                  ['orders', 'Orders'],
                  ['customers', 'Customer Master'],
                  ['measurements', 'Measurement Setup'],
                ] as const).map(([section, label]) => (
                  <NavLink
                    key={section}
                    to={{ pathname: '/workspace/orders', search: `?section=${section}` }}
                    onClick={() => setSideOpen(false)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: '36px',
                        padding: '0 10px',
                        borderRadius: '9px',
                        color: '#FFFFFF',
                        background: location.pathname.includes('/orders') && activeOrdersSection === section ? 'rgba(185, 216, 169, 0.14)' : 'transparent',
                        fontWeight: 600,
                        fontSize: '13px',
                        textDecoration: 'none',
                    }}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <NavLink
            to="/workspace/team"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '42px',
              padding: '0 12px',
              borderRadius: '11px',
              color: '#FFFFFF',
              background: isActive ? 'rgba(185, 216, 169, 0.14)' : 'transparent',
              fontWeight: 600,
              fontSize: '13.5px',
              textDecoration: 'none',
            })}
          >
            <IconTeam size={18} />
            <span>Team &amp; Members</span>
          </NavLink>

          <NavLink
            to="/workspace/settings"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '42px',
              padding: '0 12px',
              borderRadius: '11px',
              color: '#FFFFFF',
              background: isActive ? 'rgba(185, 216, 169, 0.14)' : 'transparent',
              fontWeight: 600,
              fontSize: '13.5px',
              textDecoration: 'none',
            })}
          >
            <IconSettings size={18} />
            <span>Company Settings</span>
          </NavLink>

          {/* Platform Super Admin entry point */}
          {user?.is_superadmin && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <NavLink
                to="/platform"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '11px',
                  color: '#FFFFFF',
                  background: 'rgba(185, 216, 169, 0.08)',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  textDecoration: 'none',
                }}
              >
                <IconPlatform size={18} />
                <span>Super Admin Portal</span>
              </NavLink>
            </div>
          )}
        </nav>

      </aside>

      {/* Main Layout Area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }} className={`workspace-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Sticky Top Header */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            height: '48px',
            padding: '0 12px 0 52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg)',
            borderBottom: '1px solid var(--bd)',
          }}
        >
          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="workspace-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--t2)' }}>
              <span>OrbX</span>
              <span>/</span>
              <span>{activeCompany?.name || 'Workspace'}</span>
              <span>/</span>
              <b style={{ color: 'var(--text)' }}>{getPageTitle()}</b>
            </div>
          </div>

          {/* Header Actions */}
          <div className="workspace-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <NotificationBell />

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="workspace-theme-button"
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

            {/* Profile Menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="workspace-profile-button"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'var(--pri)',
                  color: 'var(--pi)',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '220px',
                    background: 'var(--card)',
                    border: '1px solid var(--bd)',
                    borderRadius: '14px',
                    boxShadow: 'var(--shh)',
                    padding: '8px',
                    zIndex: 50,
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)', marginBottom: '4px' }}>
                    <b style={{ display: 'block', fontSize: '13px' }}>{user?.full_name}</b>
                    <small style={{ color: 'var(--t2)' }}>{user?.email}</small>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/select-company');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  >
                    <IconSwitch size={16} />
                    <span>Switch Company</span>
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/workspace/settings');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  >
                    <IconSettings size={16} />
                    <span>Company Settings</span>
                  </button>
                  <button
                    onClick={logout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--ter)',
                      borderTop: '1px solid var(--bd)',
                      marginTop: '4px',
                    }}
                  >
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="app-main-content" style={{ maxWidth: 'none', width: '100%', boxSizing: 'border-box' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
