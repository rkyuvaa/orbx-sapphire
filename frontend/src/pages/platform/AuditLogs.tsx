import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { handleRecordRowClick, handleRecordRowKeyDown } from '../../utils/recordRow';

interface AuditLogItem {
  id: string;
  user_id?: string;
  user_email?: string;
  company_id?: string;
  company_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  ip_address?: string;
  details: Record<string, any>;
  created_at: string;
}

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    apiRequest<{ recent_activities: AuditLogItem[] }>('/platform/dashboard')
      .then((data) => setLogs(data.recent_activities || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="anim-rise">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Platform Audit Logs
        </h1>
        <p style={{ color: 'var(--t2)', fontSize: '13px', marginTop: '4px' }}>
          Immutable security and administrative actions across the OrbX platform
        </p>
      </div>

      <div className="card tw" style={{ overflow: 'hidden' }}>
        <div className="stable-table-container" style={{ overflowX: 'auto' }} aria-busy={loading}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bd)', color: 'var(--t2)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Timestamp</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Action</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Target Entity</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Actor</th>
                <th style={{ padding: '12px 20px', fontWeight: 600 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: 'var(--t2)' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: 'var(--t2)' }}>
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr
                    key={l.id}
                    className="record-row"
                    tabIndex={0}
                    aria-label={`Open audit record ${l.action}`}
                    onClick={(event) => handleRecordRowClick(event, () => setSelectedLog(l))}
                    onKeyDown={(event) => handleRecordRowKeyDown(event, () => setSelectedLog(l))}
                    style={{ borderBottom: '1px solid var(--bd)', fontSize: '13px' }}
                  >
                    <td style={{ padding: '14px 20px', color: 'var(--t2)', fontSize: '12px' }}>
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <b>{l.action}</b>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="badge active">{l.entity_type}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div>{l.user_email || 'System'}</div>
                      {l.company_name && <small style={{ color: 'var(--t2)' }}>Company: {l.company_name}</small>}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <code style={{ fontSize: '11px', background: 'var(--soft)', padding: '2px 6px', borderRadius: '4px' }}>
                        {JSON.stringify(l.details)}
                      </code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog && (
        <Modal title="Audit record details" onClose={() => setSelectedLog(null)}>
          <dl className="record-details-list">
            <div><dt>Timestamp</dt><dd>{new Date(selectedLog.created_at).toLocaleString()}</dd></div>
            <div><dt>Action</dt><dd>{selectedLog.action}</dd></div>
            <div><dt>Target entity</dt><dd>{selectedLog.entity_type}</dd></div>
            <div><dt>Entity ID</dt><dd>{selectedLog.entity_id || '—'}</dd></div>
            <div><dt>Actor</dt><dd>{selectedLog.user_email || 'System'}</dd></div>
            <div><dt>Company</dt><dd>{selectedLog.company_name || '—'}</dd></div>
            <div><dt>IP address</dt><dd>{selectedLog.ip_address || '—'}</dd></div>
            <div>
              <dt>Details</dt>
              <dd><pre>{JSON.stringify(selectedLog.details, null, 2)}</pre></dd>
            </div>
          </dl>
        </Modal>
      )}
    </div>
  );
}
