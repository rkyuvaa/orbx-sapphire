import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../../lib/api';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { IconTeam, IconPlus, IconCheck } from '../../components/ui/Icons';
import { Modal } from '../../components/ui/Modal';
import { handleRecordRowClick, handleRecordRowKeyDown } from '../../utils/recordRow';

interface MemberItem {
  id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'staff';
  status: 'active' | 'inactive';
  created_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
  };
}

interface InvitationItem {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

export function TeamManagement() {
  const { activeCompany, currentMembership } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<InvitationItem | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff');
  const [inviting, setInviting] = useState(false);
  const [inviteResultUrl, setInviteResultUrl] = useState<string | null>(null);

  const isOwner = currentMembership?.role === 'owner';
  const canInvite = isOwner || currentMembership?.role === 'manager';

  const fetchData = async () => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    try {
      const [membersData, invData] = await Promise.all([
        apiRequest<MemberItem[]>('/memberships'),
        apiRequest<InvitationItem[]>('/invitations').catch(() => []),
      ]);
      if (currentRequestId === requestId.current) {
        setMembers(membersData);
        setInvitations(invData);
      }
    } catch (err: any) {
      if (currentRequestId === requestId.current) {
        toast(err.message || 'Failed to fetch team members', 'error');
      }
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    requestId.current += 1;
    setMembers([]);
    setInvitations([]);
    setLoading(true);
    void fetchData();
  }, [activeCompany?.id]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await apiRequest<{ invitation_token: string; activation_url: string }>('/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const fullUrl = `${window.location.origin}${res.activation_url}`;
      setInviteResultUrl(fullUrl);
      toast('Invitation created!', 'success');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to invite member', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: MemberItem, newRole: 'owner' | 'manager' | 'staff') => {
    try {
      await apiRequest(`/memberships/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      toast(`Updated role for ${member.user?.full_name}`, 'success');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to update role', 'error');
    }
  };

  const handleRemoveMember = async (member: MemberItem) => {
    if (!window.confirm(`Are you sure you want to remove ${member.user?.full_name || member.user?.email} from this company?`)) {
      return;
    }
    try {
      await apiRequest(`/memberships/${member.id}`, { method: 'DELETE' });
      toast('Member removed from company', 'info');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to remove member', 'error');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast('Invitation link copied to clipboard', 'info');
  };

  return (
    <div className="anim-rise">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Team &amp; Memberships
          </h1>
          <p style={{ color: 'var(--t2)', fontSize: '13px', marginTop: '4px' }}>
            Authorized staff and access roles for <b>{activeCompany?.name}</b>
          </p>
        </div>

        {canInvite && (
          <button onClick={() => setShowInviteModal(true)} className="btn pri">
            <IconPlus size={16} />
            <span>Invite Team Member</span>
          </button>
        )}
      </div>

      {/* Active Members Table */}
      <div className="card tw" style={{ overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Active Members ({members.length})</h2>
        </div>

        <div className="stable-table-container" style={{ overflowX: 'auto' }} aria-busy={loading}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bd)', color: 'var(--t2)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Member</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Joined</th>
                {isOwner && <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && members.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--t2)' }}>
                    Loading team members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--t2)' }}>
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const isCurrent = m.user_id === user?.id;
                  const isCompanyOwner = m.user_id === activeCompany?.owner_id;

                  return (
                    <tr
                      key={m.id}
                      className="record-row"
                      tabIndex={0}
                      aria-label={`Open member ${m.user?.full_name || m.user?.email || ''}`}
                      onClick={(event) => handleRecordRowClick(event, () => setSelectedMember(m))}
                      onKeyDown={(event) => handleRecordRowKeyDown(event, () => setSelectedMember(m))}
                      style={{ borderBottom: '1px solid var(--bd)', fontSize: '13px' }}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'var(--pri)',
                              color: 'var(--pi)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontSize: '12.5px',
                            }}
                          >
                            {m.user?.full_name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <b style={{ display: 'block' }}>
                              {m.user?.full_name} {isCurrent && <small style={{ color: 'var(--mut)' }}>(You)</small>}
                            </b>
                            <small style={{ color: 'var(--t2)' }}>{m.user?.email}</small>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        {isOwner && !isCompanyOwner ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m, e.target.value as any)}
                            style={{
                              height: '32px',
                              padding: '0 8px',
                              borderRadius: '8px',
                              border: '1px solid var(--bd)',
                              background: 'var(--card)',
                              fontSize: '12.5px',
                              fontWeight: 600,
                            }}
                          >
                            <option value="owner">Owner</option>
                            <option value="manager">Manager</option>
                            <option value="staff">Staff</option>
                          </select>
                        ) : (
                          <span className={`badge ${m.role}`}>{m.role}</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 20px' }}>
                        <span className={`badge ${m.status}`}>{m.status}</span>
                      </td>

                      <td style={{ padding: '14px 20px', color: 'var(--t2)', fontSize: '12.5px' }}>
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>

                      {isOwner && (
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {!isCompanyOwner && !isCurrent && (
                            <button
                              onClick={() => handleRemoveMember(m)}
                              className="btn sm danger"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="card tw" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Pending Invitations ({invitations.length})</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bd)', color: 'var(--t2)', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Invited Email</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Assigned Role</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Expires</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr
                    key={inv.id}
                    className="record-row"
                    tabIndex={0}
                    aria-label={`Open invitation for ${inv.email}`}
                    onClick={(event) => handleRecordRowClick(event, () => setSelectedInvitation(inv))}
                    onKeyDown={(event) => handleRecordRowKeyDown(event, () => setSelectedInvitation(inv))}
                    style={{ borderBottom: '1px solid var(--bd)', fontSize: '13px' }}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <b>{inv.email}</b>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className={`badge ${inv.role}`}>{inv.role}</span>
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--t2)', fontSize: '12.5px' }}>
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="badge pending">Pending Activation</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedMember && (
        <Modal title="Team member details" onClose={() => setSelectedMember(null)}>
          <dl className="record-details-list">
            <div><dt>Name</dt><dd>{selectedMember.user?.full_name || '—'}</dd></div>
            <div><dt>Email</dt><dd>{selectedMember.user?.email || '—'}</dd></div>
            <div><dt>Role</dt><dd>{selectedMember.role}</dd></div>
            <div><dt>Status</dt><dd>{selectedMember.status}</dd></div>
            <div><dt>Joined</dt><dd>{new Date(selectedMember.created_at).toLocaleDateString()}</dd></div>
          </dl>
        </Modal>
      )}

      {selectedInvitation && (
        <Modal title="Invitation details" onClose={() => setSelectedInvitation(null)}>
          <dl className="record-details-list">
            <div><dt>Email</dt><dd>{selectedInvitation.email}</dd></div>
            <div><dt>Assigned role</dt><dd>{selectedInvitation.role}</dd></div>
            <div><dt>Status</dt><dd>Pending activation</dd></div>
            <div><dt>Created</dt><dd>{new Date(selectedInvitation.created_at).toLocaleDateString()}</dd></div>
            <div><dt>Expires</dt><dd>{new Date(selectedInvitation.expires_at).toLocaleDateString()}</dd></div>
          </dl>
        </Modal>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <Modal
          title={inviteResultUrl ? 'Invitation Created' : 'Invite Team Member'}
          onClose={() => {
            setShowInviteModal(false);
            setInviteResultUrl(null);
            setInviteEmail('');
          }}
        >

            {inviteResultUrl ? (
              <div>
                <div style={{ textAlign: 'center', padding: '14px 0 20px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'var(--soft)',
                      color: 'var(--color-accent, #16C47F)',
                      display: 'grid',
                      placeItems: 'center',
                      margin: '0 auto 12px',
                    }}
                  >
                    <IconCheck size={24} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Invitation Ready</h3>
                  <p style={{ color: 'var(--t2)', fontSize: '12.5px', marginTop: '4px' }}>
                    Share this activation link with <b>{inviteEmail}</b>
                  </p>
                </div>

                <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--soft)', border: '1px solid var(--bd)', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      readOnly
                      value={inviteResultUrl}
                      style={{
                        flex: 1,
                        fontSize: '12px',
                        height: '36px',
                        padding: '0 8px',
                        background: 'var(--card)',
                        border: '1px solid var(--bd)',
                        borderRadius: '6px',
                      }}
                    />
                    <button onClick={() => copyUrl(inviteResultUrl)} className="btn sm pri">
                      Copy
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteResultUrl(null);
                    setInviteEmail('');
                  }}
                  className="btn pri"
                  style={{ width: '100%' }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit}>
                <div className="fld">
                  <label htmlFor="invEmail">Email Address *</label>
                  <input
                    id="invEmail"
                    type="email"
                    required
                    placeholder="staff@workshop.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="fld">
                  <label htmlFor="invRole">Role</label>
                  <select
                    id="invRole"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                  >
                    <option value="staff">Staff (Standard feature access)</option>
                    <option value="manager">Manager (Can invite &amp; view settings)</option>
                  </select>
                </div>

                <div className="app-modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`btn pri ${inviting ? 'loading' : ''}`}
                    disabled={inviting}
                  >
                    Generate Invitation Link
                  </button>
                </div>
              </form>
            )}
        </Modal>
      )}
    </div>
  );
}
