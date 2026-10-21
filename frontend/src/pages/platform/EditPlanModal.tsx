import React, { useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/ui/Modal';

export interface PlanItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  max_users: number;
  modules_allowed: Record<string, boolean>;
  is_active: boolean;
}

interface EditPlanModalProps {
  plan: PlanItem;
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_MODULES = [
  { key: 'orders', label: 'Customer Orders' },
  { key: 'team', label: 'Team & Memberships' },
  { key: 'inventory', label: 'Inventory & Purchases' },
  { key: 'expenses', label: 'Expenses & Petty Cash' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'reports', label: 'Reports & Analytics' },
];

export function EditPlanModal({ plan, onClose, onSuccess }: EditPlanModalProps) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description || '');
  const [maxUsers, setMaxUsers] = useState(plan.max_users);
  const [modules, setModules] = useState<Record<string, boolean>>(plan.modules_allowed || {});
  const [isActive, setIsActive] = useState(plan.is_active);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  const toggleModule = (key: string) => {
    setModules((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiRequest(`/platform/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          max_users: Number(maxUsers),
          modules_allowed: modules,
          is_active: isActive,
        }),
      });

      toast(`Plan ${name} updated successfully!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Edit Subscription Plan" onClose={onClose}>
        <small style={{ display: 'block', color: 'var(--t2)', fontSize: '12px', marginTop: -10, marginBottom: 16 }}>
          Tier Code: <code>{plan.code}</code>
        </small>

        {error && (
          <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(181,89,63,0.1)', color: 'var(--ter)', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="fld">
            <label htmlFor="planName">Plan Name *</label>
            <input
              id="planName"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="fld">
            <label htmlFor="planDesc">Description</label>
            <textarea
              id="planDesc"
              rows={2}
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

          <div style={{ marginBottom: '16px' }}>
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

          <div className="fld">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Active for new company assignments</span>
            </label>
          </div>

          <div className="app-modal-actions">
            <button type="button" onClick={onClose} className="btn">
              Cancel
            </button>
            <button type="submit" className={`btn pri ${loading ? 'loading' : ''}`} disabled={loading}>
              Save Plan
            </button>
          </div>
        </form>
    </Modal>
  );
}
