import React, { useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/ui/Modal';

interface CreatePlanModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_MODULES = [
  { key: 'orders', label: 'Customer Orders', default: true },
  { key: 'team', label: 'Team & Memberships', default: true },
  { key: 'inventory', label: 'Inventory & Purchases', default: true },
  { key: 'expenses', label: 'Expenses & Petty Cash', default: false },
  { key: 'invoices', label: 'Invoices', default: false },
  { key: 'reports', label: 'Reports & Analytics', default: false },
];

export function CreatePlanModal({ onClose, onSuccess }: CreatePlanModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [maxUsers, setMaxUsers] = useState(10);
  const [modules, setModules] = useState<Record<string, boolean>>({
    orders: true,
    team: true,
    inventory: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  const handleNameChange = (val: string) => {
    setName(val);
    setCode(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const toggleModule = (key: string) => {
    setModules((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiRequest('/platform/plans', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          max_users: Number(maxUsers),
          modules_allowed: modules,
          is_active: true,
        }),
      });

      toast(`Plan ${name} created successfully!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Create New Subscription Plan" onClose={onClose}>

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(181,89,63,0.1)', color: 'var(--ter)', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="platform-form-two-column-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div className="fld">
              <label htmlFor="planName">Plan Name *</label>
              <input
                id="planName"
                required
                placeholder="e.g. Couture Exclusive"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            <div className="fld">
              <label htmlFor="planCode">Plan Code *</label>
              <input
                id="planCode"
                required
                placeholder="couture-exclusive"
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))}
              />
            </div>
          </div>

          <div className="fld">
            <label htmlFor="planDesc">Description</label>
            <textarea
              id="planDesc"
              rows={2}
              placeholder="Features and target workshop tier..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="fld">
            <label htmlFor="maxUsers">Max User Seats *</label>
            <input
              id="maxUsers"
              type="number"
              min={1}
              max={1000}
              required
              value={maxUsers}
              onChange={(e) => setMaxUsers(parseInt(e.target.value) || 1)}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Allowed Modules
            </label>
            <div className="platform-form-module-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {AVAILABLE_MODULES.map((m) => (
                <label
                  key={m.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--bd)',
                    background: modules[m.key] ? 'var(--soft)' : 'var(--card)',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!modules[m.key]}
                    onChange={() => toggleModule(m.key)}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="app-modal-actions">
            <button type="button" onClick={onClose} className="btn">
              Cancel
            </button>
            <button type="submit" className={`btn pri ${loading ? 'loading' : ''}`} disabled={loading}>
              Create Plan
            </button>
          </div>
        </form>
    </Modal>
  );
}
