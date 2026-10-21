import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { IconSearch, IconPlus, IconBuilding } from '../../components/ui/Icons';
import { NewCompanyModal } from './NewCompanyModal';
import { EditCompanyModal } from './EditCompanyModal';
import { handleRecordRowClick, handleRecordRowKeyDown } from '../../utils/recordRow';

interface CompanyItem {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'suspended' | 'pending_activation';
  owner?: {
    id: string;
    full_name: string;
    email: string;
  };
  subscription?: {
    status: string;
    plan_id?: string;
    plan?: {
      id?: string;
      name?: string;
      code?: string;
    };
  };
  member_count: number;
  created_at: string;
}

export function CompaniesList() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyItem | null>(null);

  const { toast } = useToast();

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      let url = '/platform/companies';
      const params = new URLSearchParams();
      if (search) params.append('query', search);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const data = await apiRequest<CompanyItem[]>(url);
      setCompanies(data);
    } catch (err: any) {
      toast(err.message || 'Failed to fetch companies', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCompanies();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const toggleStatus = async (company: CompanyItem) => {
    const nextStatus = company.status === 'active' ? 'suspended' : 'active';
    const actionLabel = nextStatus === 'active' ? 'reactivate' : 'suspend';

    if (!window.confirm(`Are you sure you want to ${actionLabel} ${company.name}?`)) {
      return;
    }

    try {
      await apiRequest(`/platform/companies/${company.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: nextStatus,
          reason: `Admin requested ${actionLabel}`,
        }),
      });

      toast(`Company ${company.name} is now ${nextStatus}`, 'success');
      fetchCompanies();
    } catch (err: any) {
      toast(err.message || 'Failed to update company status', 'error');
    }
  };

  const handleDeleteCompany = async (company: CompanyItem) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${company.name}" (${company.code}.orbx.in)? This will remove all associated tenant records.`)) {
      return;
    }

    try {
      await apiRequest(`/platform/companies/${company.id}`, { method: 'DELETE' });
      toast(`Company "${company.name}" deleted successfully`, 'success');
      fetchCompanies();
    } catch (err: any) {
      toast(err.message || 'Failed to delete company', 'error');
    }
  };

  return (
    <div className="anim-rise">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Companies &amp; Tenants
          </h1>
          <p style={{ color: 'var(--t2)', fontSize: '13px', marginTop: '4px' }}>
            Registered multi-tenant workshops, owner accounts, and status management
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn pri">
          <IconPlus size={16} />
          <span>Register Company</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="card tw" style={{ overflow: 'hidden' }}>
        {/* Search & Filters */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--bd)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Search bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '40px',
              padding: '0 12px',
              border: '1px solid var(--bd)',
              background: 'var(--inp)',
              borderRadius: '12px',
              width: 'min(340px, 100%)',
            }}
          >
            <IconSearch size={16} className="text-muted" />
            <input
              placeholder="Search companies by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 0, outline: 0, background: 'none', width: '100%', fontSize: '13px' }}
            />
          </div>

          {/* Status Tabs */}
          <div className="company-status-tabs" style={{ display: 'inline-flex', background: 'var(--soft)', borderRadius: '11px', padding: '3px' }}>
            {['all', 'active', 'pending_activation', 'suspended'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: statusFilter === s ? 'var(--text)' : 'var(--t2)',
                  background: statusFilter === s ? 'var(--card)' : 'transparent',
                  boxShadow: statusFilter === s ? 'var(--sh)' : 'none',
                  textTransform: 'capitalize',
                  transition: 'background var(--dm)',
                }}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="stable-table-container" style={{ overflowX: 'auto' }} aria-busy={loading}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bd)', color: 'var(--t2)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Company</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Tenant Code</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Owner Account</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Subscription</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody aria-busy={loading}>
              {loading && companies.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--t2)' }}>
                    Loading companies...
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--t2)' }}>
                    No companies matched your criteria.
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr
                    key={c.id}
                    className="record-row"
                    tabIndex={0}
                    aria-label={`Open company ${c.name}`}
                    onClick={(event) => handleRecordRowClick(event, () => setEditingCompany(c))}
                    onKeyDown={(event) => handleRecordRowKeyDown(event, () => setEditingCompany(c))}
                    style={{
                      borderBottom: '1px solid var(--bd)',
                      fontSize: '13px',
                      transition: 'background var(--dm)',
                    }}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'var(--sage)',
                            color: 'var(--color-accent-contrast, #0A1712)',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 800,
                            fontSize: '13px',
                          }}
                        >
                          {c.name[0].toUpperCase()}
                        </div>
                        <div>
                          <b style={{ display: 'block', color: 'var(--text)' }}>{c.name}</b>
                          <small style={{ color: 'var(--t2)', fontSize: '11.5px' }}>
                            Created {new Date(c.created_at).toLocaleDateString()}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <code style={{ background: 'var(--soft)', padding: '2px 6px', borderRadius: '5px', fontSize: '12px' }}>
                        {c.code}.orbx.in
                      </code>
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      {c.owner ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.owner.full_name}</div>
                          <small style={{ color: 'var(--t2)' }}>{c.owner.email}</small>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--t2)' }}>No owner assigned</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <span className="badge starter">
                        {c.subscription?.plan?.name || 'Starter Plan'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <span className={`badge ${c.status}`}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingCompany(c)}
                          className="btn sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleStatus(c)}
                          className={`btn sm ${c.status === 'active' ? 'danger' : 'pri'}`}
                        >
                          {c.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteCompany(c)}
                          className="btn sm danger"
                          style={{ background: 'transparent', color: 'var(--ter)', borderColor: 'var(--ter)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <NewCompanyModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchCompanies();
          }}
        />
      )}

      {editingCompany && (
        <EditCompanyModal
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
          onSuccess={() => {
            setEditingCompany(null);
            fetchCompanies();
          }}
        />
      )}
    </div>
  );
}
