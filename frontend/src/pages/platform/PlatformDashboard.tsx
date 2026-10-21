import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { IconBuilding, IconTeam, IconPlus, IconPlatform } from '../../components/ui/Icons';
import { NewCompanyModal } from './NewCompanyModal';

interface DashboardStats {
  total_companies: number;
  active_companies: number;
  suspended_companies: number;
  pending_companies: number;
  total_users: number;
  plan_distribution: Record<string, number>;
  recent_activities: Array<{
    id: string;
    action: string;
    entity_type: string;
    user_email?: string;
    company_name?: string;
    created_at: string;
    details: Record<string, any>;
  }>;
}

export function PlatformDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      const data = await apiRequest<DashboardStats>('/platform/dashboard');
      setStats(data);
    } catch (err) {
      console.error('Failed to load platform stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="anim-rise">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Platform Administration
          </h1>
          <p style={{ color: 'var(--t2)', fontSize: '13px', marginTop: '4px' }}>
            Multi-Tenant SaaS Overview &amp; Tenant Lifecycle Management
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowModal(true)} className="btn pri">
            <IconPlus size={16} />
            <span>Register Company</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--soft)', color: 'var(--color-accent, #16C47F)', display: 'grid', placeItems: 'center' }}>
              <IconBuilding size={20} />
            </div>
            <span style={{ color: 'var(--t2)', fontSize: '13px', fontWeight: 600 }}>Total Companies</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>
            {stats?.total_companies ?? 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--t2)', marginTop: '4px' }}>
            Across all SaaS subscription tiers
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--soft)', color: 'var(--color-accent, #16C47F)', display: 'grid', placeItems: 'center' }}>
              <span style={{ fontWeight: 800 }}>✓</span>
            </div>
            <span style={{ color: 'var(--t2)', fontSize: '13px', fontWeight: 600 }}>Active Tenants</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--mut)' }}>
            {stats?.active_companies ?? 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--t2)', marginTop: '4px' }}>
            Operational &amp; enabled workshops
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(183, 134, 47, 0.15)', color: 'var(--amb)', display: 'grid', placeItems: 'center' }}>
              <span style={{ fontWeight: 800 }}>⏳</span>
            </div>
            <span style={{ color: 'var(--t2)', fontSize: '13px', fontWeight: 600 }}>Pending Activation</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--amb)' }}>
            {stats?.pending_companies ?? 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--t2)', marginTop: '4px' }}>
            Awaiting owner account setup
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(181, 89, 63, 0.15)', color: 'var(--ter)', display: 'grid', placeItems: 'center' }}>
              <span style={{ fontWeight: 800 }}>✕</span>
            </div>
            <span style={{ color: 'var(--t2)', fontSize: '13px', fontWeight: 600 }}>Suspended</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ter)' }}>
            {stats?.suspended_companies ?? 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--t2)', marginTop: '4px' }}>
            Access restricted by admin
          </div>
        </div>
      </div>

      {/* Grid: Plan Distribution & Recent Activities */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px' }}>
        {/* Plan Distribution */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Subscription Tier Distribution</h2>
          <div style={{ display: 'grid', gap: '12px', minHeight: 150, alignContent: 'start' }}>
            {stats?.plan_distribution && Object.entries(stats.plan_distribution).length > 0 ? (
              Object.entries(stats.plan_distribution).map(([planName, count]) => {
                const total = stats.total_companies || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={planName} style={{ display: 'grid', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <b>{planName}</b>
                      <span>{count} companies ({pct}%)</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--soft)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: 'var(--mut)',
                          borderRadius: '4px',
                          transition: 'width 600ms var(--eo)',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{ color: 'var(--t2)', fontSize: '13px' }}>{loading ? 'Loading subscription tiers…' : 'No subscription records found.'}</p>
            )}
          </div>
        </div>

        {/* Recent Platform Activities */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Recent Administration Events</h2>
            <button onClick={() => navigate('/platform/audit')} className="btn sm">
              View full log
            </button>
          </div>

          <div style={{ display: 'grid', gap: '10px', minHeight: 250, alignContent: 'start' }}>
            {stats?.recent_activities && stats.recent_activities.length > 0 ? (
              stats.recent_activities.slice(0, 5).map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'var(--soft)',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <b style={{ display: 'block' }}>{act.action}</b>
                    <small style={{ color: 'var(--t2)' }}>
                      {act.user_email || 'System'} {act.company_name ? `• ${act.company_name}` : ''}
                    </small>
                  </div>
                  <small style={{ color: 'var(--t2)', fontSize: '11.5px' }}>
                    {new Date(act.created_at).toLocaleDateString()}
                  </small>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--t2)', fontSize: '13px' }}>{loading ? 'Loading recent events…' : 'No recent events logged.'}</p>
            )}
          </div>
        </div>
      </div>

      {/* New Company Registration Modal */}
      {showModal && (
        <NewCompanyModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchStats();
          }}
        />
      )}
    </div>
  );
}
